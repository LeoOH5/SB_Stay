"""v3.4 무료 AI 산책 코스: 이용 방식(free|buddy), AI-02 질문 하루 3번, 코스 완료 설문, 버디만 예약"""
from datetime import date

from sqlalchemy import select

from app.core.config import get_settings
from app.models import AiUsage, CourseSurvey, User
from app.services import llm
from tests.conftest import login

PLAN = "/api/v1/auth/me/plan"
STORY = "/api/v1/ai/story"
Q = {"place_id": 103, "question": "집이 왜 북향이에요?", "language": "ko"}
INTRO = {"place_id": 103, "language": "ko"}
BUDDY_ONLY = {"type": "buddy", "ref_id": 31, "date": "2027-01-20", "time": "10:00", "duration_min": 120}
TRAVELER = {"name": "Kim Free", "nationality": "US", "email": "free@example.com", "guests": 1}


def _no_llm(monkeypatch):
    async def fail(*_a, **_k):
        raise llm.LLMUnavailable("test")
    monkeypatch.setattr(llm, "complete_json", fail)


def _signup(client, email="new-free@example.com") -> dict:
    r = client.post("/api/v1/auth/signup", json={"name": "New Free", "email": email, "password": "demo12345", "language": "en"})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_plan_detection(client, tourist, buddy, operator):
    emma = client.get(PLAN, headers=tourist).json()  # 결제한 숙박 + 버디 예약이 있음
    assert emma == {"plan": "buddy", "ai_question_limit": None, "ai_questions_left_today": None, "ai_questions_used_today": 0}
    noah = client.get(PLAN, headers=login(client, "noah@example.com")).json()  # 예약 없는 무료 데모 계정
    assert noah["plan"] == "free" and noah["ai_question_limit"] == 3 and noah["ai_questions_left_today"] == 3
    assert client.get(PLAN, headers=buddy).json()["plan"] == "buddy"  # 관광객이 아니면 제한 없음
    assert client.get(PLAN, headers=operator).json()["plan"] == "buddy"
    assert client.get(PLAN).status_code == 401


def test_buddy_only_booking_makes_buddy_plan(client, reset_db):
    """버디만(숙박 없이) 예약도 된다. 결제하면 buddy, 예약을 취소하면 다시 free."""
    h = _signup(client)
    assert client.get(PLAN, headers=h).json()["plan"] == "free"
    r = client.post("/api/v1/bookings", json={"traveler": TRAVELER, "items": [BUDDY_ONLY]}, headers=h)
    assert r.status_code == 201, r.text
    b = r.json()
    assert [i["type"] for i in b["items"]] == ["buddy"] and b["total_price"] == 30000
    assert client.get(PLAN, headers=h).json()["plan"] == "free"  # 결제 전에는 아직 무료
    assert client.post(f"/api/v1/bookings/{b['id']}/pay", headers=h).status_code == 200
    assert client.get(PLAN, headers=h).json()["plan"] == "buddy"
    assert client.post(f"/api/v1/bookings/{b['id']}/cancel", json={}, headers=h).status_code == 200
    assert client.get(PLAN, headers=h).json()["plan"] == "free"


def test_free_question_limit(client, db, monkeypatch, reset_db):
    _no_llm(monkeypatch)
    h = login(client, "noah@example.com")
    for left in (2, 1, 0):
        r = client.post(STORY, json=Q, headers=h)
        assert r.status_code == 200 and r.json()["questions_left"] == left
        # 장소 소개(질문 없음)는 세지 않는다
        intro = client.post(STORY, json=INTRO, headers=h)
        assert intro.status_code == 200 and intro.json()["questions_left"] is None
    r = client.post(STORY, json=Q, headers=h)
    assert r.status_code == 429 and r.json()["error"]["code"] == "AI_LIMIT" and "하루 3번" in r.json()["error"]["message"]
    assert client.post(STORY, json=INTRO, headers=h).status_code == 200  # 한도 뒤에도 소개는 된다
    assert client.get(PLAN, headers=h).json()["ai_questions_left_today"] == 0
    # 질문 수는 DB에 남는다 (서버를 다시 켜도 이어짐). 한도를 넘은 요청은 세지 않는다
    noah = db.scalar(select(User).where(User.email == "noah@example.com"))
    row = db.scalar(select(AiUsage).where(AiUsage.user_id == noah.id))
    assert row.day == date(2027, 1, 14) and row.questions == 3

    # 다음 날(설정의 today)이 되면 다시 3번
    monkeypatch.setattr(get_settings(), "demo_today", date(2027, 1, 15))
    assert client.get(PLAN, headers=h).json()["ai_questions_left_today"] == 3
    r = client.post(STORY, json=Q, headers=h)
    assert r.status_code == 200 and r.json()["questions_left"] == 2


def test_buddy_plan_unlimited_questions(client, tourist, monkeypatch, reset_db):
    _no_llm(monkeypatch)
    for _ in range(5):
        r = client.post(STORY, json=Q, headers=tourist)
        assert r.status_code == 200 and r.json()["questions_left"] is None
    assert client.get(PLAN, headers=tourist).json()["ai_questions_used_today"] == 0


def test_unknown_place_does_not_count(client, monkeypatch, reset_db):
    _no_llm(monkeypatch)
    h = login(client, "noah@example.com")
    assert client.post(STORY, json=Q | {"place_id": 99999}, headers=h).status_code == 404
    assert client.get(PLAN, headers=h).json()["ai_questions_left_today"] == 3


def test_course_survey(client, db, buddy, reset_db):
    h = login(client, "noah@example.com")
    url = "/api/v1/tours/3/survey"
    r = client.post(url, json={"satisfaction": 4, "pain": "no_help", "want_buddy": True}, headers=h)
    assert r.status_code == 201, r.text
    out = r.json()
    assert out["tour_id"] == 3 and out["satisfaction"] == 4 and out["pain"] == "no_help" and out["want_buddy"] is True
    assert out["plan"] == "free"
    row = db.get(CourseSurvey, out["id"])
    assert row is not None and row.pain == "no_help"
    assert client.post(url, json={"satisfaction": 6, "pain": "ads", "want_buddy": False}, headers=h).status_code == 422
    bad = client.post(url, json={"satisfaction": 3, "pain": "too_slow", "want_buddy": False}, headers=h)
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "VALIDATION"
    assert client.post("/api/v1/tours/999/survey", json={"satisfaction": 3, "pain": "ads", "want_buddy": False}, headers=h).status_code == 404
    assert client.post(url, json={"satisfaction": 3, "pain": "ads", "want_buddy": False}, headers=buddy).status_code == 403
    assert client.post(url, json={"satisfaction": 3, "pain": "ads", "want_buddy": False}).status_code == 401
