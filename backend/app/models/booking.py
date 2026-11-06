"""예약·소통: bookings, booking_items, reviews, messages, notifications, meal_claims, reports"""
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.base import TimestampMixin

BOOKING_STATUS = ("requested", "partially_approved", "confirmed", "cancelled")
ITEM_STATUS = ("requested", "approved", "rejected", "confirmed", "cancelled")
ITEM_TYPES = ("dorm", "buddy")  # v3: 코스(tour)는 예약 항목 아님
MEAL_STATUS = ("requested", "approved", "rejected")
REPORT_STATUS = ("open", "resolved", "dismissed")


class Booking(Base, TimestampMixin):
    __tablename__ = "bookings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True)  # SB-2027-0112
    tourist_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(25), default="requested", index=True)
    total_price: Mapped[int] = mapped_column(Integer, default=0)
    platform_fee: Mapped[int] = mapped_column(Integer, default=0)
    traveler: Mapped[dict | None] = mapped_column(JSON)  # 여행자 정보(최소 수집)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class BookingItem(Base):
    __tablename__ = "booking_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), index=True)
    type: Mapped[str] = mapped_column(String(10))  # dorm | buddy
    ref_id: Mapped[int] = mapped_column(Integer)  # type별 다형 참조 (서비스 계층에서 검증)
    date_from: Mapped[date] = mapped_column()
    date_to: Mapped[date | None] = mapped_column()  # dorm만
    time: Mapped[str | None] = mapped_column(String(5))  # buddy "HH:MM"
    duration_min: Mapped[int | None] = mapped_column(Integer)
    guests: Mapped[int | None] = mapped_column(SmallInteger)
    price: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="requested", index=True)
    decided_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reject_reason: Mapped[str | None] = mapped_column(Text)
    google_event_id: Mapped[str | None] = mapped_column(String(255))  # 캘린더 푸시 결과
    request: Mapped[dict | None] = mapped_column(JSON)  # buddy: 식단·알레르기·속도·장소·메모 / dorm: 체크인 요청
    course_id: Mapped[int | None] = mapped_column(ForeignKey("tours.id"))  # buddy: 같이 걸을 코스
    meal_count: Mapped[int] = mapped_column(SmallInteger, default=0, server_default="0")
    meal_deposit: Mapped[int] = mapped_column(Integer, default=0, server_default="0")  # 수수료 없음
    album: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    payout_rate: Mapped[Decimal | None] = mapped_column(Numeric(4, 3))  # buddy: 확정 때 고정한 버디 정산율


class Review(Base, TimestampMixin):
    __tablename__ = "reviews"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_item_id: Mapped[int] = mapped_column(ForeignKey("booking_items.id"), unique=True)
    rating: Mapped[int] = mapped_column(SmallInteger)
    text: Mapped[str | None] = mapped_column(Text)
    sub_scores: Mapped[dict | None] = mapped_column(JSON)  # {kind, talk, punctual, local} 1~5
    tags: Mapped[list | None] = mapped_column(JSON)


class Message(Base, TimestampMixin):
    __tablename__ = "messages"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_item_id: Mapped[int] = mapped_column(ForeignKey("booking_items.id"), index=True)
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    text: Mapped[str] = mapped_column(Text)
    translated_text: Mapped[str | None] = mapped_column(Text)


class Notification(Base, TimestampMixin):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    booking_item_id: Mapped[int | None] = mapped_column(ForeignKey("booking_items.id"))
    type: Mapped[str] = mapped_column(String(40))  # item_approved | item_rejected | booking_confirmed | ...
    title: Mapped[str] = mapped_column(String(100))
    body: Mapped[str | None] = mapped_column(Text)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class MealClaim(Base, TimestampMixin):
    """버디 식비 청구 (먼저 계산 후 영수증). 운영자가 승인한 금액만 버디에게, 남은 보증금은 여행자에게."""
    __tablename__ = "meal_claims"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_item_id: Mapped[int] = mapped_column(ForeignKey("booking_items.id"), index=True)
    buddy_id: Mapped[int] = mapped_column(ForeignKey("buddy_profiles.id"), index=True)
    date: Mapped[date] = mapped_column(Date)
    place: Mapped[str] = mapped_column(String(100))
    items: Mapped[str | None] = mapped_column(Text)
    amount: Mapped[int] = mapped_column(Integer)
    receipt_url: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(10), default="requested", index=True)  # MEAL_STATUS
    reason: Mapped[str | None] = mapped_column(Text)
    decided_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Report(Base, TimestampMixin):
    """여행자 → 버디 신고. 기각 제외 2건이면 자동 정지."""
    __tablename__ = "reports"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_item_id: Mapped[int | None] = mapped_column(ForeignKey("booking_items.id"))
    reporter_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    buddy_id: Mapped[int] = mapped_column(ForeignKey("buddy_profiles.id"), index=True)
    category: Mapped[str] = mapped_column(String(20))  # no_show | rude | money | unsafe | other
    text: Mapped[str] = mapped_column(Text)
    photo_url: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(10), default="open", index=True)  # REPORT_STATUS
    action: Mapped[str | None] = mapped_column(String(20))  # warn | suspend | unsuspend | dismiss
    auto_suspended: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
