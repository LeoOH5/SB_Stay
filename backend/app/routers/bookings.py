"""예약 — BK-01 신청 · BK-02 내 예약 · BK-03 상세 · BK-04 승인/거절 · BK-05 취소 · BK-06~10 목업 (B 담당)"""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user, require_role
from app.core.errors import api_error
from app.models.booking import Booking, BookingItem
from app.models.user import User
from app.schemas.bookings import BookingCreateIn, BookingItemOut, BookingOut, DecideIn
from app.schemas.common import ListResponse
from app.services import booking_state as bs

router = APIRouter(prefix="/bookings", tags=["bookings"])


def _get_booking(db: Session, booking_id: int) -> Booking:
    b = db.get(Booking, booking_id)
    if not b:
        raise api_error(404, "NOT_FOUND", "예약을 찾을 수 없습니다")
    return b


def _wrap(fn):
    try:
        return fn()
    except bs.BookingError as e:
        raise api_error(e.status, e.code, e.message) from e


@router.post("", response_model=BookingOut, status_code=201)
def create_booking(body: BookingCreateIn, user: User = Depends(require_role("tourist", "operator")), db: Session = Depends(get_db)) -> BookingOut:
    """BK-01: 숙박·투어·버디 항목 묶음 신청. 투어는 즉시 confirmed."""
    booking = _wrap(lambda: bs.create_booking(db, user, body.traveler, body.items))
    return bs.booking_out(db, booking)


@router.get("/me", response_model=ListResponse[BookingOut])
def my_bookings(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ListResponse[BookingOut]:
    """BK-02"""
    rows = db.scalars(select(Booking).where(Booking.tourist_id == user.id).order_by(Booking.id.desc())).all()
    return ListResponse(items=[bs.booking_out(db, b) for b in rows])


@router.get("/{booking_id}", response_model=BookingOut)
def get_booking(booking_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> BookingOut:
    """BK-03: 본인, 해당 항목 공급자, 관리자"""
    b = _get_booking(db, booking_id)
    if user.role in ("univ_admin", "operator") or b.tourist_id == user.id:
        return bs.booking_out(db, b)
    items = db.scalars(select(BookingItem).where(BookingItem.booking_id == b.id)).all()
    if any(bs.can_decide(db, user, it) for it in items):
        return bs.booking_out(db, b)
    raise api_error(403, "FORBIDDEN", "이 예약을 볼 권한이 없습니다")


@router.patch("/{booking_id}/items/{item_id}", response_model=BookingItemOut)
def decide(booking_id: int, item_id: int, body: DecideIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> BookingItemOut:
    """BK-04: 공급자별 승인·거절"""
    it = db.get(BookingItem, item_id)
    if not it or it.booking_id != booking_id:
        raise api_error(404, "NOT_FOUND", "예약 항목을 찾을 수 없습니다")
    _wrap(lambda: bs.decide_item(db, user, it, body.action, body.reason))
    db.refresh(it)
    out = bs.item_out(db, it)
    return out


@router.post("/{booking_id}/cancel", response_model=BookingOut)
def cancel(booking_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> BookingOut:
    """BK-05"""
    b = _get_booking(db, booking_id)
    _wrap(lambda: bs.cancel_booking(db, user, b))
    return bs.booking_out(db, b)
