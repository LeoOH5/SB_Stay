from datetime import date

from pydantic import BaseModel


class BuddyProfileOut(BaseModel):
    id: int
    user_id: int
    name: str
    university: str
    university_id: int
    major: str | None = None
    year: int | None = None
    languages: list[str] = []
    interests: list[str] = []
    intro: str | None = None
    avatar: str | None = None
    status: str
    hourly_fee: int = 0
    available_dates: list[str] = []
    school_email_verified: bool = True  # 해커톤 목업
    rating: float = 0
    review_count: int = 0


class BuddyProfileIn(BaseModel):
    major: str | None = None
    year: int | None = None
    languages: list[str] | None = None
    interests: list[str] | None = None
    intro: str | None = None
    avatar: str | None = None
    hourly_fee: int | None = None


class AvailabilityIn(BaseModel):
    dates: list[date]


class AvailabilityOut(BaseModel):
    dates: list[str]


class TouristSummary(BaseModel):
    id: int
    name: str
    nationality: str | None = None
    language: str


class BuddyRequestOut(BaseModel):
    item_id: int
    id: int  # = item_id (명세 호환)
    booking_id: int
    booking_code: str
    type: str
    tourist: TouristSummary
    date: str
    time: str | None = None
    duration_min: int | None = None
    price: int
    interests: list[str] = []
    status: str
    reject_reason: str | None = None
    google_event_id: str | None = None
    meeting_point: str | None = None
    title: str


class EarningItem(BaseModel):
    booking_item_id: int
    date: str
    tourist: str
    activity: str
    amount: int
    status: str  # pending | paid


class EarningsOut(BaseModel):
    month: str
    period: str
    activities: int
    total_fee: int
    paid: int
    pending: int
    items: list[EarningItem]
