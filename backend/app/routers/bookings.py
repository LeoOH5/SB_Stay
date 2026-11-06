"""예약 — BK-01 신청 · BK-02 내 예약 · BK-03 상세 · BK-04 승인/거절 · BK-05 취소 · BK-06~10 목업 · 버디 바꾸기 · 앨범 (B 담당)"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import rules
from app.core.db import get_db
from app.core.deps import get_current_user, require_role
from app.core.errors import api_error
from app.models.booking import Booking, BookingItem, Review
from app.models.supply import BuddyActivity, BuddyProfile, DormRoom, University
from app.models.user import User
from app.schemas.bookings import (
    AlbumItem,
    AlbumOut,
    BookingCreateIn,
    BookingItemOut,
    BookingOut,
    DecideIn,
    ReplaceBuddyIn,
    ReviewIn,
)
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
    """BK-01: 숙박 1개 + 기간 안 버디(필수), 또는 버디만. 코스(tour)는 422 COURSE_NOT_BOOKABLE."""
    booking = _wrap(lambda: bs.create_booking(db, user, body.traveler, body.items))
    return bs.booking_out(db, booking)


@router.get("/me", response_model=ListResponse[BookingOut])
def my_bookings(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ListResponse[BookingOut]:
    """BK-02"""
    rows = db.scalars(select(Booking).where(Booking.tourist_id == user.id).order_by(Booking.id.desc())).all()
    return ListResponse(items=[bs.booking_out(db, b) for b in rows])


@router.get("/{booking_id}", response_model=BookingOut)
def get_booking(booking_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> BookingOut:
    """BK-03: 본인·운영자는 전체, 대학 담당자는 자기 대학 항목이 있는 예약, 버디는 traveler 최소 정보 + 자기 항목만"""
    b = _get_booking(db, booking_id)
    if not bs.can_view(db, user, b):
        raise api_error(403, "FORBIDDEN", "이 예약을 볼 권한이 없습니다")
    return bs.booking_out(db, b, viewer=user)


@router.patch("/{booking_id}/items/{item_id}", response_model=BookingItemOut)
def decide(booking_id: int, item_id: int, body: DecideIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> BookingItemOut:
    """BK-04: 공급자별 승인·거절"""
    it = db.get(BookingItem, item_id)
    if not it or it.booking_id != booking_id:
        raise api_error(404, "NOT_FOUND", "예약 항목을 찾을 수 없습니다")
    _wrap(lambda: bs.decide_item(db, user, it, body.action, body.reason))
    db.refresh(it)
    return bs.item_out(db, it)


@router.post("/{booking_id}/items/{item_id}/replace-buddy", response_model=BookingOut)
def replace_buddy(booking_id: int, item_id: int, body: ReplaceBuddyIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> BookingOut:
    """버디 바꾸기 (예약자 본인): 기존 항목은 취소(거절이면 그대로), 새 버디 항목을 requested로. 요청·코스·식사·앨범 복사."""
    b = _get_booking(db, booking_id)
    it = db.get(BookingItem, item_id)
    if not it or it.booking_id != b.id:
        raise api_error(404, "NOT_FOUND", "예약 항목을 찾을 수 없습니다")
    _wrap(lambda: bs.replace_buddy(db, user, b, it, body.buddy_id, body.date, body.time))
    return bs.booking_out(db, b, viewer=user)


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
    return bs.booking_out(db, b, viewer=user)


# ---------- 목업·보조 (BK-06~09). 경로·형식은 명세와 같고 내부 로직만 단순.


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
    """BK-08: 항목별 후기 1회. 확정된 항목이고 날짜가 지났을 때만 (아니면 409 TRIP_NOT_DONE)"""
    b = _get_booking(db, booking_id)
    if b.tourist_id != user.id:
        raise api_error(403, "FORBIDDEN", "본인 예약만 리뷰할 수 있습니다")
    it = db.get(BookingItem, body.item_id)
    if not it or it.booking_id != b.id:
        raise api_error(404, "NOT_FOUND", "예약 항목을 찾을 수 없습니다")
    if not 1 <= body.rating <= 5:
        raise api_error(422, "VALIDATION", "rating은 1~5")
    subs = body.sub_scores or None
    if subs and (set(subs) - set(rules.SUB_SCORES) or any(not 1 <= v <= 5 for v in subs.values())):
        raise api_error(422, "VALIDATION", "sub_scores는 kind·talk·punctual·local, 각 1~5")
    tags = list(dict.fromkeys(body.tags or [])) or None
    if tags and any(t not in rules.REVIEW_TAGS for t in tags):
        raise api_error(422, "VALIDATION", f"tags는 {', '.join(rules.REVIEW_TAGS)}")
    if it.status not in bs.OK or it.date_from > bs.today():
        raise api_error(409, "TRIP_NOT_DONE", "여행이 끝난 뒤에 후기를 남길 수 있어요")
    if db.scalar(select(Review).where(Review.booking_item_id == it.id)):
        raise api_error(409, "CONFLICT", "이미 리뷰를 남긴 항목입니다")
    rv = Review(booking_item_id=it.id, rating=body.rating, text=body.text, sub_scores=subs, tags=tags)
    db.add(rv)
    db.commit()
    db.refresh(rv)
    return {"id": rv.id, "booking_item_id": it.id, "rating": rv.rating, "text": rv.text, "sub_scores": rv.sub_scores,
            "tags": rv.tags or [], "created_at": rv.created_at}


@router.get("/{booking_id}/album", response_model=AlbumOut)
def album(booking_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> AlbumOut:
    """여행 앨범 (본인): album=true 버디 항목의 활동 기록 사진"""
    b = _get_booking(db, booking_id)
    if b.tourist_id != user.id:
        raise api_error(403, "FORBIDDEN", "본인 예약만 볼 수 있습니다")
    rows = db.scalars(select(BookingItem).where(BookingItem.booking_id == b.id, BookingItem.type == "buddy",
                                                BookingItem.album.is_(True), BookingItem.status != "cancelled").order_by(BookingItem.id)).all()
    out = []
    for it in rows:
        prof = db.get(BuddyProfile, it.ref_id)
        acts = db.scalars(select(BuddyActivity).where(BuddyActivity.booking_item_id == it.id).order_by(BuddyActivity.id)).all()
        places = list(dict.fromkeys(p for a in acts for p in (a.places or [])))
        out.append(AlbumItem(item_id=it.id, buddy_name=db.get(User, prof.user_id).name if prof else "", date=it.date_from,
                             places=places, photos=[p for a in acts for p in (a.photos or [])]))
    return AlbumOut(items=out)


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
