"""예약 상태 전이는 이 파일에서만 바꾼다 (B 담당).

booking_items.status: requested → approved | rejected → confirmed → cancelled (tour는 생성 즉시 confirmed)
bookings.status:      requested → partially_approved → confirmed | cancelled
"""
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.models.booking import Booking, BookingItem

ITEM_FINAL_OK = {"approved", "confirmed"}


def decide_item(db: Session, item: BookingItem, action: str, actor_id: int, reason: str | None = None) -> Booking:
    if item.status != "requested":
        raise ValueError("already_decided")
    item.status = "approved" if action == "approve" else "rejected"
    item.decided_by = actor_id
    item.decided_at = datetime.now(UTC)
    item.reject_reason = reason if action == "reject" else None
    booking = db.get(Booking, item.booking_id)
    recompute_booking_status(booking)
    db.commit()
    # TODO(B): buddy/guide 항목이 OK로 바뀌고 calendar_connected면 services.google_calendar.push_event()
    return booking


def recompute_booking_status(booking: Booking) -> None:
    statuses = [i.status for i in booking.items] if hasattr(booking, "items") else []
    if not statuses:
        return
    if all(s in ITEM_FINAL_OK for s in statuses):
        booking.status = "confirmed"
    elif any(s in ITEM_FINAL_OK for s in statuses):
        booking.status = "partially_approved"
    elif all(s == "cancelled" for s in statuses):
        booking.status = "cancelled"
