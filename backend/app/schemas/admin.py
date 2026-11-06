from datetime import date, datetime

from pydantic import BaseModel, Field


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
    age: int | None = None
    school_email_verified: bool = False
    code_agreed: bool = False
    quiz_score: int | None = None
    report_count: int = 0  # 기각 제외 신고 수
    can_help: list[str] = []


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
    party_type: str  # university | buddy
    party_id: int
    target: str
    count: int
    revenue: int  # 숙박 매출 또는 버디 활동비 (앨범·식사 보증금 제외)
    fee: int
    meals: int = 0  # 버디: 승인 식비 (수수료 없음)
    payout: int  # revenue − fee + meals
    status: str  # pending | meal_pending | settled


class SettlementsOut(BaseModel):
    period: dict
    total: int
    meal_refund_total: int = 0  # 여행자에게 돌려줄 남은 식사 보증금 합
    items: list[SettlementRow]


class AdminTourRow(BaseModel):
    """AD-07 코스 행"""
    id: int
    title: str
    theme: str
    duration_min: int
    places: list[str] = []
    place_count: int
    story_ready: int  # 이야기 자료(story_doc)가 있는 장소 수
    buddy_walks: int  # 이 코스를 고른 버디 항목 수 (취소 제외)


class MealDecideIn(BaseModel):
    action: str  # approve | reject
    reason: str | None = None


class ReportIn(BaseModel):
    booking_item_id: int
    category: str  # no_show | rude | money | unsafe | other
    text: str = Field(min_length=1, max_length=2000)
    photo_url: str | None = Field(default=None, max_length=500)


class ReportOut(BaseModel):
    id: int
    booking_item_id: int | None = None
    buddy_id: int
    category: str
    text: str
    photo_url: str | None = None
    status: str
    auto_suspended: bool
    created_at: datetime


class AdminReportRow(BaseModel):
    id: int
    created_at: datetime
    buddy_id: int
    buddy_name: str
    buddy_university: str
    reporter: str
    booking_code: str | None = None
    category: str
    text: str
    photo_url: str | None = None
    count_for_buddy: int  # 이 버디의 신고 수 (기각 제외)
    status: str  # open | resolved | dismissed
    action: str | None = None
    auto_suspended: bool
    buddy_status: str


class ReportActionIn(BaseModel):
    action: str  # warn | suspend | unsuspend | dismiss
