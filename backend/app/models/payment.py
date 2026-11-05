"""결제: payments (토스페이먼츠 결제위젯)"""
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.base import TimestampMixin

# READY(주문 생성) → DONE(승인) → CANCELED | PARTIAL_CANCELED, 실패 시 FAILED
PAYMENT_STATUS = ("READY", "DONE", "CANCELED", "PARTIAL_CANCELED", "FAILED")


class Payment(Base, TimestampMixin):
    __tablename__ = "payments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), index=True)
    order_id: Mapped[str] = mapped_column(String(64), unique=True)  # 토스 orderId (6~64자, 영문·숫자·-_=)
    payment_key: Mapped[str | None] = mapped_column(String(200), unique=True)
    amount: Mapped[int] = mapped_column(Integer)  # 서버가 정한 결제 금액 (원)
    status: Mapped[str] = mapped_column(String(20), default="READY", index=True)
    method: Mapped[str | None] = mapped_column(String(30))  # 카드 · 간편결제 · 계좌이체 ...
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    receipt_url: Mapped[str | None] = mapped_column(String(500))
    canceled_amount: Mapped[int] = mapped_column(Integer, default=0)
    fail_code: Mapped[str | None] = mapped_column(String(60))
    fail_message: Mapped[str | None] = mapped_column(String(300))
    raw: Mapped[dict | None] = mapped_column(JSON)  # 토스 응답 원본 (마지막 1건)
