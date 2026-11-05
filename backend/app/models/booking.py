"""예약·소통: bookings, booking_items, reviews, messages, notifications"""
from datetime import date, datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.base import TimestampMixin

BOOKING_STATUS = ("requested", "partially_approved", "confirmed", "cancelled")
ITEM_STATUS = ("requested", "approved", "rejected", "confirmed", "cancelled")
ITEM_TYPES = ("dorm", "tour", "buddy")


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
    type: Mapped[str] = mapped_column(String(10))  # dorm | tour | buddy
    ref_id: Mapped[int] = mapped_column(Integer)  # type별 다형 참조 (서비스 계층에서 검증)
    date_from: Mapped[date] = mapped_column()
    date_to: Mapped[date | None] = mapped_column()  # dorm만
    time: Mapped[str | None] = mapped_column(String(5))  # tour/buddy "HH:MM"
    duration_min: Mapped[int | None] = mapped_column(Integer)
    guests: Mapped[int | None] = mapped_column(SmallInteger)
    price: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="requested", index=True)
    decided_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reject_reason: Mapped[str | None] = mapped_column(Text)
    google_event_id: Mapped[str | None] = mapped_column(String(255))  # 캘린더 푸시 결과


class Review(Base, TimestampMixin):
    __tablename__ = "reviews"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_item_id: Mapped[int] = mapped_column(ForeignKey("booking_items.id"), unique=True)
    rating: Mapped[int] = mapped_column(SmallInteger)
    text: Mapped[str | None] = mapped_column(Text)


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
