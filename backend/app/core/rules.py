"""v3 숫자 규칙·코드값 (계약서 §1·§3). 사실 값은 여기와 DB에서만."""
from datetime import date
from decimal import Decimal
from typing import NamedTuple

MEAL_LIMIT = 20000  # 식사 1회 한도(2인), 보증금 = 횟수 × 한도
MEAL_MAX = 4  # 버디 항목 1개당 식사 최대 횟수
ALBUM_FEE = 5000  # 여행 앨범(사진 기록). v3.6: 활동비처럼 버디 정산율로 나눈다
REPORT_SUSPEND_AT = 2

# ---- 돈 규칙: 금액은 원 단위 int, 비율은 퍼센트 int. 소수(float) 계산을 쓰지 않는다
REFUND_RULES = ((7, 100), (3, 50))  # (첫 일정까지 남은 날 이상, 환불 퍼센트). 나머지는 0%


def pct(amount: int, percent: int) -> int:
    """금액 × 퍼센트 ÷ 100, 원 단위 반올림(0.5원은 올림). 정수만 쓴다."""
    if amount < 0 or percent < 0:
        raise ValueError("amount·percent는 0 이상")
    return (amount * percent + 50) // 100


def refund_percent(days_left: int) -> int:
    """첫 일정까지 남은 날로 환불 퍼센트: 7일 전까지 100, 3일 전까지 50, 이후 0"""
    for days, percent in REFUND_RULES:
        if days_left >= days:
            return percent
    return 0
QUIZ_TOTAL, QUIZ_PASS = 10, 8
BUDDY_MIN_AGE = 19

# ---- 버디 등급·정산율 (v3.7: 매달 1일, 지난달 동행으로 평가)
# 운영 방학 (이름, 시작, 끝). v3.7부터 등급 평가에는 쓰지 않고, 휴면 일수(운영 기간만 셈)에만 쓴다
VACATIONS = [
    ("2025 겨울방학", date(2025, 12, 22), date(2026, 2, 28)),
    ("2026 여름방학", date(2026, 6, 22), date(2026, 8, 31)),
    ("2027 겨울방학", date(2026, 12, 21), date(2027, 2, 28)),
]


class Grade(NamedTuple):
    code: str
    label: str
    rating: Decimal  # 누적 평균 평점 이상
    walks: int  # 지난달(평가 달) 완료 동행 이상 — 누적 아님
    reviews: int  # 누적 후기 이상
    rate: Decimal  # 버디 정산율 ((활동비 + 앨범) 기준)


GRADES = [  # 높은 등급부터. 우수는 지금 성장(또는 우수)일 때만, 올라갈 때는 한 단계씩 (services/grades.decide)
    Grade("top", "우수", Decimal("4.5"), 7, 5, Decimal("0.800")),
    Grade("growth", "성장", Decimal("4.3"), 4, 3, Decimal("0.750")),
    Grade("basic", "기본", Decimal(0), 0, 0, Decimal("0.700")),
]
GRADE_BY_CODE = {g.code: g for g in GRADES}
GRADE_NOTE = "등급은 매달 1일, 지난달 동행으로 다시 정해요. 올라갈 때는 한 단계씩, 내려갈 때는 조건에 맞는 등급으로 바로 가요."
DORMANT_DAYS = 30  # 운영 기간 중 이만큼 활동이 없으면 휴면(요청 받기 멈춤). 등급과는 상관없다

# ---- v3.7 버디 자격 (지원 1단계) · 사전 교육
ELIGIBILITY = {"school_email": "성북구 대학 메일", "residence": "성북구 거주"}
# 사전 교육 영상 (id, 제목, 다루는 것, 길이 초). 데모: 영상 파일은 아직 없다(화면은 '영상 준비 중')
EDUCATION_VIDEOS = [
    ("seongbuk_overview", "성북구 한눈에 보기", "주요 장소와 동네: 성북동·정릉·안암·돈암·길음", 180),
    ("getting_around", "길 안내와 교통", "지하철 4·6호선·우이신설선, 마을버스, 택시 부르기", 150),
    ("safety", "안전과 응급", "가까운 병원·약국·화장실, 112·119·1330", 160),
    ("history_basics", "역사 기본 상식", "한양도성·성북동 문인·독립운동 — 해설이 아니라 기본 상식", 200),
    ("promises", "버디 약속과 하지 말 것", "유료 해설·차량 동행 금지, 앱 밖에서 돈 받지 않기", 120),
]
EDUCATION_IDS = [v[0] for v in EDUCATION_VIDEOS]

DIET = {"vegan": "비건", "vegetarian": "채식", "halal": "할랄", "no_pork": "돼지고기 X", "no_beef": "소고기 X", "no_alcohol": "술 X"}
ALLERGIES = {"mushroom": "버섯", "nuts": "견과류", "seafood": "해산물", "dairy": "유제품", "egg": "달걀", "gluten": "밀"}
PACE = {"slow": "천천히", "normal": "보통"}
DORM_REQUESTS = {"late_checkin": "늦은 체크인", "quiet_room": "조용한 방", "low_floor": "낮은 층"}
PERSONALITY = {"calm": "차분해요", "lively": "활발해요", "listener": "잘 들어줘요", "humor": "유머 있어요"}
STYLE = {"slow_walk": "천천히 걸어요", "explore": "많이 돌아봐요", "cafe_break": "카페에서 쉬어 가요", "photo_walk": "사진 위주"}
CAN_HELP = {"vegan_food": "비건 식당 안내", "halal_food": "할랄 식당 안내", "photo": "사진 찍어 주기", "subway": "지하철 타는 법", "shopping": "쇼핑"}
SUB_SCORES = ("kind", "talk", "punctual", "local")
REVIEW_TAGS = {"fun_talk": "대화가 즐거워요", "knows_food": "맛집을 잘 알아요", "good_photos": "사진을 잘 찍어 줘요",
               "cares_requests": "요청을 잘 챙겨요", "easy_guide": "길 안내가 편해요"}
REPORT_CATEGORY = {"no_show": "약속 장소에 오지 않았어요", "rude": "불편한 말이나 행동", "money": "돈이나 선물 요구",
                   "unsafe": "안전이 걱정돼요", "other": "기타"}
NEED_FOR_DIET = {"vegan": "vegan_food", "vegetarian": "vegan_food", "halal": "halal_food"}  # 요청 → 도움 (매칭용)

# ---- v3.4 무료 AI 산책 코스 (버디 없이 혼자 걷는 무료 이용)
FREE_AI_QUESTIONS = 3  # 무료 이용자가 하루에 AI-02에 할 수 있는 질문 수 (장소 소개는 세지 않음)
SURVEY_PAIN = {"ads": "광고가 귀찮았어요", "question_limit": "질문 3번이 모자랐어요",
               "route_fit": "동선이 내 숙소·시간과 안 맞았어요", "no_help": "길을 잃었을 때 물어볼 사람이 없었어요",
               "none": "딱히 없었어요"}

# ---- v3.5 코스 걷는 시간 (services/courses.py). 둘 다 추정값: 실제 길·언덕·걸음 빠르기에 따라 달라진다
WALK_DETOUR_PERCENT = 130  # 직선거리 × 1.3 = 실제 걷는 길 (골목·언덕을 돌아가는 몫, 추정)
WALK_M_PER_HOUR = 4000  # 걷는 속도 4 km/h (언덕이 많은 성북동 보통 걸음, 추정)
DURATION_STEP_MIN = 10  # 코스 전체 시간은 10분 단위로 올린다


def request_summary(req: dict | None) -> str:
    """버디 요청을 한국어 한 줄로: '비건, 버섯 알레르기, 천천히'"""
    if not req:
        return ""
    parts = [DIET.get(d, d) for d in req.get("diet") or []]
    parts += [f"{ALLERGIES.get(a, a)} 알레르기" for a in req.get("allergies") or []]
    if req.get("pace") == "slow":
        parts.append(PACE["slow"])
    return ", ".join(parts)


def age_on(birth, today) -> int:
    return today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
