from datetime import date, datetime

from pydantic import BaseModel


class DailyPoint(BaseModel):
    date: str
    bookings: int
    revenue: int


class DashboardOut(BaseModel):
    period: dict
    bookings: int
    pending: int
    nights: int
    dorm_revenue: int
    platform_fee: int
    fee_rate: float
    by_status: dict[str, int]
    daily: list[DailyPoint]


class AdminBookingRow(BaseModel):
    booking_id: int
    item_id: int
    code: str
    tourist: str
    nationality: str | None = None
    type: str
    title: str
    schedule: str
    price: int
    status: str
    university_id: int | None = None
    date_from: date | None = None
    date_to: date | None = None
    created_at: datetime


class AdminBuddyRow(BaseModel):
    id: int
    user_id: int
    name: str
    email: str
    university_id: int
    major: str | None = None
    year: int | None = None
    languages: list[str] = []
    interests: list[str] = []
    status: str


class BuddyActionIn(BaseModel):
    action: str  # approve | suspend


class AdminUserRow(BaseModel):
    id: int
    email: str
    name: str
    role: str
    university_id: int | None = None
    language: str
    created_at: datetime

    model_config = {"from_attributes": True}


class SettlementRow(BaseModel):
    party_type: str  # university | guide | buddy
    party_id: int
    target: str
    count: int
    revenue: int
    fee: int
    payout: int
    status: str  # pending | settled


class SettlementsOut(BaseModel):
    period: dict
    total: int
    items: list[SettlementRow]


class AdminTourRow(BaseModel):
    id: int
    title: str
    title_en: str
    theme: str
    guide: str
    duration_min: int
    price: int
    operating_days: list[str] = []
    languages: list[str] = []
