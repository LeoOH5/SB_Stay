"""AI-04 동행 준비 자료 (A 담당, 명세상 선택 기능).

버디(또는 해설사)가 요청 카드에서 'AI 자료'를 누르면 부른다.
- 갈 만한 장소: 같은 예약의 투어 코스 장소(같은 날 우선). 투어가 없으면 버디 관심사에 맞고 그날 여는 장소.
- 장소 요약·팁은 DB 값(story_doc 소개, 운영시간, 휴무, 요금)으로만 만든다.
- LLM은 버디에게 줄 2~3문장 안내(brief)와 관광객에게 쓸 영어 문장(phrases)만 쓴다. 실패하면 템플릿.
버디 화면은 한국어라 brief와 장소 요약은 한국어, phrases는 관광객에게 말할 영어다.
"""
import re
from dataclasses import dataclass
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Booking, BookingItem, BuddyProfile, Place, Tour, TourPlace, User
from app.services import story

WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
DOW_KO = {"mon": "월", "tue": "화", "wed": "수", "thu": "목", "fri": "금", "sat": "토", "sun": "일"}
TAG_FOR_INTEREST = {"literature": "literature", "independence": "independence", "hanok": "hanok",
                    "architecture": "hanok", "history": "royal", "craft": "craft", "walking": "nature",
                    "photo": "photo", "cafe": "literature"}
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
    tour: Tour | None
    places: list[Place]


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

    tour = db.get(Tour, item.ref_id) if item.type == "tour" else None
    if tour is None and booking:  # 버디 항목: 같은 예약의 투어 (같은 날 우선)
        tours = db.scalars(select(BookingItem).where(
            BookingItem.booking_id == booking.id, BookingItem.type == "tour", BookingItem.status != "cancelled"
        )).all()
        tours = sorted(tours, key=lambda t: (t.date_from != item.date_from, t.date_from))
        tour = db.get(Tour, tours[0].ref_id) if tours else None

    places = [p for p in tour_places(db, tour.id) if _open_on(p, item.date_from)] if tour else []
    if not places:  # 투어가 없으면 버디 관심사에 맞고 그날 여는 장소
        tags = {TAG_FOR_INTEREST.get(i, i) for i in (buddy.interests if buddy else []) or []}
        pool = [p for p in db.scalars(select(Place).order_by(Place.id)).all() if _open_on(p, item.date_from) and p.story_doc]
        places = sorted(pool, key=lambda p: -len(tags & set(p.tags or [])))
    return Material(item, tourist.split(" ")[0], traveler.get("nationality", ""), tour, places[:3])


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


def fallback_brief(m: Material) -> str:
    when = f"{m.item.date_from.month}/{m.item.date_from.day}" + (f" {m.item.time}" if m.item.time else "")
    names = "·".join(p.name for p in m.places)
    who = f"{m.tourist} 님" + (f"({m.nationality})" if m.nationality else "")
    if m.tour and m.item.type == "buddy":
        return f"{who}은 {when} 전에 '{m.tour.title}' 투어를 들어요. {names} 이야기로 대화를 이어 가면 좋아요."
    if m.tour:
        return f"{who}과 {when}에 '{m.tour.title}' 코스를 함께해요. 코스 순서는 {names}예요."
    return f"{who}과 {when}에 만나요. 그날 여는 {names} 쪽으로 걸어 보세요."


def material_text(m: Material) -> str:
    d = m.item.date_from
    lines = [
        f"Tourist: {m.tourist} ({m.nationality or 'unknown'}), meeting {d.month}/{d.day} ({d.isoformat()}) {m.item.time or ''}",
        f"Tour earlier: {m.tour.title} / {m.tour.title_en}" if m.tour else "Tour: none",
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
        "- brief: 2 or 3 short sentences in Korean for the buddy (what the traveler did, what to talk about).\n"
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
