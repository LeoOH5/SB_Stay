"""결제 — PM-01 주문 생성 · PM-02 승인 · PM-03 결제 조회 (토스페이먼츠), PM-04·05 PayPal (외국인, USD) · PM-06 결제수단 (B 담당)"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db
from app.core.deps import get_current_user
from app.core.errors import api_error
from app.models.booking import Booking
from app.models.payment import Payment
from app.models.user import User
from app.services import payments as ps
from app.services import paypal, toss

router = APIRouter(prefix="/payments", tags=["payments"])


class PrepareIn(BaseModel):
    booking_id: int


class PayPalCaptureIn(BaseModel):
    paypal_order_id: str


class ConfirmIn(BaseModel):
    payment_key: str
    order_id: str
    amount: int


def _own_booking(db: Session, user: User, booking_id: int) -> Booking:
    b = db.get(Booking, booking_id)
    if not b:
        raise api_error(404, "NOT_FOUND", "예약을 찾을 수 없습니다")
    if b.tourist_id != user.id and user.role != "operator":
        raise api_error(403, "FORBIDDEN", "본인 예약만 결제할 수 있습니다")
    return b


def _wrap(fn):
    try:
        return fn()
    except ps.PaymentError as e:
        raise api_error(e.status, e.code, e.message) from e


@router.post("/prepare")
def prepare(body: PrepareIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    """PM-01: 결제창에 넘길 주문 정보. 금액은 서버의 예약 금액."""
    b = _own_booking(db, user, body.booking_id)
    p = _wrap(lambda: ps.prepare(db, b))
    traveler = b.traveler or {}
    return {
        "enabled": toss.enabled(), "booking_id": b.id, "order_id": p.order_id, "amount": p.amount,
        "order_name": ps.order_name(db, b),
        "customer_name": (traveler.get("name") or user.name)[:100], "customer_email": (traveler.get("email") or user.email)[:100],
        "customer_key": f"sbstay-user-{user.id:010d}",
    }


@router.post("/confirm")
def confirm(body: ConfirmIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    """PM-02: 결제 성공 리다이렉트(paymentKey·orderId·amount)를 받아 토스에 승인 요청"""
    p = db.scalar(select(Payment).where(Payment.order_id == body.order_id))
    if not p:
        raise api_error(404, "NOT_FOUND", "주문을 찾을 수 없습니다")
    b = _own_booking(db, user, p.booking_id)
    if not toss.enabled():
        raise api_error(409, "PAYMENT_DISABLED", "토스 결제 키가 설정되지 않았습니다")
    p = _wrap(lambda: ps.confirm(db, b, p, body.payment_key, body.amount))
    return {"booking_id": b.id, "paid_at": b.paid_at, "payment": ps.summary(p)}


@router.get("/bookings/{booking_id}")
def booking_payment(booking_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    """PM-03: 예약의 결제 상태·영수증"""
    b = _own_booking(db, user, booking_id)
    return {"booking_id": b.id, "payment": ps.summary(ps.paid(db, b.id) or ps.latest(db, b.id))}


@router.get("/methods")
def methods() -> dict:
    """PM-06: 쓸 수 있는 결제수단 (키 설정 여부)"""
    return {"toss": toss.enabled(), "paypal": paypal.enabled(), "usd_krw_rate": get_settings().usd_krw_rate}


@router.post("/paypal/orders")
def paypal_order(body: PrepareIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    """PM-04: PayPal 주문 생성 (원화 예약 금액 → 고정 환율 달러). 프론트 PayPal 버튼의 createOrder에서 호출"""
    if not paypal.enabled():
        raise api_error(409, "PAYMENT_DISABLED", "PayPal 키가 설정되지 않았습니다")
    b = _own_booking(db, user, body.booking_id)
    p = _wrap(lambda: ps.paypal_create(db, b, ps.order_name(db, b)))
    return {"paypal_order_id": p.payment_key, "order_id": p.order_id, "amount": p.amount, "currency": "USD", "usd_amount": p.foreign_amount,
            "usd_krw_rate": get_settings().usd_krw_rate}


@router.post("/paypal/capture")
def paypal_capture(body: PayPalCaptureIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    """PM-05: 구매자가 PayPal에서 승인한 주문을 캡처해 결제 완료"""
    p = db.scalar(select(Payment).where(Payment.payment_key == body.paypal_order_id, Payment.provider == "paypal"))
    if not p:
        raise api_error(404, "NOT_FOUND", "주문을 찾을 수 없습니다")
    b = _own_booking(db, user, p.booking_id)
    p = _wrap(lambda: ps.paypal_capture(db, b, p))
    return {"booking_id": b.id, "paid_at": b.paid_at, "payment": ps.summary(p)}
