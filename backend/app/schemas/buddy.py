from datetime import date, datetime

from pydantic import BaseModel, Field


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
    school_email: str | None = None
    school_email_verified: bool = False
    code_agreed: bool = False
    quiz_score: int | None = None
    rating: float = 0
    review_count: int = 0
    personality: list[str] = []
    style: list[str] = []
    can_help: list[str] = []
    bank_account: str | None = None  # 본인에게만 (정산 화면은 마스킹)
    can_drive: bool = False  # 운전 가능 표시만. 차량 동행·유상 운송은 하지 않는다


class BuddyProfileIn(BaseModel):
    major: str | None = None
    year: int | None = None
    languages: list[str] | None = None
    interests: list[str] | None = None
    intro: str | None = None
    avatar: str | None = None
    hourly_fee: int | None = None
    personality: list[str] | None = None
    style: list[str] | None = None
    can_help: list[str] | None = None
    bank_account: str | None = Field(default=None, max_length=100)
    can_drive: bool | None = None


class AvailabilityIn(BaseModel):
    dates: list[date]


class AvailabilityOut(BaseModel):
    dates: list[str]


class TouristSummary(BaseModel):
    """버디에게 보이는 여행자 정보: 이름·국적(+대화 언어)만. 여권·연락처·이메일은 없음"""
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
    request: dict | None = None  # 본인 항목이라 보임
    course_id: int | None = None
    course_title: str | None = None
    meal_count: int = 0
    album: bool = False


class EarningItem(BaseModel):
    booking_item_id: int
    date: str
    tourist: str
    activity: str
    amount: int  # 수수료 뺀 금액 (net). 식사 보증금은 넣지 않음
    status: str  # pending | paid


class EarningsOut(BaseModel):
    month: str
    period: str
    activities: int
    total_fee: int
    paid: int
    pending: int
    items: list[EarningItem]


# ---------- 식비 청구
class MealClaimIn(BaseModel):
    item_id: int
    place: str = Field(min_length=1, max_length=100)
    items: str | None = Field(default=None, max_length=500)
    amount: int = Field(gt=0, le=1_000_000)
    receipt_url: str | None = Field(default=None, max_length=500)


class MealClaimOut(BaseModel):
    id: int
    item_id: int
    booking_code: str
    tourist: str
    date: date
    place: str
    items: str | None = None
    amount: int
    limit: int = 20000
    over_limit: bool = False
    status: str  # requested | approved | rejected
    reason: str | None = None
    created_at: datetime


class AdminMealClaimOut(MealClaimOut):
    buddy_name: str
    deposit: int
    deposit_left: int  # 보증금 − (이 청구를 뺀) 다른 승인 청구 합
    request_summary: str


# ---------- 활동 기록
class ActivityIn(BaseModel):
    item_id: int | None = None
    date: date
    places: list[str] = Field(default=[], max_length=10)
    foods: str | None = Field(default=None, max_length=300)
    note: str | None = Field(default=None, max_length=1000)
    photos: list[str] = Field(default=[], max_length=20)


class ActivityOut(BaseModel):
    id: int
    item_id: int | None = None
    booking_code: str | None = None
    tourist: str | None = None
    date: date
    places: list[str] = []
    foods: str | None = None
    note: str | None = None
    photos: list[str] = []
    created_at: datetime


# ---------- 정산
class SettlementItem(BaseModel):
    item_id: int
    date: str
    tourist: str
    gross: int  # 활동비 (앨범·식사 보증금 제외)
    fee: int
    meal_approved: int
    meal_pending: int
    net: int  # gross − fee
    status: str  # confirmed | meal_pending


class BuddySettlementOut(BaseModel):
    month: str
    pay_date: str
    account: str | None = None  # 마스킹
    walks: int
    gross: int
    fee: int
    net: int
    meals_approved: int
    meals_pending: int
    payout: int  # net 합 + meals_approved
    items: list[SettlementItem]


# ---------- 지원 5단계
class ApplyStatusOut(BaseModel):
    email_verified: bool
    school_email: str | None = None
    university: str | None = None
    age_ok: bool
    code_agreed: bool
    quiz_score: int | None = None
    quiz_passed: bool
    profile_done: bool
    status: str  # none | pending | approved | suspended


class ApplyEmailIn(BaseModel):
    email: str = Field(max_length=255)


class ApplyVerifyIn(BaseModel):
    email: str = Field(max_length=255)
    code: str
    birth_date: date


class QuizQuestion(BaseModel):
    id: str
    text: str
    options: list[str]


class QuizOut(BaseModel):
    questions: list[QuizQuestion]


class QuizAnswersIn(BaseModel):
    answers: dict[str, int]  # {문제 id: 보기 번호(0부터)}


class QuizResultOut(BaseModel):
    score: int
    total: int = 10
    passed: bool
    best_score: int
