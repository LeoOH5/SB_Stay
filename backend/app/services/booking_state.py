"""예약 생성·승인·취소 — 상태 전이는 이 파일에서만 바꾼다 (B 담당).

booking_items.status: requested → approved | rejected → confirmed → cancelled (tour는 생성 즉시 confirmed, buddy 수락은 바로 confirmed)
bookings.status:      requested → partially_approved → confirmed | cancelled
"""
import logging
from datetime import UTC, date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.booking import Booking, BookingItem, Notification
from app.models.supply import BuddyProfile, DormRoom, Guide, Tour, University
from app.models.user import User
from app.schemas.bookings import BookingItemIn, BookingItemOut, BookingOut, TravelerIn
from app.services import google_calendar
from app.services.availability import nights_between, occupied_rooms

log = logging.getLogger(__name__)
OK = {"approved", "confirmed"}
ACTIVE = {"requested", "approved", "confirmed"}


class BookingError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status, self.code, self.message = status, code, message


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
    if it.type == "tour":
        tour = db.get(Tour, it.ref_id)
        guide = db.get(Guide, tour.guide_id) if tour else None
        guser = db.get(User, guide.user_id) if guide else None
        return (tour.title if tour else "투어"), f"{_fmt_d(it.date_from)} {it.time or ''} · 해설사 {guser.name if guser else ''} · {tour.meeting_point if tour else ''}".strip()
    if it.type == "buddy":
        prof = db.get(BuddyProfile, it.ref_id)
        buser = db.get(User, prof.user_id) if prof else None
        name = buser.name if buser else "버디"
        hours = (it.duration_min or 120) // 60
        suffix = " · 버디 수락 필요" if it.status == "requested" else ""
        return f"{name}와 동네 걷기", f"{_fmt_d(it.date_from)} {it.time or ''} · {hours}시간{suffix}"
    return it.type, ""


def item_out(db: Session, it: BookingItem) -> BookingItemOut:
    title, meta = describe(db, it)
    return BookingItemOut(
        id=it.id, type=it.type, ref_id=it.ref_id, title=title, meta=meta, status=it.status, price=it.price,
        date_from=it.date_from, date_to=it.date_to, time=it.time, duration_min=it.duration_min,
        reject_reason=it.reject_reason, google_event_id=it.google_event_id, decided_at=it.decided_at,
    )


def booking_out(db: Session, b: Booking) -> BookingOut:
    items = db.scalars(select(BookingItem).where(BookingItem.booking_id == b.id).order_by(BookingItem.id)).all()
    return BookingOut(
        id=b.id, code=b.code, status=b.status, total_price=b.total_price, platform_fee=b.platform_fee, traveler=b.traveler,
        items=[item_out(db, i) for i in items], created_at=b.created_at, paid_at=b.paid_at, cancelled_at=b.cancelled_at,
    )


# ---------- 생성
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
        return room.price_per_night * nights, {"date_from": it.date_from, "date_to": it.date_to, "guests": it.guests or 1}
    if it.type == "tour":
        tour = db.get(Tour, it.ref_id)
        if not tour:
            raise BookingError(404, "NOT_FOUND", "투어를 찾을 수 없습니다")
        d = it.date or it.date_from
        if not d:
            raise BookingError(422, "VALIDATION", "투어 날짜가 필요합니다")
        if tour.operating_days and d.strftime("%a").lower() not in tour.operating_days:
            raise BookingError(422, "VALIDATION", f"운영 요일이 아닙니다 ({', '.join(tour.operating_days)})")
        return tour.price, {"date_from": d, "time": it.time, "duration_min": tour.duration_min}
    if it.type == "buddy":
        prof = db.get(BuddyProfile, it.ref_id)
        if not prof or prof.status != "approved":
            raise BookingError(404, "NOT_FOUND", "버디를 찾을 수 없습니다")
        d = it.date or it.date_from
        if not d:
            raise BookingError(422, "VALIDATION", "동행 날짜가 필요합니다")
        dur = it.duration_min or 120
        return prof.hourly_fee * max(dur // 60, 1), {"date_from": d, "time": it.time, "duration_min": dur}
    raise BookingError(422, "VALIDATION", "type은 dorm | tour | buddy")


def next_code(db: Session, when: date) -> str:
    prefix = f"SB-{when.year}-"
    last = db.scalar(select(Booking.code).where(Booking.code.like(prefix + "%")).order_by(Booking.code.desc()))
    n = int(last.rsplit("-", 1)[1]) + 1 if last else 1
    return f"{prefix}{n:04d}"


def create_booking(db: Session, tourist: User, traveler: TravelerIn, items: list[BookingItemIn]) -> Booking:
    priced = [(it, *_price_and_validate(db, it)) for it in items]
    has_dorm = any(it.type == "dorm" for it in items)
    traveler_dict = traveler.model_dump()
    if not has_dorm:
        traveler_dict.pop("passport_no", None)  # 숙박 없으면 여권 수집 안 함
    first_date = min((f.get("date_from") for _, _, f in priced if f.get("date_from")), default=date.today())
    booking = Booking(code=next_code(db, first_date), tourist_id=tourist.id, status="requested", traveler=traveler_dict)
    db.add(booking)
    db.flush()
    total = 0
    for it, price, fields in priced:
        status = "confirmed" if it.type == "tour" else "requested"
        db.add(BookingItem(booking_id=booking.id, type=it.type, ref_id=it.ref_id, price=price, status=status, **fields))
        total += price
    booking.total_price = total
    booking.platform_fee = round(total * get_settings().platform_fee_rate)
    db.flush()
    recompute_booking_status(db, booking)
    db.commit()
    db.refresh(booking)
    return booking


# ---------- 승인·거절
def can_decide(db: Session, actor: User, it: BookingItem) -> bool:
    if actor.role == "operator":
        return True
    if it.type == "dorm" and actor.role == "univ_admin":
        room = db.get(DormRoom, it.ref_id)
        return bool(room) and room.university_id == actor.university_id
    if it.type == "buddy" and actor.role == "buddy":
        prof = db.get(BuddyProfile, it.ref_id)
        return bool(prof) and prof.user_id == actor.id
    if it.type == "tour" and actor.role == "guide":
        tour = db.get(Tour, it.ref_id)
        guide = db.get(Guide, tour.guide_id) if tour else None
        return bool(guide) and guide.user_id == actor.id
    return False


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
    if it.type in ("buddy", "tour") and it.status in OK:
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
    owner = None
    if it.type == "buddy":
        prof = db.get(BuddyProfile, it.ref_id)
        owner = db.get(User, prof.user_id) if prof else None
    elif it.type == "tour":
        tour = db.get(Tour, it.ref_id)
        guide = db.get(Guide, tour.guide_id) if tour else None
        owner = db.get(User, guide.user_id) if guide else None
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
    live = [s for s in statuses if s != "rejected"]  # 거절된 항목은 제외하고 판단
    if statuses and all(s == "cancelled" for s in statuses):
        booking.status = "cancelled"
    elif live and all(s in OK for s in live):
        booking.status = "confirmed"
    elif any(s in OK for s in statuses):
        booking.status = "partially_approved"
    else:
        booking.status = "requested"
