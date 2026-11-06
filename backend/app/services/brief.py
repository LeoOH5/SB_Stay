"""AI-04 동행 준비 자료 (A 담당, 명세상 선택 기능).

버디가 요청 카드에서 'AI 자료'를 누르면 부른다.
- 갈 만한 장소: 버디 항목의 course_id 코스 → 없으면 요청의 places → 없으면 버디 관심사에 맞고 그날 여는 장소.
- 여행자 요청(식단·알레르기·속도)은 brief 첫 문장에 넣는다 ("비건, 버섯 알레르기 요청이 있어요. 식당에서 꼭 확인해 주세요.").
- 장소 요약·팁은 DB 값(story_doc 소개, 운영시간, 휴무, 요금)으로만 만든다.
- LLM은 버디에게 줄 2~3문장 안내(brief)와 관광객에게 쓸 영어 문장(phrases)만 쓴다. 실패하면 템플릿.
버디 화면은 한국어라 brief와 장소 요약은 한국어, phrases는 관광객에게 말할 영어다.
v3.8 추천 동선(route): 코스 장소(그날 여는 곳) + 여행자가 고른 '더 가 보고 싶은 곳'(최대 3, 코스에 없는 곳)을
걷는 거리가 가장 짧은 순서로 놓는다(courses.best_order, 코스 첫 장소는 그대로 처음). 코스도 요청 장소도 없으면 위의 추천 장소로.
구간 거리는 저장한 OpenStreetMap 실제 도보 경로 → 없으면 직선 × 1.3 추정, 4 km/h. 순서는 코드가 정하고 LLM은 바꾸지 않는다.
"""
import re
from dataclasses import dataclass, field
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import rules
from app.models import Booking, BookingItem, BuddyProfile, Place, Tour, TourPlace, User
from app.services import courses, story

WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
DOW_KO = {"mon": "월", "tue": "화", "wed": "수", "thu": "목", "fri": "금", "sat": "토", "sun": "일"}
TAG_FOR_INTEREST = {"literature": "literature", "independence": "independence", "hanok": "hanok",
                    "architecture": "hanok", "history": "royal", "craft": "craft", "walking": "nature",
                    "photo": "photo", "cafe": "literature"}
EXTRA_MAX = 3  # 더 가 보고 싶은 곳 최대 개수 (버디 요청 화면과 같음)
GENERIC_PHRASES = [
    "Please take off your shoes here.",
    "Shall we take a photo here?",
    "Let me know if you want to take a break.",
]


@dataclass
class Material:
    item: BookingItem
    tourist: str
    nationality: str
    course: Tour | None
    places: list[Place]
    route: list[Place] = field(default_factory=list)  # v3.8 추천 동선 (걷는 순서)
    route_time: courses.CourseTime | None = None  # route 구간·합계
    course_place_ids: set[int] = field(default_factory=set)  # route 중 코스 장소


def _open_on(p: Place, d: date) -> bool:
    return WEEKDAYS[d.weekday()] not in (p.closed_days or [])


def tour_places(db: Session, tour_id: int) -> list[Place]:
    rows = db.execute(
        select(Place).join(TourPlace, TourPlace.place_id == Place.id).where(TourPlace.tour_id == tour_id).order_by(TourPlace.seq)
    ).scalars().all()
    return list(rows)


def gather(db: Session, item: BookingItem, buddy: BuddyProfile | None) -> Material:
    booking = db.get(Booking, item.booking_id)
    traveler = (booking.traveler or {}) if booking else {}
    tourist = traveler.get("name") or (db.get(User, booking.tourist_id).name if booking else "")

    course = db.get(Tour, item.course_id) if item.course_id else None
    course_places = [p for p in tour_places(db, course.id) if _open_on(p, item.date_from)] if course else []
    ids = (item.request or {}).get("places") or []
    requested = [p for p in (db.get(Place, i) for i in ids) if p and _open_on(p, item.date_from)]
    places = course_places or requested  # 코스 → 요청에서 고른 장소(그날 여는 곳)
    if not places:  # 버디 관심사에 맞고 그날 여는 장소
        tags = {TAG_FOR_INTEREST.get(i, i) for i in (buddy.interests if buddy else []) or []}
        pool = [p for p in db.scalars(select(Place).order_by(Place.id)).all() if _open_on(p, item.date_from) and p.story_doc]
        places = sorted(pool, key=lambda p: -len(tags & set(p.tags or [])))
    m = Material(item, tourist.split(" ")[0], traveler.get("nationality", ""), course, places[:3])
    in_course = {p.id for p in course_places}
    extra = [p for p in dict.fromkeys(requested) if p.id not in in_course][:EXTRA_MAX]
    plan_route(db, m, course_places, extra if (course_places or extra) else m.places)
    return m


def plan_route(db: Session, m: Material, course_places: list[Place], extra: list[Place]) -> None:
    """v3.8 추천 동선: 코스 장소 + 더 갈 곳 → 걷는 거리가 가장 짧은 순서 (코스가 있으면 코스 첫 장소를 처음에 고정)"""
    pool = list(dict.fromkeys([*course_places, *extra]))
    by_id = {p.id: p for p in pool}
    routes = courses.load_routes(db, by_id)
    stops = [courses.Stop(p.id, p.lat, p.lng, p.stay_min or 0) for p in pool]
    ordered = courses.best_order(stops, keep_first=bool(course_places), routes=routes)
    m.route = [by_id[s.place_id] for s in ordered]
    m.route_time = courses.summarize(ordered, routes)
    m.course_place_ids = {p.id for p in course_places}


def route_text(m: Material) -> str:
    """'성북근현대문학관 → 수연산방 → 심우장 (걷는 약 20분)' — 숫자는 계산값만"""
    if len(m.route) < 2 or not m.route_time:
        return ""
    names = " → ".join(p.name for p in m.route)
    return f"{names} (걷는 약 {m.route_time.walk_min_total}분)"


def place_tips(p: Place) -> str:
    """사실만: 운영시간 · 휴무 · 요금 · 예약 + 문서의 '볼 때 팁' 첫 줄"""
    parts = []
    if p.hours:
        parts.append(f"운영 {p.hours}")
    closed = p.closed_days or []
    if len(closed) == 7:
        parts.append("지금은 휴관")
    elif closed:
        parts.append("휴무 " + "·".join(DOW_KO[d] for d in closed if d in DOW_KO))
    parts.append(f"입장료 {p.fee:,}원" if p.fee else "무료")
    if p.need_reservation:
        parts.append("사전 예약 필요")
    tip = story.parse(p.story_doc)["ko"].tips
    if tip:
        parts.append(tip[0])
    return " · ".join(parts)


def summary(p: Place) -> str:
    return story.parse(p.story_doc)["ko"].intro or p.name


def first_sentence(text: str) -> str:
    m = re.match(r"(.+?[.!?])(\s|$)", text)
    return (m.group(1) if m else text).strip()


def fallback_phrases(m: Material) -> list[str]:
    """장소 영어 소개 첫 문장 + 자주 쓰는 말. 모두 문서에 있는 내용이다."""
    out = []
    for p in m.places:
        en = story.parse(p.story_doc)["en"].intro
        if en:
            out.append(f"{p.name_en}: {first_sentence(en)}")
    return out + GENERIC_PHRASES


def request_sentence(m: Material) -> str:
    """요청을 첫 문장으로: 식단·알레르기는 식당 확인, 천천히는 쉬어 가기"""
    req = m.item.request or {}
    food = rules.request_summary({"diet": req.get("diet"), "allergies": req.get("allergies")})
    parts = []
    if food:
        parts.append(f"{food} 요청이 있어요. 식당에서 꼭 확인해 주세요.")
    if req.get("pace") == "slow":
        parts.append("천천히 걷고 싶어 해요. 쉬어 갈 곳을 미리 정해 두세요.")
    return " ".join(parts)


def fallback_brief(m: Material) -> str:
    when = f"{m.item.date_from.month}/{m.item.date_from.day}" + (f" {m.item.time}" if m.item.time else "")
    names = "·".join(p.name for p in m.places)
    who = f"{m.tourist} 님" + (f"({m.nationality})" if m.nationality else "")
    order = route_text(m)
    if m.course:
        body = f"{who}과 {when}에 '{m.course.title}' 코스를 함께 걸어요. 추천 순서는 {order or names}이고, 장소 이야기는 AI가 들려줘요."
    else:
        body = f"{who}과 {when}에 만나요. 그날 여는 {order or names} 쪽으로 걸어 보세요."
    return " ".join(x for x in [request_sentence(m), body] if x)


def material_text(m: Material) -> str:
    d = m.item.date_from
    lines = [
        f"Tourist: {m.tourist} ({m.nationality or 'unknown'}), meeting {d.month}/{d.day} ({d.isoformat()}) {m.item.time or ''}",
        f"Course to walk together: {m.course.title} / {m.course.title_en}" if m.course else "Course: none",
        f"Traveler requests: {request_sentence(m) or 'none'}",
        f"Suggested walking order (fixed by the app, do not change it): {route_text(m) or 'none'}",
    ]
    for p in m.places:
        en = story.parse(p.story_doc)["en"].intro
        lines.append(f"- {p.name} / {p.name_en}: {summary(p)} | {en} | {place_tips(p)}")
    return "\n".join(lines)


def llm_prompt(m: Material) -> tuple[str, str]:
    system = (
        "You help a Korean university student buddy prepare for a walk with a foreign traveler in Seongbuk, Seoul.\n"
        "Rules:\n"
        "- Use only the facts in MATERIAL. Never add dates, prices, hours or history that are not there.\n"
        "- brief: 2 or 3 short sentences in Korean for the buddy. If there are traveler requests, the FIRST sentence must\n"
        "  restate them (diet, allergies, pace) and remind the buddy to check at restaurants. Then what to talk about.\n"
        "- The buddy does not give history talks; the app's AI tells place stories.\n"
        "- phrases: 3 to 5 short, friendly English sentences the buddy can say to the traveler at these places.\n"
        '- Reply with JSON only: {"brief": "...", "phrases": ["...", "..."]}'
    )
    return system, "MATERIAL:\n" + material_text(m)


_NUM = re.compile(r"\d[\d,.:]*")


def _norm(n: str) -> str:
    """'01'과 '1', '1,000.'과 '1,000'을 같은 숫자로 본다"""
    n = n.rstrip(".,:")
    return str(int(n)) if n.isdigit() else n


def validate_llm(raw: dict, m: Material) -> tuple[str, list[str]]:
    brief, phrases = raw.get("brief"), raw.get("phrases")
    if not isinstance(brief, str) or not brief.strip() or not isinstance(phrases, list):
        raise ValueError("brief/phrases 형식 오류")
    phrases = [p.strip()[:200] for p in phrases if isinstance(p, str) and p.strip()][:8]
    if not phrases:
        raise ValueError("phrases 비어 있음")
    known = {_norm(n) for n in _NUM.findall(material_text(m))}
    for text in [brief, *phrases]:
        for n in _NUM.findall(text):
            if _norm(n) not in known:
                raise ValueError(f"자료에 없는 숫자: {n}")
    return brief.strip()[:600], phrases
