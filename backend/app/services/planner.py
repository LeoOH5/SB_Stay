"""AI-01 여행 설계: 후보는 코드가 DB에서 거르고, LLM은 고르기·설명만 한다.

1) 후보 만들기 (코드): 숙소(개방 기간·잔여 객실·예산), 무료 코스(운영 요일·코스 장소 휴관일),
   버디(승인·가능 날짜·언어, 숙박 기간 안), 자유 일정 장소(관심사·휴관일). 가격·날짜는 전부 DB 값.
2) 고르기: LLM이 후보 id 중에서 숙소·버디·코스·자유 장소를 고르고 추천 이유를 쓴다.
   LLM이 없거나 실패하거나 후보에 없는 id를 내면 점수 순 규칙 기반 선택(폴백)으로 대신한다.
3) 일정 조립 (코드): 숙소가 있으면 버디는 반드시 넣는다(BK-01 BUDDY_REQUIRED). 코스는 버디 항목의 course_id.
   버디가 없으면 warnings NO_BUDDY, 예산을 넘으면 버디를 빼지 않고 OVER_BUDGET.
4) v3.8 순서 (코드): 하루에 자유 장소가 여러 곳이면 걷는 거리가 가장 짧은 순서(courses.best_order, 실제 도보 경로 →
   없으면 추정)로 놓는다. LLM이 준 순서는 '고르기'로만 쓰고 그날 순서는 늘 코드가 다시 정한다.
   무료 코스 장소는 정해 둔 코스 순서 그대로 (무료 이용은 코스 순서가 고정).
5) 시간 (코드): 숙소 체크인 15:00. 버디는 14:00, 단 체크인 날이면 도착 뒤 16:00. 코스만 있는 날은 10:00,
   단 숙소가 있고 체크인 날이면 16:00 (버디가 있으면 코스는 버디 항목에 붙어 따로 시간을 잡지 않는다).
"""
from dataclasses import dataclass, field
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    BuddyAvailability,
    BuddyProfile,
    DormRoom,
    Place,
    Tour,
    TourPlace,
    University,
    User,
)
from app.schemas.ai import PlanDay, PlanIn, PlanItem
from app.services import courses
from app.services.availability import occupied_rooms
from app.services.matcher import LANGUAGE

WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
BUDDY_HOURS = 2
CHECK_IN_TIME = "15:00"  # 숙소 체크인
BUDDY_TIME = "14:00"  # 버디 동행 기본 시간
COURSE_TIME = "10:00"  # 버디 없이 코스만 걷는 날
AFTER_CHECK_IN = "16:00"  # 체크인 날에는 도착(15:00) 뒤로
ROOM_KO = {"single": "1인실", "double": "2인실", "twin": "트윈룸"}
ROOM_EN = {"single": "single", "double": "double", "twin": "twin"}
INTEREST_KO = {"literature": "문학", "independence": "독립운동", "royal": "왕실·왕릉", "hanok": "한옥",
               "food": "로컬 음식", "craft": "공예", "temple": "사찰", "nature": "산책", "museum": "박물관"}
INTEREST_EN = {"literature": "literature", "independence": "independence history", "royal": "royal heritage",
               "hanok": "hanok", "food": "local food", "craft": "crafts", "temple": "temples", "nature": "walks",
               "museum": "museums"}


@dataclass
class DormC:
    room: DormRoom
    uni: University | None
    price: int


@dataclass
class CourseC:
    tour: Tour
    day: date
    score: float
    place_names: list[str]


@dataclass
class BuddyC:
    buddy: BuddyProfile
    name: str
    day: date
    score: float
    price: int


@dataclass
class PlaceC:
    place: Place
    score: float
    open_days: list[date] = field(default_factory=list)


@dataclass
class Candidates:
    nights: int
    days: list[date]           # check_in ~ check_out (양 끝 포함)
    activity_days: list[date]  # 버디·코스·자유 일정을 넣을 날 (숙박 기간 안)
    dorms: list[DormC]         # 개방·잔여 객실·예산 통과, 싼 순
    courses: list[CourseC]
    buddies: list[BuddyC]
    places: list[PlaceC]


@dataclass
class Choice:
    dorm: DormC | None
    buddy: BuddyC | None
    course: CourseC | None
    free_place_ids: list[int]
    reason: str | None = None


def _wd(d: date) -> str:
    return WEEKDAYS[d.weekday()]


def _open_on(p: Place, d: date) -> bool:
    return _wd(d) not in (p.closed_days or [])


def build_candidates(db: Session, req: PlanIn) -> Candidates:
    nights = (req.check_out - req.check_in).days
    days = [req.check_in + timedelta(days=i) for i in range(nights + 1)]
    activity_days = days[1:-1] or [req.check_in]  # 1박이면 도착일 오후
    interests = set(req.interests)
    budget = req.budget or None

    # 숙소: 개방 기간 안, 잔여 객실 있음, 예산 안. 싼 순. 하나도 없으면 가장 싼 방이라도 넣는다
    dorms: list[DormC] = []
    rooms = db.scalars(select(DormRoom).where(DormRoom.active.is_(True)).order_by(DormRoom.price_per_night, DormRoom.id)).all()
    for room in rooms:
        uni = db.get(University, room.university_id)
        open_from = room.open_from or (uni.open_from if uni else None)
        open_to = room.open_to or (uni.open_to if uni else None)
        if (open_from and req.check_in < open_from) or (open_to and req.check_out > open_to):
            continue
        if room.total_rooms - occupied_rooms(db, room.id, req.check_in, req.check_out) <= 0:
            continue
        c = DormC(room, uni, room.price_per_night * nights)
        if not (budget and c.price > budget):
            dorms.append(c)
    if not dorms and rooms:
        dorms = [DormC(rooms[0], db.get(University, rooms[0].university_id), rooms[0].price_per_night * nights)]

    places = {p.id: p for p in db.scalars(select(Place)).all()}

    # 코스(무료): 운영 요일(비어 있으면 매일)이고, 코스의 모든 장소가 그날 문을 여는 날짜만
    courses: list[CourseC] = []
    for t in db.scalars(select(Tour).order_by(Tour.id)).all():
        stops = db.scalars(select(TourPlace).where(TourPlace.tour_id == t.id).order_by(TourPlace.seq)).all()
        stop_places = [places[s.place_id] for s in stops if s.place_id in places]
        tags = {tag for p in stop_places for tag in (p.tags or [])}
        score = (3 if t.theme in interests else 0) + len(tags & interests)
        for d in activity_days:
            if (not t.operating_days or _wd(d) in t.operating_days) and all(_open_on(p, d) for p in stop_places):
                courses.append(CourseC(t, d, score, [p.name for p in stop_places]))
    courses.sort(key=lambda c: (-c.score, c.day, c.tour.id))

    # 버디: 승인·휴면 아님, 가능 날짜(숙박 기간 안), 요청 언어 구사. 숙소가 있으면 버디는 필수라 with_buddy와 상관없이 만든다
    buddies: list[BuddyC] = []
    for b in db.scalars(select(BuddyProfile).where(BuddyProfile.status == "approved", BuddyProfile.needs_recheck.is_(False)).order_by(BuddyProfile.id)).all():
        if req.language not in (b.languages or []) and req.language != "ko":
            continue
        free = set(db.scalars(select(BuddyAvailability.date).where(BuddyAvailability.buddy_id == b.id)).all())
        u = db.get(User, b.user_id)
        score = len(set(b.interests or []) & interests) + (0.5 if req.language in (b.languages or []) else 0)
        for d in activity_days:
            if d in free:
                buddies.append(BuddyC(b, u.name if u else "", d, score, b.hourly_fee * BUDDY_HOURS))
    buddies.sort(key=lambda c: (-c.score, c.day, c.buddy.id))

    # 자유 일정 장소: 관심사와 겹치는 장소, 문 여는 날이 하루라도 있는 곳
    pcs = []
    for p in places.values():
        open_days = [d for d in activity_days if _open_on(p, d)]
        if open_days:
            pcs.append(PlaceC(p, len(set(p.tags or []) & interests), open_days))
    pcs.sort(key=lambda c: (-c.score, c.place.id))

    return Candidates(nights, days, activity_days, dorms, courses, buddies, pcs)


def _best_course(c: Candidates, day: date | None) -> CourseC | None:
    pool = [x for x in c.courses if day is None or x.day == day]
    return pool[0] if pool else None


def _free_places(c: Candidates, course: CourseC | None) -> list[int]:
    taken = set(course.place_names) if course else set()
    return [p.place.id for p in c.places if p.place.name not in taken][:6]


def fallback_choice(c: Candidates, budget: int | None = None) -> Choice:
    """숙소·버디를 함께 고른다: 예산 안 → 같은 대학 → 버디 점수 → 싼 숙소 순. 코스는 버디 날 점수가 가장 높은 것."""
    def rank(p: tuple[DormC | None, BuddyC | None]):
        d, b = p
        price = (d.price if d else 0) + (b.price if b else 0)
        same_uni = bool(d and b and d.room.university_id == b.buddy.university_id)
        return (bool(budget) and price > budget, not same_uni, -(b.score if b else 0), d.price if d else 0,
                b.day if b else date.min, b.buddy.id if b else 0)

    pairs = [(d, b) for d in (c.dorms or [None]) for b in (c.buddies or [None])]
    dorm, buddy = min(pairs, key=rank)
    course = _best_course(c, buddy.day if buddy else None)
    return Choice(dorm, buddy, course, _free_places(c, course))


def validate_choice(c: Candidates, data: dict, budget: int | None = None) -> Choice:
    """LLM 응답을 후보와 대조한다. 후보에 없는 id·날짜는 버리고, 빈 자리는 폴백으로 채운다. 버디는 후보가 있으면 필수."""
    fb = fallback_choice(c, budget)
    dorm = next((d for d in c.dorms if d.room.id == data.get("dorm_id")), None) or fb.dorm
    buddy = next((b for b in c.buddies if b.buddy.id == data.get("buddy_id") and str(b.day) == str(data.get("buddy_date"))), None) or fb.buddy
    day = buddy.day if buddy else None
    course = next((x for x in c.courses if x.tour.id == data.get("course_id") and (day is None or x.day == day)), None)
    if course is None and not ("course_id" in data and data.get("course_id") is None):
        course = _best_course(c, day)
    valid_places = {p.place.id for p in c.places}
    free = [i for i in data.get("free_place_ids", []) if isinstance(i, int) and i in valid_places] or _free_places(c, course)
    reason = data.get("reason") if isinstance(data.get("reason"), str) and data.get("reason").strip() else None
    return Choice(dorm, buddy, course, free, reason)


def llm_prompt(c: Candidates, req: PlanIn) -> tuple[str, str]:
    lang = "English" if req.language == "en" else "Korean"
    system = (
        "You are a travel planner for Seongbuk-gu, Seoul. Pick items ONLY from the candidate lists by id. "
        "Never invent places, prices, dates or opening hours. A student buddy is REQUIRED with a dorm stay: pick one buddy "
        "on a listed date, preferring a buddy from the same university as the dorm. Courses are free walking routes; pick "
        "one course for the buddy to walk with the traveler on the buddy date (or null). Keep the budget if possible. "
        "Return ONLY a JSON object: {\"dorm_id\": int, \"buddy_id\": int, \"buddy_date\": \"YYYY-MM-DD\", "
        "\"course_id\": int|null, \"free_place_ids\": [int, ...], "
        f"\"reason\": string}}. Write \"reason\" in {lang}, at most 2 short sentences, friendly, no prices."
    )
    lines = [
        f"Stay: {req.check_in} to {req.check_out} ({c.nights} nights). Budget: {req.budget or 'no limit'} KRW.",
        f"Interests: {', '.join(req.interests) or 'none'}. Note: {req.note or '-'}",
        "Dorm candidates (id, university id, university, building, room type, total price for the stay):",
        *[f"- {d.room.id}, {d.room.university_id}, {d.uni.name_en if d.uni else '-'}, {d.room.building}, {d.room.room_type}, {d.price}"
          for d in c.dorms],
        "Buddy candidates (id, date, name, university id, interests, languages, price):",
        *[f"- {b.buddy.id}, {b.day}, {b.name}, {b.buddy.university_id}, {'/'.join(b.buddy.interests or [])}, "
          f"{'/'.join(b.buddy.languages or [])}, {b.price}" for b in c.buddies[:10]],
        "Course candidates (id, date, title, theme, stops) — free:",
        *[f"- {t.tour.id}, {t.day}, {t.tour.title_en}, {t.tour.theme}, {' > '.join(t.place_names)}" for t in c.courses[:10]],
        "Free-time place candidates (id, name, tags):",
        *[f"- {p.place.id}, {p.place.name_en}, {'/'.join(p.place.tags or [])}" for p in c.places[:12]],
    ]
    return system, "\n".join(lines)


def _reason_template(ch: Choice, req: PlanIn, warnings: list[str]) -> str:
    en = req.language == "en"
    names = (INTEREST_EN if en else INTEREST_KO)
    topic = ", ".join(names.get(i, i) for i in req.interests[:2]) or ("Seongbuk history" if en else "성북 역사")
    b, co = ch.buddy, ch.course
    if en:
        parts = [f"Built around your interest in {topic}."]
        if b:
            parts.append(f"On {b.day:%b %d} {b.name} walks " + (f"the free '{co.tour.title_en}' course with you." if co else "the neighborhood with you."))
            parts.append("The AI tells the story of each place.")
        elif co:
            parts.append(f"The free '{co.tour.title_en}' course fits {co.day:%b %d}.")
    else:
        parts = [f"{topic} 관심에 맞춰 짰어요."]
        if b:
            parts.append(f"{b.day.month}/{b.day.day} 버디 {b.name}와 " + (f"'{co.tour.title}' 코스를 걸어요." if co else "동네를 걸어요."))
            parts.append("장소마다 AI가 이야기를 들려줘요.")
        elif co:
            parts.append(f"{co.day.month}/{co.day.day} 무료 '{co.tour.title}' 코스를 넣었어요.")
    return " ".join(parts + _warning_text(warnings, en))


def _warning_text(warnings: list[str], en: bool) -> list[str]:
    out = []
    if "NO_BUDDY" in warnings:
        out.append("No buddy is free during this stay, so try other dates." if en else "이 기간에 함께할 버디가 없어요. 날짜를 바꿔 보세요.")
    if "OVER_BUDGET" in warnings:
        out.append("A buddy is required with a stay, so this is a little over budget." if en else "숙박에는 버디가 꼭 필요해서 예산을 조금 넘어요.")
    return out


def order_free(picks: list[PlaceC], routes: courses.Routes | None = None) -> tuple[list[PlaceC], int | None, int | None]:
    """v3.8 그날 자유 장소를 걷는 거리가 가장 짧은 순서로. (순서, 걷는 m 10 m 단위, 걷는 분) — 한 곳이면 걷는 값은 None"""
    by_id = {p.place.id: p for p in picks}
    stops = [courses.Stop(p.place.id, p.place.lat, p.place.lng, p.place.stay_min or 0) for p in picks]
    ordered = courses.best_order(stops, routes=routes)
    if len(ordered) < 2:
        return [by_id[s.place_id] for s in ordered], None, None
    ct = courses.summarize(ordered, routes)
    if not ct.walk_complete:
        return [by_id[s.place_id] for s in ordered], None, None
    return [by_id[s.place_id] for s in ordered], ct.walk_m_total, ct.walk_min_total


def assemble(c: Candidates, ch: Choice, req: PlanIn,
             routes: courses.Routes | None = None) -> tuple[list[PlanDay], int, str, list[str]]:
    """일정 조립. routes = 자유 장소 사이 저장한 실제 도보 경로 (routers/ai.py가 한 번 읽어 넘긴다)"""
    en = req.language == "en"
    budget = req.budget or None
    warnings: list[str] = []
    total = (ch.dorm.price if ch.dorm else 0) + (ch.buddy.price if ch.buddy else 0)
    if budget and total > budget:
        if ch.dorm and ch.buddy:  # 숙박이 있으면 버디는 빼지 않는다
            warnings.append("OVER_BUDGET")
        elif ch.buddy:
            total -= ch.buddy.price
            ch.buddy = None
    if ch.dorm and not ch.buddy:
        warnings.append("NO_BUDDY")
    if ch.buddy and ch.course and ch.course.day != ch.buddy.day:
        ch.course = None

    by_day: dict[date, list[PlanItem]] = {d: [] for d in c.days}
    if ch.dorm:
        r, u = ch.dorm.room, ch.dorm.uni
        title = f"{u.name_en if en and u else (u.name if u else '')} {r.building} " + ("check-in" if en else "체크인")
        meta = (f"Stay · {ROOM_EN.get(r.room_type, r.room_type)} · ₩{r.price_per_night:,}/night · {c.nights} nights" if en
                else f"숙박 · {ROOM_KO.get(r.room_type, r.room_type)} · ₩{r.price_per_night:,}/박 · {c.nights}박")
        by_day[c.days[0]].append(PlanItem(time=CHECK_IN_TIME, type="dorm", ref_id=r.id, title=title.strip(), price=ch.dorm.price, meta=meta))
    co = ch.course
    check_in_day = c.days[0] if ch.dorm else None  # 숙소가 있을 때만 '도착 전' 문제가 생긴다
    if ch.buddy:
        b = ch.buddy
        lang_names = LANGUAGE["en" if en else "ko"]
        langs = "·".join(lang_names.get(code, code) for code in b.buddy.languages or [])
        stops = " · ".join(co.place_names) if co else ""
        if en:
            title = f"Walk '{co.tour.title_en}' with buddy {b.name}" if co else f"Walk the neighborhood with {b.name}"
            meta = f"Buddy {b.name} · {langs} · {BUDDY_HOURS}h" + (f" · {stops}" if co else "")
        else:
            title = f"버디 {b.name}와 {co.tour.title}" if co else f"버디 {b.name}와 캠퍼스·동네 걷기"
            meta = f"버디 {b.name} · {langs} · {BUDDY_HOURS}시간" + (f" · {stops}" if co else "")
        when = AFTER_CHECK_IN if b.day == check_in_day else BUDDY_TIME
        by_day[b.day].append(PlanItem(time=when, type="buddy", ref_id=b.buddy.id, title=title, price=b.price, meta=meta,
                                      course_id=co.tour.id if co else None))
    elif co:
        n = len(co.place_names)
        when = AFTER_CHECK_IN if co.day == check_in_day else COURSE_TIME
        by_day[co.day].append(PlanItem(time=when, type="course", ref_id=co.tour.id, title=co.tour.title_en if en else co.tour.title,
                                       price=0, meta=f"Free course · {n} places" if en else f"무료 코스 · 장소 {n}곳"))

    # 자유 일정: 코스가 없는 활동일마다 그날 문 여는 장소 2곳
    places = {p.place.id: p for p in c.places}
    queue = [places[i] for i in ch.free_place_ids if i in places]
    for d in c.activity_days:
        if co and d == co.day:
            continue
        picks = [p for p in queue if d in p.open_days][:2]  # 어느 장소인지는 LLM(또는 점수)이 고른 것
        if not picks:
            continue
        for p in picks:
            queue.remove(p)
        picks, walk_m, walk_min = order_free(picks, routes)  # 순서는 코드가 (걷는 거리 최소)
        names = " · ".join(p.place.name_en if en else p.place.name for p in picks)
        meta = "Free time · AI pick" if en else "자유 일정 · AI 제안"
        if walk_min is not None:
            meta += f" · {walk_min} min walk between" if en else f" · 사이 도보 {walk_min}분"
        by_day[d].append(PlanItem(time=None, type="free", ref_id=None,
                                  title=f"{names} " + ("(suggested)" if en else "추천"), price=0, meta=meta,
                                  place_ids=[p.place.id for p in picks], walk_m=walk_m, walk_min=walk_min))
    if len(c.days) > 1:
        by_day[c.days[-1]].append(PlanItem(time="11:00", type="free", ref_id=None, title="Check-out" if en else "체크아웃",
                                           price=0, meta="Stay" if en else "숙박"))

    for items in by_day.values():
        items.sort(key=lambda it: it.time or "99:99")
    days = [PlanDay(date=d, items=by_day[d]) for d in c.days]
    reason = ch.reason or _reason_template(ch, req, warnings)
    if ch.reason and warnings:
        reason = " ".join([reason, *_warning_text(warnings, en)])
    return days, total, reason, warnings
