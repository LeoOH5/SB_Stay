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
    type: str  # dorm | buddy (tour → 422 COURSE_NOT_BOOKABLE)
    ref_id: int
    date_from: date_ | None = None
    date_to: date_ | None = None
    date: date_ | None = None  # buddy
    time: str | None = None
    duration_min: int | None = None
    guests: int | None = None
    # buddy: {diet:[], allergies:[], pace, places:[place_id ≤3], note ≤300자, diet_other?, allergy_other? (≤40자)}
    # dorm: {late_checkin, quiet_room, low_floor}
    request: dict | None = None
    course_id: int | None = None  # buddy: 같이 걸을 코스 (tours.id)
    meal_count: int = 0  # buddy: 0~4
    album: bool = False  # buddy


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
    request: dict | None = None  # 본인·운영자·해당 공급자에게만
    course_id: int | None = None
    course_title: str | None = None
    meal_count: int = 0
    meal_deposit: int = 0
    meal_used: int = 0  # 식비 청구 requested + approved 합
    meal_approved: int = 0
    meal_refund: int = 0  # meal_deposit − meal_approved (여행 끝나기 전엔 예정액)
    album: bool = False
    album_photos: int = 0
    reviewed: bool = False
    can_review: bool = False


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


class ReplaceBuddyIn(BaseModel):
    buddy_id: int
    date: date_ | None = None
    time: str | None = None


class ReviewIn(BaseModel):
    item_id: int
    rating: int
    text: str | None = None
    sub_scores: dict[str, int] | None = None  # {kind, talk, punctual, local} 1~5
    tags: list[str] | None = None


class AlbumItem(BaseModel):
    item_id: int
    buddy_name: str
    date: date_
    places: list[str] = []
    photos: list[str] = []


class AlbumOut(BaseModel):
    items: list[AlbumItem]


class DecideIn(BaseModel):
    action: str  # approve | reject
    reason: str | None = None
