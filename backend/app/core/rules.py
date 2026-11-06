"""v3 숫자 규칙·코드값 (계약서 §1·§3). 사실 값은 여기와 DB에서만."""
MEAL_LIMIT = 20000  # 식사 1회 한도(2인), 보증금 = 횟수 × 한도
MEAL_MAX = 4  # 버디 항목 1개당 식사 최대 횟수
ALBUM_FEE = 5000
REPORT_SUSPEND_AT = 2
QUIZ_TOTAL, QUIZ_PASS = 10, 8
BUDDY_MIN_AGE = 19

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
