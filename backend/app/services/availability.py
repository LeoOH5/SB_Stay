"""객실 잔여 수 계산. requested/approved/confirmed 상태의 숙박 항목이 기간과 겹치면 점유로 본다."""
from datetime import date

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.models.booking import BookingItem

ACTIVE = ("requested", "approved", "confirmed")


def occupied_rooms(db: Session, dorm_room_id: int, check_in: date | None, check_out: date | None) -> int:
    q = select(func.count()).select_from(BookingItem).where(
        BookingItem.type == "dorm", BookingItem.ref_id == dorm_room_id, BookingItem.status.in_(ACTIVE)
    )
    if check_in and check_out:
        # [date_from, date_to) 와 [check_in, check_out) 겹침
        q = q.where(and_(BookingItem.date_from < check_out, BookingItem.date_to > check_in))
    return int(db.scalar(q) or 0)


def nights_between(check_in: date, check_out: date) -> int:
    return (check_out - check_in).days
