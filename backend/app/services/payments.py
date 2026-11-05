"""결제 흐름 — 주문 생성(prepare) → 결제창 → 승인(confirm) → 취소 시 환불. 금액은 항상 서버의 예약 금액 기준."""
import secrets
from datetime import UTC, date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.booking import Booking, BookingItem, Notification
from app.models.payment import Payment
from app.services import toss


class PaymentError(Exception):
    def __init__(self, status: int, code: str, message: str):
        self.status, self.code, self.message = status, code, message


def latest(db: Session, booking_id: int) -> Payment | None:
    return db.scalar(select(Payment).where(Payment.booking_id == booking_id).order_by(Payment.id.desc()))


def paid(db: Session, booking_id: int) -> Payment | None:
    return db.scalar(select(Payment).where(Payment.booking_id == booking_id, Payment.status.in_(("DONE", "PARTIAL_CANCELED"))).order_by(Payment.id.desc()))


def summary(p: Payment | None) -> dict | None:
    if not p:
        return None
    return {
        "order_id": p.order_id, "status": p.status, "amount": p.amount, "method": p.method, "approved_at": p.approved_at,
        "receipt_url": p.receipt_url, "canceled_amount": p.canceled_amount, "provider": "toss" if p.payment_key else "mock",
    }


def order_name(db: Session, b: Booking) -> str:
    items = db.scalars(select(BookingItem).where(BookingItem.booking_id == b.id).order_by(BookingItem.id)).all()
    label = {"dorm": "숙박", "tour": "투어", "buddy": "버디"}
    kinds = [label.get(i.type, i.type) for i in items]
    return f"성북스테이 {'·'.join(dict.fromkeys(kinds))} ({b.code})"[:100]


def prepare(db: Session, b: Booking) -> Payment:
    """결제창 띄우기 전 주문 생성. 이미 결제됐거나 취소된 예약은 거절. 남은 READY 주문은 재사용."""
    if b.status == "cancelled":
        raise PaymentError(409, "CONFLICT", "취소된 예약입니다")
    if b.paid_at or paid(db, b.id):
        raise PaymentError(409, "ALREADY_PAID", "이미 결제된 예약입니다")
    if b.total_price <= 0:
        raise PaymentError(422, "VALIDATION", "결제할 금액이 없습니다")
    p = db.scalar(select(Payment).where(Payment.booking_id == b.id, Payment.status == "READY", Payment.amount == b.total_price))
    if not p:
        p = Payment(booking_id=b.id, order_id=f"SB{b.id}-{secrets.token_hex(6)}", amount=b.total_price, status="READY")
        db.add(p)
        db.commit()
        db.refresh(p)
    return p


def _apply_toss(p: Payment, data: dict) -> None:
    p.payment_key = data.get("paymentKey") or p.payment_key
    p.status = str(data.get("status") or p.status)
    p.method = data.get("method") or p.method
    approved = data.get("approvedAt")
    if approved:
        p.approved_at = datetime.fromisoformat(approved)
    p.receipt_url = (data.get("receipt") or {}).get("url") or p.receipt_url
    p.raw = data


def confirm(db: Session, b: Booking, p: Payment, payment_key: str, amount: int) -> Payment:
    """결제창 성공 리다이렉트 후 승인. 금액이 주문과 다르면 승인 요청 자체를 하지 않는다."""
    if p.status == "DONE":
        return p  # 새로고침 등으로 두 번 들어와도 같은 결과
    if p.status != "READY":
        raise PaymentError(409, "CONFLICT", f"승인할 수 없는 주문 상태입니다 ({p.status})")
    if amount != p.amount or amount != b.total_price:
        raise PaymentError(400, "AMOUNT_MISMATCH", "결제 금액이 주문 금액과 다릅니다")
    if b.status == "cancelled":
        raise PaymentError(409, "CONFLICT", "취소된 예약입니다")
    try:
        data = toss.confirm(payment_key, p.order_id, amount)
    except toss.TossError as e:
        p.status, p.fail_code, p.fail_message = "FAILED", e.code, e.message
        db.commit()
        raise PaymentError(400 if e.status < 500 else 502, e.code, e.message) from e
    _apply_toss(p, data)
    if p.status == "DONE":
        b.paid_at = p.approved_at or datetime.now(UTC)
        db.add(Notification(user_id=b.tourist_id, type="booking_paid", title=f"{b.code} · 결제 완료 {p.amount:,}원"))
    db.commit()
    db.refresh(p)
    return p


def mock_pay(db: Session, b: Booking) -> Payment:
    """토스 키가 없을 때(데모·테스트) 즉시 결제 완료"""
    if b.status == "cancelled":
        raise PaymentError(409, "CONFLICT", "취소된 예약입니다")
    p = paid(db, b.id)
    if p:
        return p
    now = datetime.now(UTC)
    p = Payment(booking_id=b.id, order_id=f"SB{b.id}-mock{secrets.token_hex(4)}", amount=b.total_price, status="DONE", method="mock", approved_at=now)
    db.add(p)
    b.paid_at = b.paid_at or now
    db.commit()
    db.refresh(p)
    return p


def refund_rate(b: Booking, items: list[BookingItem], today: date | None = None) -> float:
    """환불 규정: 첫 일정 7일 전까지 100%, 3일 전까지 50%, 이후 0%"""
    today = today or date.today()
    first = min((i.date_from for i in items), default=today)
    days = (first - today).days
    if days >= 7:
        return 1.0
    if days >= 3:
        return 0.5
    return 0.0


def refund_on_cancel(db: Session, b: Booking, reason: str | None) -> dict:
    """예약 취소 직전에 호출. 토스 결제면 규정 금액만큼 실제 환불. 실패하면 예외(예약은 취소하지 않음)."""
    p = paid(db, b.id)
    if not p:
        return {"refund_amount": 0, "refund_rate": 0.0}
    items = db.scalars(select(BookingItem).where(BookingItem.booking_id == b.id)).all()
    rate = refund_rate(b, list(items))
    remaining = p.amount - p.canceled_amount
    refund = min(remaining, round(p.amount * rate))
    if refund <= 0:
        return {"refund_amount": 0, "refund_rate": rate}
    if p.payment_key:  # 실제 토스 결제
        try:
            data = toss.cancel(p.payment_key, reason or "고객 요청 취소", None if refund == remaining else refund)
        except toss.TossError as e:
            raise PaymentError(400 if e.status < 500 else 502, e.code, f"환불 실패: {e.message}") from e
        _apply_toss(p, data)
    else:
        p.status = "CANCELED" if refund == remaining else "PARTIAL_CANCELED"
    p.canceled_amount += refund
    db.commit()
    return {"refund_amount": refund, "refund_rate": rate}
