"""예약 — BK-01 신청 · BK-02 내 예약 · BK-03 상세 · BK-04 승인/거절 · BK-05 취소 · BK-06~10 목업 (B 담당)"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
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
from app.services import payments as ps
from app.services import paypal, toss

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


class CancelIn(BaseModel):
    reason: str | None = None


@router.post("/{booking_id}/cancel", response_model=BookingOut)
def cancel(booking_id: int, body: CancelIn | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> BookingOut:
    """BK-05: 취소 + 환불 규정(7일 전 100% · 3일 전 50% · 이후 0%)대로 결제 환불"""
    b = _get_booking(db, booking_id)
    if user.role != "operator" and b.tourist_id != user.id:
        raise api_error(403, "FORBIDDEN", "본인 예약만 취소할 수 있습니다")
    if b.status == "cancelled":
        raise api_error(409, "CONFLICT", "이미 취소된 예약입니다")
    try:
        ps.refund_on_cancel(db, b, body.reason if body else None)
    except ps.PaymentError as e:
        raise api_error(e.status, e.code, e.message) from e
    _wrap(lambda: bs.cancel_booking(db, user, b))
    return bs.booking_out(db, b)


# ---------- 목업·보조 (BK-06~09). 경로·형식은 명세와 같고 내부 로직만 단순.

from pydantic import BaseModel

from app.models.booking import Review
from app.models.supply import DormRoom, University


class ReviewIn(BaseModel):
    item_id: int
    rating: int
    text: str | None = None


@router.post("/{booking_id}/pay")
def pay(booking_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    """BK-06: 토스 키가 없을 때만 즉시 결제(목업). 키가 있으면 PM-01·02 결제창 흐름을 써야 한다."""
    b = _get_booking(db, booking_id)
    if b.tourist_id != user.id and user.role != "operator":
        raise api_error(403, "FORBIDDEN", "본인 예약만 결제할 수 있습니다")
    if toss.enabled() or paypal.enabled():
        raise api_error(409, "USE_PAYMENT_WIDGET", "결제창(토스 또는 PayPal)으로 결제해 주세요")
    try:
        p = ps.mock_pay(db, b)
    except ps.PaymentError as e:
        raise api_error(e.status, e.code, e.message) from e
    return {"id": b.id, "status": "paid", "paid_at": b.paid_at, "payment": {"method": p.method, "amount": p.amount}}


@router.get("/{booking_id}/checkin-guide")
def checkin_guide(booking_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    """BK-07 (정적): 숙박 항목의 대학 checkin_guide 반환"""
    b = _get_booking(db, booking_id)
    if b.tourist_id != user.id and user.role not in ("univ_admin", "operator"):
        raise api_error(403, "FORBIDDEN", "본인 예약만 볼 수 있습니다")
    dorm = db.scalar(select(BookingItem).where(BookingItem.booking_id == b.id, BookingItem.type == "dorm"))
    if not dorm:
        raise api_error(404, "NOT_FOUND", "숙박 항목이 없는 예약입니다")
    room = db.get(DormRoom, dorm.ref_id)
    uni = db.get(University, room.university_id)
    g = uni.checkin_guide or {}
    return {
        "building": f"{uni.name} {g.get('building', room.building)}", "address": uni.address or "서울 성북구",
        "lat": float(uni.lat) if uni.lat is not None else None, "lng": float(uni.lng) if uni.lng is not None else None,
        "checkin": g.get("checkin", "15:00"), "checkout": g.get("checkout", "11:00"), "wifi": g.get("wifi", ""),
        "steps": g.get("steps") or ["1층 안내데스크에서 예약자 이름 확인", "여권 제시 후 출입카드 수령", "배정된 객실로 이동"],
        "emergency": g.get("emergency") or ["112 / 119 / 1330"], "rules": room.rules or [],
        "status": dorm.status,
    }


@router.post("/{booking_id}/reviews", status_code=201)
def create_review(booking_id: int, body: ReviewIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    """BK-08: 항목별 리뷰 1회"""
    b = _get_booking(db, booking_id)
    if b.tourist_id != user.id:
        raise api_error(403, "FORBIDDEN", "본인 예약만 리뷰할 수 있습니다")
    it = db.get(BookingItem, body.item_id)
    if not it or it.booking_id != b.id:
        raise api_error(404, "NOT_FOUND", "예약 항목을 찾을 수 없습니다")
    if not 1 <= body.rating <= 5:
        raise api_error(422, "VALIDATION", "rating은 1~5")
    if db.scalar(select(Review).where(Review.booking_item_id == it.id)):
        raise api_error(409, "CONFLICT", "이미 리뷰를 남긴 항목입니다")
    rv = Review(booking_item_id=it.id, rating=body.rating, text=body.text)
    db.add(rv)
    db.commit()
    db.refresh(rv)
    return {"id": rv.id, "booking_item_id": it.id, "rating": rv.rating, "text": rv.text, "created_at": rv.created_at}


@router.get("/{booking_id}/chat")
def chat(booking_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    """BK-09 (목업): 버디 항목의 대화 화면용 고정 메시지. 실시간 채팅·자동 번역은 운영 단계."""
    b = _get_booking(db, booking_id)
    items = db.scalars(select(BookingItem).where(BookingItem.booking_id == b.id)).all()
    if b.tourist_id != user.id and not any(bs.can_decide(db, user, i) for i in items) and user.role != "operator":
        raise api_error(403, "FORBIDDEN", "이 대화를 볼 권한이 없습니다")
    buddy_item = next((i for i in items if i.type == "buddy"), None)
    if not buddy_item:
        return {"items": [], "next_cursor": None}
    when = buddy_item.date_from
    msgs = [
        {"id": 1, "booking_item_id": buddy_item.id, "sender": "buddy", "text": f"{when.month}/{when.day} {buddy_item.time or ''}에 정문에서 봐요!", "translated_text": f"See you at the main gate on {when.month}/{when.day} at {buddy_item.time or ''}!", "created_at": "2027-01-12T20:00:00Z"},
        {"id": 2, "booking_item_id": buddy_item.id, "sender": "tourist", "text": "See you there 😊", "translated_text": "거기서 봐요 😊", "created_at": "2027-01-12T20:05:00Z"},
    ]
    return {"items": msgs, "next_cursor": None, "mock": True}
