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
    university_id: int | None = None  # v3.7 거주 경로 다른 대학이면 None
    university: str = ""  # 대학 이름 (거주 경로는 적은 학교 이름)
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
    can_drive: bool = False
    korean_national: bool = False  # 한국 국적 확인
    grade: str = "basic"  # v3.2 등급·정산율 (저장값)
    payout_rate: float = 0.7
    # v3.7 매달 평가: 지난달 동행(누적 아님) · 누적 후기 · 누적 평점
    eval_month: str = ""  # 평가 달 = 지난달 "YYYY-MM"
    last_month_walks: int = 0
    total_reviews: int = 0
    avg_rating: float | None = None
    evaluated_for: str | None = None  # 지금 등급을 정한 평가 달
    approved_on: date | None = None  # 승인일 (첫 달은 기본)
    needs_recheck: bool = False  # 휴면 (목록·AI 추천에서 빠지고 새 예약 막힘. 등급은 그대로 매달 평가)
    # v3.7 자격 경로 · 사전 교육
    eligibility: str | None = None  # school_email | residence
    school_name: str | None = None
    residence_proof_url: str | None = None  # 주소 증빙 (/media/... 이면 사진, 아니면 자리 표시)
    enrollment_proof_url: str | None = None  # 재학 증명
    videos_watched: int = 0
    videos_total: int = 5


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
    revenue: int  # 숙박 매출 또는 버디 정산 대상 = 활동비 + 앨범 (식사 보증금 제외, v3.6)
    album: int = 0  # 버디: revenue 중 앨범 요금
    fee: int
    meals: int = 0  # 버디: 승인 식비 (수수료 없음)
    payout: int  # revenue − fee + meals
    payout_rate: float | None = None  # 버디: 항목별 고정 정산율의 실효값 (revenue − fee) / revenue
    status: str  # pending | meal_pending | settled


class SettlementProfit(BaseModel):
    """판매가 − 원가 = 이익. 식사 보증금은 통과 금액이라 판매가에서 뺀다"""
    sales: int  # sales_dorm + sales_buddy + sales_album
    sales_dorm: int  # 숙박비
    sales_buddy: int  # 버디 활동비 (앨범·보증금 제외)
    sales_album: int  # 앨범(사진 기록) 요금
    cost_university: int  # 대학 지급 (숙박비 × 90%)
    cost_buddy: int  # 버디 지급료 ((활동비 + 앨범) × 항목별 정산율 70~80%, 식비 제외)
    cost_buddy_album: int = 0  # cost_buddy 중 앨범 버디 몫 (v3.6)
    cost_other: int = 0  # 기타 원가 (카드 수수료 등, 지금은 0)
    profit: int  # sales − (cost_university + cost_buddy + cost_other)
    margin: float  # profit / sales (소수 셋째 자리)


class SettlementsOut(BaseModel):
    period: dict
    total: int
    meal_refund_total: int = 0  # 여행자에게 돌려줄 남은 식사 보증금 합
    profit: SettlementProfit | None = None  # 운영자만 (대학 담당자에게는 None)
    items: list[SettlementRow]


class AdminTourRow(BaseModel):
    """AD-07 코스 행"""
    id: int
    title: str
    theme: str
    duration_min: int  # v3.5 계산값 (services/courses.py: 머무는 시간 + 걷는 시간, 10분 올림)
    walk_complete: bool = True  # false = 좌표 없는 장소가 있어 걷는 시간 일부 빠짐
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
