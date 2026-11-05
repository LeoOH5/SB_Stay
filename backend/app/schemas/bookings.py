from datetime import date as date_
from datetime import datetime

from pydantic import BaseModel, Field


class TravelerIn(BaseModel):
    name: str
    nationality: str
    email: str
    passport_no: str | None = None  # 숙박 항목이 있을 때만 사용, 최소 수집
    emergency_contact: str | None = None
    guests: int = 1
    note: str | None = None


class BookingItemIn(BaseModel):
    type: str  # dorm | tour | buddy
    ref_id: int
    date_from: date_ | None = None
    date_to: date_ | None = None
    date: date_ | None = None  # tour/buddy
    time: str | None = None
    duration_min: int | None = None
    guests: int | None = None


class BookingCreateIn(BaseModel):
    traveler: TravelerIn
    items: list[BookingItemIn] = Field(min_length=1)


class BookingItemOut(BaseModel):
    id: int
    type: str
    ref_id: int
    title: str
    meta: str
    status: str
    price: int
    date_from: date_ | None = None
    date_to: date_ | None = None
    time: str | None = None
    duration_min: int | None = None
    reject_reason: str | None = None
    google_event_id: str | None = None
    decided_at: datetime | None = None


class BookingOut(BaseModel):
    id: int
    code: str
    status: str
    total_price: int
    platform_fee: int
    traveler: dict | None = None
    items: list[BookingItemOut]
    created_at: datetime
    paid_at: datetime | None = None
    cancelled_at: datetime | None = None
    payment: dict | None = None  # 결제 요약 (status · method · receipt_url · canceled_amount)


class DecideIn(BaseModel):
    action: str  # approve | reject
    reason: str | None = None
