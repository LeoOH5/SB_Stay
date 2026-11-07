from datetime import date, datetime

from pydantic import BaseModel, Field

from app.schemas.buddies import BuddyVerified


class BuddyProfileOut(BaseModel):
    id: int
    user_id: int
    name: str
    university: str
    university_id: int | None = None  # v3.7 거주 경로 다른 대학이면 None
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
    walk_count: int = 0  # 끝난 동행 수 (공개 프로필과 같은 값)
    verified: BuddyVerified | None = None


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
    amount: int  # 버디 몫 net = round((활동비 + 앨범) × 정산율). 식사 보증금은 넣지 않음
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
    receipt_url: str | None = None  # v3.6: /media/... (앱에서 올린 영수증) 또는 예전 시드 값(파일 이름)
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
    gross: int  # 정산 대상 = 활동비 + 앨범(사진 기록) (식사 보증금 제외, v3.6)
    album: int = 0  # gross 중 앨범 요금 (0 또는 5,000)
    payout_rate: float  # 확정 때 고정한 버디 정산율
    fee: int  # 플랫폼 몫 = gross − net
    meal_approved: int
    meal_pending: int
    net: int  # round(gross × payout_rate)
    status: str  # confirmed | meal_pending


class BuddySettlementOut(BaseModel):
    month: str
    pay_date: str
    account: str | None = None  # 마스킹
    grade: str  # 지금 등급 basic | growth | top
    payout_rate: float  # 지금 정산율 (항목마다는 items[].payout_rate)
    walks: int
    gross: int  # Σ (활동비 + 앨범)
    album: int = 0  # gross 중 앨범 요금 합
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
    korean_national: bool = False  # 한국 국적 확인 (외국인 유학생은 시간제 취업 허가 문제로 불가)
    status: str  # none | pending | approved | suspended
    # v3.7 자격 두 경로 + 사전 교육
    eligibility: str | None = None  # school_email | residence | None
    eligible: bool = False  # 1단계 자격 확인 끝 (메일 인증 또는 거주 서류 제출)
    school_name: str | None = None  # 거주 경로: 다니는 대학
    residence_proof_url: str | None = None
    enrollment_proof_url: str | None = None
    videos_watched: list[str] = []
    videos_total: int = 5
    education_done: bool = False  # 영상 다 봄 → 퀴즈 열림


class ApplyEmailIn(BaseModel):
    email: str = Field(max_length=255)


class ApplyCodeIn(BaseModel):
    """학교 메일 인증번호만 확인"""
    email: str = Field(max_length=255)
    code: str = Field(max_length=10)


class ApplyResidenceIn(BaseModel):
    """1단계 성북구 거주 경로: 주소 증빙 + 재학 증명 사진(POST /uploads 의 /media 주소). 운영자가 승인 때 확인"""
    school_name: str = Field(min_length=2, max_length=100)
    residence_proof_url: str = Field(max_length=500)
    enrollment_proof_url: str = Field(max_length=500)
    birth_date: date
    korean_national: bool = False


class EducationVideo(BaseModel):
    id: str
    title: str
    topics: str
    duration_sec: int
    video_url: str | None = None  # 데모: 아직 영상 없음 (화면 '영상 준비 중')
    watched: bool = False


class EducationOut(BaseModel):
    videos: list[EducationVideo]
    watched: int
    total: int
    done: bool


class ApplyVerifyIn(BaseModel):
    email: str = Field(max_length=255)
    code: str
    birth_date: date
    korean_national: bool = False  # 대한민국 국적이에요 (필수)


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


# ---------- 등급·정산율 (v3.2, v3.7 매달 평가)
class GradeStats(BaseModel):
    month: str  # 평가 달 = 지난달 "YYYY-MM"
    last_month_walks: int = 0  # 지난달 완료 동행 (누적 아님)
    this_month_walks: int = 0  # 이번 달 지금까지 완료 동행 (다음 1일 평가에 쓰임)
    reviews: int = 0  # 누적 후기
    rating: float | None = None  # 누적 평균 평점


class GradeNeed(BaseModel):
    walks: int  # 한 달 동행 이상
    reviews: int  # 누적 후기 이상
    rating: float  # 누적 평점 이상


class GradeNext(BaseModel):
    grade: str
    payout_rate: float
    need: GradeNeed


class GradeOut(BaseModel):
    """GET /buddy/grade"""
    grade: str  # basic | growth | top
    payout_rate: float
    evaluated_for: str | None = None  # 지금 등급을 정한 평가 달 "YYYY-MM" (없으면 아직 평가 전)
    next_eval_on: date  # 다음 평가일 (다음 달 1일)
    stats: GradeStats
    next: GradeNext | None = None  # 한 단계 위 기준 (우수면 null)
    keep: GradeNeed | None = None  # 지금 등급을 지키는 기준 (기본이면 null)
    first_month: bool = False  # 다음 평가까지 승인 후 첫 달 → 기본
    note: str  # rules.GRADE_NOTE
    needs_recheck: bool = False
    dormant_since: date | None = None
    updated_at: date | None = None
