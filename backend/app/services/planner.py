"""AI-01 여행 설계: 후보는 코드가 DB에서 거르고, LLM은 고르기·설명만 한다.

1) 후보 만들기 (코드): 숙소(개방 기간·잔여 객실·예산), 투어(운영 요일·코스 장소 휴관일),
   버디(승인·가능 날짜·언어), 자유 일정 장소(관심사·휴관일). 가격·날짜는 전부 DB 값.
2) 고르기: LLM이 후보 id 중에서 투어·버디·자유 장소를 고르고 추천 이유를 쓴다.
   LLM이 없거나 실패하거나 후보에 없는 id를 내면 점수 순 규칙 기반 선택(폴백)으로 대신한다.
3) 일정 조립 (코드): 날짜별 항목, 예산 초과 시 버디 → 투어 순으로 뺀다.
"""
from dataclasses import dataclass, field
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    BuddyAvailability,
    BuddyProfile,
    DormRoom,
    Guide,
    Place,
    Tour,
    TourPlace,
    University,
    User,
)
from app.schemas.ai import PlanDay, PlanIn, PlanItem
from app.services.availability import occupied_rooms

WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
BUDDY_HOURS = 2
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
class TourC:
    tour: Tour
    day: date
    score: float
    place_names: list[str]
    guide_name: str


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
    activity_days: list[date]  # 투어·버디·자유 일정을 넣을 날
    dorms: list[DormC]         # 개방·잔여 객실·예산 통과, 싼 순
    tours: list[TourC]
    buddies: list[BuddyC]
    places: list[PlaceC]


@dataclass
class Choice:
    dorm: DormC | None
    tour: TourC | None
    buddy: BuddyC | None
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

    # 투어: 운영 요일이고, 코스의 모든 장소가 그날 문을 여는 날짜만
    tours: list[TourC] = []
    for t in db.scalars(select(Tour).order_by(Tour.id)).all():
        stops = db.scalars(select(TourPlace).where(TourPlace.tour_id == t.id).order_by(TourPlace.seq)).all()
        stop_places = [places[s.place_id] for s in stops if s.place_id in places]
        tags = {tag for p in stop_places for tag in (p.tags or [])}
        score = (3 if t.theme in interests else 0) + len(tags & interests)
        g = db.get(Guide, t.guide_id)
        gu = db.get(User, g.user_id) if g else None
        for d in activity_days:
            if _wd(d) in (t.operating_days or []) and all(_open_on(p, d) for p in stop_places):
                tours.append(TourC(t, d, score, [p.name for p in stop_places], gu.name if gu else ""))
    tours.sort(key=lambda c: (-c.score, c.day, c.tour.id))

    # 버디: 승인, 가능 날짜, 요청 언어 구사
    buddies: list[BuddyC] = []
    if req.with_buddy:
        for b in db.scalars(select(BuddyProfile).where(BuddyProfile.status == "approved").order_by(BuddyProfile.id)).all():
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

    return Candidates(nights, days, activity_days, dorms, tours, buddies, pcs)


def fallback_choice(c: Candidates) -> Choice:
    """점수가 가장 높은 투어, 그 투어 날(없으면 가장 이른 날)의 버디, 관심사 장소 상위.
    숙소는 버디와 같은 대학의 방을 우선하고, 없으면 가장 싼 방."""
    tour = c.tours[0] if c.tours else None
    buddy = None
    if c.buddies:
        same_day = [b for b in c.buddies if tour and b.day == tour.day and b.score == c.buddies[0].score]
        buddy = same_day[0] if same_day else c.buddies[0]
    dorm = None
    if c.dorms:
        same_uni = [d for d in c.dorms if buddy and d.room.university_id == buddy.buddy.university_id]
        dorm = same_uni[0] if same_uni else c.dorms[0]
    taken = {p.place.id for p in c.places if tour and p.place.name in tour.place_names}
    free = [p.place.id for p in c.places if p.place.id not in taken][:6]
    return Choice(dorm, tour, buddy, free)


def validate_choice(c: Candidates, data: dict) -> Choice:
    """LLM 응답을 후보와 대조한다. 후보에 없는 id·날짜는 버리고, 빈 자리는 폴백으로 채운다."""
    fb = fallback_choice(c)
    dorm = next((d for d in c.dorms if d.room.id == data.get("dorm_id")), None) or fb.dorm
    tour = next((t for t in c.tours if t.tour.id == data.get("tour_id") and str(t.day) == str(data.get("tour_date"))), None)
    if data.get("tour_id") is None and "tour_id" in data:
        tour = None
    elif tour is None:
        tour = fb.tour
    buddy = next((b for b in c.buddies if b.buddy.id == data.get("buddy_id") and str(b.day) == str(data.get("buddy_date"))), None)
    if data.get("buddy_id") is None and "buddy_id" in data:
        buddy = None
    elif buddy is None:
        buddy = fb.buddy
    valid_places = {p.place.id for p in c.places}
    free = [i for i in data.get("free_place_ids", []) if isinstance(i, int) and i in valid_places] or fb.free_place_ids
    reason = data.get("reason") if isinstance(data.get("reason"), str) and data.get("reason").strip() else None
    return Choice(dorm, tour, buddy, free, reason)


def llm_prompt(c: Candidates, req: PlanIn) -> tuple[str, str]:
    lang = "English" if req.language == "en" else "Korean"
    system = (
        "You are a travel planner for Seongbuk-gu, Seoul. Pick items ONLY from the candidate lists by id. "
        "Never invent places, prices, dates or opening hours. Prefer the traveler's interests, keep the budget, "
        "and avoid putting the buddy on a day the buddy is not listed for. "
        "Return ONLY a JSON object: {\"dorm_id\": int, \"tour_id\": int|null, \"tour_date\": \"YYYY-MM-DD\"|null, "
        "\"buddy_id\": int|null, \"buddy_date\": \"YYYY-MM-DD\"|null, \"free_place_ids\": [int, ...], "
        f"\"reason\": string}}. Write \"reason\" in {lang}, at most 2 short sentences, friendly, no prices."
    )
    lines = [
        f"Stay: {req.check_in} to {req.check_out} ({c.nights} nights). Budget: {req.budget or 'no limit'} KRW.",
        f"Interests: {', '.join(req.interests) or 'none'}. Wants a buddy: {req.with_buddy}. Note: {req.note or '-'}",
        "Dorm candidates (id, university, building, room type, total price for the stay):",
        *[f"- {d.room.id}, {d.uni.name_en if d.uni else '-'}, {d.room.building}, {d.room.room_type}, {d.price}"
          for d in c.dorms],
        "Tour candidates (id, date, title, theme, price, stops):",
        *[f"- {t.tour.id}, {t.day}, {t.tour.title_en}, {t.tour.theme}, {t.tour.price}, {' > '.join(t.place_names)}"
          for t in c.tours[:8]],
        "Buddy candidates (id, date, name, interests, languages, price):",
        *[f"- {b.buddy.id}, {b.day}, {b.name}, {'/'.join(b.buddy.interests or [])}, {'/'.join(b.buddy.languages or [])}, {b.price}"
          for b in c.buddies[:8]],
        "Free-time place candidates (id, name, tags):",
        *[f"- {p.place.id}, {p.place.name_en}, {'/'.join(p.place.tags or [])}" for p in c.places[:12]],
    ]
    return system, "\n".join(lines)


def _reason_template(c: Candidates, ch: Choice, req: PlanIn, over_budget: bool) -> str:
    en = req.language == "en"
    names = (INTEREST_EN if en else INTEREST_KO)
    topic = ", ".join(names.get(i, i) for i in req.interests[:2]) or ("Seongbuk history" if en else "성북 역사")
    parts = []
    if en:
        parts.append(f"Built around your interest in {topic}.")
        if ch.tour:
            parts.append(f"The guided '{ch.tour.tour.title_en}' runs on {ch.tour.day:%b %d}" + (f", and {ch.buddy.name} can walk the neighborhood with you." if ch.buddy else "."))
        elif ch.buddy:
            parts.append(f"{ch.buddy.name} can walk the neighborhood with you.")
        if over_budget:
            parts.append("Some items were dropped to fit your budget.")
    else:
        parts.append(f"{topic} 관심에 맞춰 짰어요.")
        if ch.tour:
            parts.append(f"{ch.tour.day.month}/{ch.tour.day.day} '{ch.tour.tour.title}' 투어" + (f"와 버디 {ch.buddy.name}의 동네 산책을 넣었어요." if ch.buddy else "를 넣었어요."))
        elif ch.buddy:
            parts.append(f"버디 {ch.buddy.name}와 동네를 걸을 수 있어요.")
        if over_budget:
            parts.append("예산에 맞추느라 일부 항목을 뺐어요.")
    return " ".join(parts)


def assemble(c: Candidates, ch: Choice, req: PlanIn) -> tuple[list[PlanDay], int, str]:
    en = req.language == "en"
    budget = req.budget or None
    over = False
    dorm_price = ch.dorm.price if ch.dorm else 0
    # 예산 초과 시 버디 → 투어 순으로 뺀다
    total = dorm_price + (ch.tour.tour.price if ch.tour else 0) + (ch.buddy.price if ch.buddy else 0)
    if budget and total > budget and ch.buddy:
        total -= ch.buddy.price
        ch.buddy, over = None, True
    if budget and total > budget and ch.tour:
        total -= ch.tour.tour.price
        ch.tour, over = None, True

    by_day: dict[date, list[PlanItem]] = {d: [] for d in c.days}
    if ch.dorm:
        r, u = ch.dorm.room, ch.dorm.uni
        title = f"{u.name_en if en and u else (u.name if u else '')} {r.building} " + ("check-in" if en else "체크인")
        meta = (f"Stay · {ROOM_EN.get(r.room_type, r.room_type)} · ₩{r.price_per_night:,}/night · {c.nights} nights" if en
                else f"숙박 · {ROOM_KO.get(r.room_type, r.room_type)} · ₩{r.price_per_night:,}/박 · {c.nights}박")
        by_day[c.days[0]].append(PlanItem(time="15:00", type="dorm", ref_id=r.id, title=title.strip(), price=ch.dorm.price, meta=meta))
    if ch.tour:
        t = ch.tour
        hours = round(t.tour.duration_min / 60, 1)
        by_day[t.day].append(PlanItem(
            time="10:00", type="tour", ref_id=t.tour.id, title=t.tour.title_en if en else t.tour.title, price=t.tour.price,
            meta=(f"Tour · guide {t.guide_name} · {hours:g}h" if en else f"투어 · 해설사 {t.guide_name} · {hours:g}시간")))
    if ch.buddy:
        b = ch.buddy
        langs = "/".join(b.buddy.languages or [])
        by_day[b.day].append(PlanItem(
            time="14:00", type="buddy", ref_id=b.buddy.id,
            title=(f"Walk the neighborhood with {b.name}" if en else f"버디 {b.name}와 캠퍼스·동네 걷기"), price=b.price,
            meta=(f"Buddy {b.name} · {langs} · {BUDDY_HOURS}h" if en else f"버디 {b.name} · {langs} · {BUDDY_HOURS}시간")))

    # 자유 일정: 투어가 없는 활동일마다 그날 문 여는 장소 2곳
    places = {p.place.id: p for p in c.places}
    queue = [places[i] for i in ch.free_place_ids if i in places]
    for d in c.activity_days:
        if any(it.type == "tour" for it in by_day[d]):
            continue
        picks = [p for p in queue if d in p.open_days][:2]
        if not picks:
            continue
        for p in picks:
            queue.remove(p)
        names = " · ".join(p.place.name_en if en else p.place.name for p in picks)
        by_day[d].append(PlanItem(time=None, type="free", ref_id=None,
                                  title=f"{names} " + ("(suggested)" if en else "추천"), price=0,
                                  meta="Free time · AI pick" if en else "자유 일정 · AI 제안"))
    if len(c.days) > 1:
        by_day[c.days[-1]].append(PlanItem(time="11:00", type="free", ref_id=None, title="Check-out" if en else "체크아웃",
                                           price=0, meta="Stay" if en else "숙박"))

    for items in by_day.values():
        items.sort(key=lambda it: it.time or "99:99")
    days = [PlanDay(date=d, items=by_day[d]) for d in c.days]
    reason = ch.reason or _reason_template(c, ch, req, over)
    if over and ch.reason:
        reason += " " + ("Some items were dropped to fit your budget." if en else "예산에 맞추느라 일부 항목을 뺐어요.")
    return days, total, reason
