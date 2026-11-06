"""예약 생성·승인·취소·버디 바꾸기 — 상태 전이는 이 파일에서만 바꾼다 (B 담당).

v3: 예약 항목은 dorm | buddy 두 가지. 코스(tours)는 무료라 예약하지 않는다.
booking_items.status: requested → approved | rejected → confirmed → cancelled (buddy 수락은 바로 confirmed)
bookings.status:      requested → partially_approved → confirmed | cancelled
"""
import logging
from datetime import UTC, date, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import rules
from app.core.config import get_settings
from app.models.booking import Booking, BookingItem, MealClaim, Notification, Review
from app.models.supply import BuddyActivity, BuddyProfile, DormRoom, Place, Tour, University
from app.models.user import User
from app.schemas.bookings import BookingItemIn, BookingItemOut, BookingOut, TravelerIn
from app.services import google_calendar
from app.services.availability import nights_between, occupied_rooms

log = logging.getLogger(__name__)
OK = {"approved", "confirmed"}
ACTIVE = {"requested", "approved", "confirmed"}
LIVE = ACTIVE  # 총액·수수료 계산에 넣는 항목 상태


class BookingError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status, self.code, self.message = status, code, message


def today() -> date:
    return get_settings().today()


# ---------- 조회용 표현
def _fmt_d(d: date | None) -> str:
    return f"{d.month}/{d.day}" if d else ""


def describe(db: Session, it: BookingItem) -> tuple[str, str]:
    """항목의 title·meta (프론트 표시용). 사실 값은 DB에서만."""
    if it.type == "dorm":
        room = db.get(DormRoom, it.ref_id)
        uni = db.get(University, room.university_id) if room else None
        rt = {"single": "1인실", "double": "2인실", "twin": "트윈"}.get(room.room_type, room.room_type) if room else ""
        title = f"{uni.name if uni else ''} {room.building if room else ''} {rt}".strip()
        nights = nights_between(it.date_from, it.date_to) if it.date_to else 0
        return title, f"{_fmt_d(it.date_from)} – {_fmt_d(it.date_to)} · {nights}박 · 대학 승인 필요" if it.status == "requested" else f"{_fmt_d(it.date_from)} – {_fmt_d(it.date_to)} · {nights}박"
    if it.type == "buddy":
        prof = db.get(BuddyProfile, it.ref_id)
        buser = db.get(User, prof.user_id) if prof else None
        name = buser.name if buser else "버디"
        hours = (it.duration_min or 120) // 60
        suffix = " · 버디 수락 필요" if it.status == "requested" else ""
        return f"{name}와 동네 걷기", f"{_fmt_d(it.date_from)} {it.time or ''} · {hours}시간{suffix}"
    return it.type, ""


def meal_sums(db: Session, item_id: int) -> tuple[int, int]:
    """(requested+approved 합, approved 합)"""
    rows = db.execute(select(MealClaim.status, func.sum(MealClaim.amount)).where(MealClaim.booking_item_id == item_id)
                      .group_by(MealClaim.status)).all()
    by = {s: int(a or 0) for s, a in rows}
    return by.get("requested", 0) + by.get("approved", 0), by.get("approved", 0)


def album_photos(db: Session, item_id: int) -> list[str]:
    acts = db.scalars(select(BuddyActivity).where(BuddyActivity.booking_item_id == item_id).order_by(BuddyActivity.id)).all()
    return [p for a in acts for p in (a.photos or [])]


def item_out(db: Session, it: BookingItem, show_request: bool = True) -> BookingItemOut:
    title, meta = describe(db, it)
    course = db.get(Tour, it.course_id) if it.course_id else None
    used, approved = meal_sums(db, it.id) if it.meal_count else (0, 0)
    reviewed = db.scalar(select(Review.id).where(Review.booking_item_id == it.id)) is not None
    return BookingItemOut(
        id=it.id, type=it.type, ref_id=it.ref_id, title=title, meta=meta, status=it.status, price=it.price,
        date_from=it.date_from, date_to=it.date_to, time=it.time, duration_min=it.duration_min,
        reject_reason=it.reject_reason, google_event_id=it.google_event_id, decided_at=it.decided_at,
        request=it.request if show_request else None, course_id=it.course_id, course_title=course.title if course else None,
        meal_count=it.meal_count or 0, meal_deposit=it.meal_deposit or 0, meal_used=used, meal_approved=approved,
        meal_refund=(it.meal_deposit or 0) - approved, album=bool(it.album),
        album_photos=len(album_photos(db, it.id)) if it.album else 0,
        reviewed=reviewed, can_review=it.status in OK and it.date_from <= today() and not reviewed,
    )


# ---------- 개인정보: 누가 무엇을 보나 (BK-03)
def item_owner_university(db: Session, it: BookingItem) -> int | None:
    if it.type == "dorm":
        room = db.get(DormRoom, it.ref_id)
        return room.university_id if room else None
    prof = db.get(BuddyProfile, it.ref_id) if it.type == "buddy" else None
    return prof.university_id if prof else None


def is_supplier(db: Session, actor: User, it: BookingItem) -> bool:
    """이 항목의 공급자 본인인가 (숙박 → 그 대학 담당자, 버디 → 그 버디)"""
    if it.type == "dorm" and actor.role == "univ_admin":
        return item_owner_university(db, it) == actor.university_id
    if it.type == "buddy" and actor.role == "buddy":
        prof = db.get(BuddyProfile, it.ref_id)
        return bool(prof) and prof.user_id == actor.id
    return False


def minimal_traveler(trav: dict | None) -> dict:
    t = trav or {}
    return {"name": t.get("name"), "nationality": t.get("nationality"), "guests": t.get("guests", 1)}


def booking_out(db: Session, b: Booking, viewer: User | None = None) -> BookingOut:
    """viewer가 없거나 본인·운영자면 전부. 대학 담당자는 자기 숙박 항목이 있으면 traveler 전체,
    버디는 traveler 최소 정보 + 자기 항목만. 남의 항목 request는 내보내지 않는다."""
    items = db.scalars(select(BookingItem).where(BookingItem.booking_id == b.id).order_by(BookingItem.id)).all()
    traveler = b.traveler
    full = viewer is None or viewer.role == "operator" or viewer.id == b.tourist_id
    if full:
        outs = [item_out(db, i) for i in items]
    elif viewer.role == "buddy":
        traveler = minimal_traveler(b.traveler)
        outs = [item_out(db, i) for i in items if is_supplier(db, viewer, i)]
    else:  # univ_admin
        own_dorm = any(i.type == "dorm" and is_supplier(db, viewer, i) for i in items)
        traveler = b.traveler if own_dorm else minimal_traveler(b.traveler)
        outs = [item_out(db, i, show_request=is_supplier(db, viewer, i)) for i in items]
    return BookingOut(
        id=b.id, code=b.code, status=b.status, total_price=b.total_price, platform_fee=b.platform_fee, traveler=traveler,
        items=outs, created_at=b.created_at, paid_at=b.paid_at, cancelled_at=b.cancelled_at,
        payment=_payment_summary(db, b.id),
    )


def can_view(db: Session, actor: User, b: Booking) -> bool:
    if actor.role == "operator" or b.tourist_id == actor.id:
        return True
    items = db.scalars(select(BookingItem).where(BookingItem.booking_id == b.id)).all()
    if actor.role == "univ_admin":
        return any(item_owner_university(db, i) == actor.university_id for i in items)
    return any(is_supplier(db, actor, i) for i in items)


def _payment_summary(db: Session, booking_id: int) -> dict | None:
    from app.services import payments  # 순환 import 방지

    return payments.summary(payments.paid(db, booking_id) or payments.latest(db, booking_id))


# ---------- 요청·가격 검증
def _subset(values, allowed: dict, name: str) -> list[str]:
    if values is None:
        return []
    if not isinstance(values, list) or any(v not in allowed for v in values):
        raise BookingError(422, "VALIDATION", f"{name} 값이 올바르지 않습니다 ({', '.join(allowed)})")
    return list(dict.fromkeys(values))


def clean_request(db: Session, item_type: str, req: dict | None) -> dict | None:
    """요청 JSON을 코드값으로만 남긴다. 모르는 키·값이면 422 VALIDATION."""
    if req is None:
        return None
    if not isinstance(req, dict):
        raise BookingError(422, "VALIDATION", "request는 객체여야 합니다")
    if item_type == "dorm":
        if set(req) - set(rules.DORM_REQUESTS) or any(not isinstance(v, bool) for v in req.values()):
            raise BookingError(422, "VALIDATION", "숙박 요청은 late_checkin·quiet_room·low_floor (true/false)")
        return {k: bool(req.get(k, False)) for k in rules.DORM_REQUESTS}
    if set(req) - {"diet", "allergies", "pace", "places", "note"}:
        raise BookingError(422, "VALIDATION", "버디 요청은 diet·allergies·pace·places·note")
    pace = req.get("pace") or "normal"
    if pace not in rules.PACE:
        raise BookingError(422, "VALIDATION", "pace는 slow | normal")
    places = req.get("places") or []
    if not isinstance(places, list) or len(places) > 3 or any(not isinstance(p, int) or not db.get(Place, p) for p in places):
        raise BookingError(422, "VALIDATION", "places는 장소 id 최대 3개")
    note = req.get("note") or ""
    if not isinstance(note, str) or len(note) > 300:
        raise BookingError(422, "VALIDATION", "note는 300자 이하")
    return {"diet": _subset(req.get("diet"), rules.DIET, "diet"), "allergies": _subset(req.get("allergies"), rules.ALLERGIES, "allergies"),
            "pace": pace, "places": places, "note": note}


def buddy_price(prof: BuddyProfile, duration_min: int, album: bool, meal_count: int) -> tuple[int, int]:
    """(항목 가격, 식사 보증금). 가격 = 시간당 × 시간 + 앨범 + 보증금"""
    deposit = meal_count * rules.MEAL_LIMIT
    return prof.hourly_fee * max(duration_min // 60, 1) + (rules.ALBUM_FEE if album else 0) + deposit, deposit


def _price_and_validate(db: Session, it: BookingItemIn) -> tuple[int, dict]:
    if it.type == "dorm":
        room = db.get(DormRoom, it.ref_id)
        if not room or not room.active:
            raise BookingError(404, "NOT_FOUND", "객실을 찾을 수 없습니다")
        if not it.date_from or not it.date_to or it.date_to <= it.date_from:
            raise BookingError(422, "VALIDATION", "숙박은 date_from < date_to 가 필요합니다")
        uni = db.get(University, room.university_id)
        open_from, open_to = room.open_from or uni.open_from, room.open_to or uni.open_to
        if open_from and open_to and (it.date_from < open_from or it.date_to > open_to):
            raise BookingError(422, "VALIDATION", "개방 기간 밖의 날짜입니다")
        if occupied_rooms(db, room.id, it.date_from, it.date_to) >= room.total_rooms:
            raise BookingError(409, "CONFLICT", "해당 기간에 남은 객실이 없습니다")
        nights = nights_between(it.date_from, it.date_to)
        return room.price_per_night * nights, {"date_from": it.date_from, "date_to": it.date_to, "guests": it.guests or 1,
                                               "request": clean_request(db, "dorm", it.request)}
    if it.type == "buddy":
        prof = db.get(BuddyProfile, it.ref_id)
        if not prof or prof.status != "approved":
            raise BookingError(404, "NOT_FOUND", "버디를 찾을 수 없습니다")
        d = it.date or it.date_from
        if not d:
            raise BookingError(422, "VALIDATION", "동행 날짜가 필요합니다")
        if not 0 <= it.meal_count <= rules.MEAL_MAX:
            raise BookingError(422, "VALIDATION", f"meal_count는 0~{rules.MEAL_MAX}")
        if it.course_id is not None and not db.get(Tour, it.course_id):
            raise BookingError(422, "VALIDATION", "course_id 코스가 없습니다")
        dur = it.duration_min or 120
        price, deposit = buddy_price(prof, dur, it.album, it.meal_count)
        return price, {"date_from": d, "time": it.time, "duration_min": dur, "request": clean_request(db, "buddy", it.request),
                       "course_id": it.course_id, "meal_count": it.meal_count, "meal_deposit": deposit, "album": it.album}
    raise BookingError(422, "VALIDATION", "type은 dorm | buddy")


def check_stay_rules(items: list[BookingItemIn]) -> None:
    """COURSE_NOT_BOOKABLE · ONE_STAY · BUDDY_REQUIRED · BUDDY_OUT_OF_STAY"""
    if any(i.type == "tour" for i in items):
        raise BookingError(422, "COURSE_NOT_BOOKABLE", "코스는 무료라 예약하지 않아요. 버디 항목의 course_id로 골라 주세요")
    dorms = [i for i in items if i.type == "dorm"]
    buddies = [i for i in items if i.type == "buddy"]
    if len(dorms) > 1:
        raise BookingError(422, "ONE_STAY", "한 예약에는 숙박을 1개만 담을 수 있어요")
    if dorms and not buddies:
        raise BookingError(422, "BUDDY_REQUIRED", "기숙사 숙박에는 버디가 1명 필요해요")
    if dorms and dorms[0].date_from and dorms[0].date_to:
        for b in buddies:
            in_stay(dorms[0].date_from, dorms[0].date_to, b.date or b.date_from)


def in_stay(date_from: date, date_to: date, d: date | None) -> None:
    if d and not date_from <= d <= date_to:
        raise BookingError(422, "BUDDY_OUT_OF_STAY", f"버디 날짜는 숙박 기간({_fmt_d(date_from)}–{_fmt_d(date_to)}) 안이어야 해요")


def next_code(db: Session, when: date) -> str:
    prefix = f"SB-{when.year}-"
    last = db.scalar(select(Booking.code).where(Booking.code.like(prefix + "%")).order_by(Booking.code.desc()))
    n = int(last.rsplit("-", 1)[1]) + 1 if last else 1
    return f"{prefix}{n:04d}"


def album_fee(it: BookingItem) -> int:
    return rules.ALBUM_FEE if it.type == "buddy" and it.album else 0


def recompute_totals(db: Session, booking: Booking) -> None:
    """총액 = 살아 있는 항목 가격 합.
    수수료 = (총액 − 식사 보증금 − 앨범) × 10% + 앨범 (앨범은 전액 플랫폼 수입, 식사 보증금에는 수수료 없음)"""
    items = db.scalars(select(BookingItem).where(BookingItem.booking_id == booking.id, BookingItem.status.in_(LIVE))).all()
    booking.total_price = sum(i.price for i in items)
    albums = sum(album_fee(i) for i in items)
    base = booking.total_price - sum(i.meal_deposit or 0 for i in items) - albums
    booking.platform_fee = round(base * get_settings().platform_fee_rate) + albums


def create_booking(db: Session, tourist: User, traveler: TravelerIn, items: list[BookingItemIn]) -> Booking:
    check_stay_rules(items)
    priced = [(it, *_price_and_validate(db, it)) for it in items]
    has_dorm = any(it.type == "dorm" for it in items)
    traveler_dict = traveler.model_dump()
    if not has_dorm:
        traveler_dict.pop("passport_no", None)  # 숙박 없으면 여권 수집 안 함
    first_date = min((f.get("date_from") for _, _, f in priced if f.get("date_from")), default=today())
    booking = Booking(code=next_code(db, first_date), tourist_id=tourist.id, status="requested", traveler=traveler_dict)
    db.add(booking)
    db.flush()
    for it, price, fields in priced:
        db.add(BookingItem(booking_id=booking.id, type=it.type, ref_id=it.ref_id, price=price, status="requested", **fields))
    db.flush()
    recompute_totals(db, booking)
    recompute_booking_status(db, booking)
    db.commit()
    db.refresh(booking)
    return booking


# ---------- 버디 바꾸기
def replace_buddy(db: Session, actor: User, booking: Booking, it: BookingItem, buddy_id: int,
                  new_date: date | None = None, new_time: str | None = None) -> Booking:
    if booking.tourist_id != actor.id:
        raise BookingError(403, "FORBIDDEN", "본인 예약만 바꿀 수 있습니다")
    if it.type != "buddy":
        raise BookingError(422, "VALIDATION", "버디 항목만 바꿀 수 있습니다")
    if it.status not in ("requested", "rejected", "confirmed") or (it.status == "confirmed" and it.date_from <= today()):
        raise BookingError(409, "CONFLICT", "지금은 버디를 바꿀 수 없는 항목입니다")
    if buddy_id == it.ref_id:
        raise BookingError(422, "VALIDATION", "지금과 같은 버디입니다")
    prof = db.get(BuddyProfile, buddy_id)
    if not prof or prof.status != "approved":
        raise BookingError(404, "NOT_FOUND", "버디를 찾을 수 없습니다")
    d = new_date or it.date_from
    dorm = db.scalar(select(BookingItem).where(BookingItem.booking_id == booking.id, BookingItem.type == "dorm",
                                               BookingItem.status.in_(LIVE)))
    if dorm and dorm.date_to:
        in_stay(dorm.date_from, dorm.date_to, d)
    if it.status != "rejected":
        it.status = "cancelled"
        if it.google_event_id:
            _delete_calendar(db, it)
    dur = it.duration_min or 120
    price, deposit = buddy_price(prof, dur, bool(it.album), it.meal_count or 0)
    new = BookingItem(booking_id=booking.id, type="buddy", ref_id=prof.id, date_from=d, time=new_time or it.time,
                      duration_min=dur, price=price, status="requested", request=it.request, course_id=it.course_id,
                      meal_count=it.meal_count or 0, meal_deposit=deposit, album=bool(it.album))
    db.add(new)
    db.flush()
    recompute_totals(db, booking)
    recompute_booking_status(db, booking)
    db.add(Notification(user_id=prof.user_id, booking_item_id=new.id, type="item_requested",
                        title=f"{booking.code} · 새 동행 요청 {_fmt_d(d)}"))
    db.commit()
    db.refresh(booking)
    return booking


# ---------- 승인·거절
def can_decide(db: Session, actor: User, it: BookingItem) -> bool:
    return actor.role == "operator" or is_supplier(db, actor, it)


def decide_item(db: Session, actor: User, it: BookingItem, action: str, reason: str | None = None) -> Booking:
    if action not in ("approve", "reject"):
        raise BookingError(422, "VALIDATION", "action은 approve | reject")
    if not can_decide(db, actor, it):
        raise BookingError(403, "FORBIDDEN", "이 항목을 결정할 권한이 없습니다")
    if it.status != "requested":
        raise BookingError(409, "CONFLICT", "이미 결정된 항목입니다")
    if action == "approve":
        it.status = "confirmed" if it.type == "buddy" else "approved"
    else:
        it.status = "rejected"
        it.reject_reason = reason
    it.decided_by = actor.id
    it.decided_at = datetime.now(UTC)
    db.flush()
    booking = db.get(Booking, it.booking_id)
    recompute_booking_status(db, booking)
    title, _ = describe(db, it)
    label = "승인됨" if action == "approve" else "거절됨"
    db.add(Notification(user_id=booking.tourist_id, booking_item_id=it.id, type=f"item_{it.status}", title=f"{title} · {label}", body=reason))
    db.commit()
    if it.type == "buddy" and it.status in OK:
        _push_calendar(db, actor, it, title)
    db.refresh(booking)
    return booking


def _push_calendar(db: Session, actor: User, it: BookingItem, title: str) -> None:
    """캘린더 푸시는 실패해도 승인에 영향 없음 (로그만)."""
    if not actor.calendar_connected or not actor.google_refresh_token:
        return
    try:
        event_id = google_calendar.push_event(
            refresh_token_enc=actor.google_refresh_token, summary=f"[SB Stay] {title}",
            date_=it.date_from, time_=it.time, duration_min=it.duration_min or 120,
            description=f"예약 항목 #{it.id}",
        )
        it.google_event_id = event_id
        db.commit()
    except Exception as e:  # noqa: BLE001
        log.warning("calendar push failed for item %s: %s", it.id, e)


# ---------- 취소
def cancel_booking(db: Session, actor: User, booking: Booking) -> Booking:
    if actor.role != "operator" and booking.tourist_id != actor.id:
        raise BookingError(403, "FORBIDDEN", "본인 예약만 취소할 수 있습니다")
    if booking.status == "cancelled":
        raise BookingError(409, "CONFLICT", "이미 취소된 예약입니다")
    items = db.scalars(select(BookingItem).where(BookingItem.booking_id == booking.id)).all()
    for it in items:
        if it.status != "cancelled":
            it.status = "cancelled"
            if it.google_event_id:
                _delete_calendar(db, it)
    booking.status = "cancelled"
    booking.cancelled_at = datetime.now(UTC)
    db.add(Notification(user_id=booking.tourist_id, type="booking_cancelled", title=f"{booking.code} · 취소됨"))
    db.commit()
    db.refresh(booking)
    return booking


def _delete_calendar(db: Session, it: BookingItem) -> None:
    prof = db.get(BuddyProfile, it.ref_id) if it.type == "buddy" else None
    owner = db.get(User, prof.user_id) if prof else None
    if not owner or not owner.google_refresh_token:
        return
    try:
        google_calendar.delete_event(refresh_token_enc=owner.google_refresh_token, event_id=it.google_event_id)
    except Exception as e:  # noqa: BLE001
        log.warning("calendar delete failed for item %s: %s", it.id, e)


def recompute_booking_status(db: Session, booking: Booking) -> None:
    statuses = db.scalars(select(BookingItem.status).where(BookingItem.booking_id == booking.id)).all()
    if not statuses:
        return
    live = [s for s in statuses if s not in ("rejected", "cancelled")]  # 거절·바뀐(취소) 항목은 제외하고 판단
    if all(s == "cancelled" for s in statuses):
        booking.status = "cancelled"
    elif live and all(s in OK for s in live):
        booking.status = "confirmed"
    elif any(s in OK for s in statuses):
        booking.status = "partially_approved"
    else:
        booking.status = "requested"
