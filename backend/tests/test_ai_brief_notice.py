"""AI-04 동행 준비 자료 · AI-05 다국어 안내문 초안"""
from app.services import llm

BRIEF = "/api/v1/ai/buddy-brief"
NOTICE = "/api/v1/ai/translate-notice"


def _no_llm(monkeypatch):
    async def fail(*_a, **_k):
        raise llm.LLMUnavailable("test")
    monkeypatch.setattr(llm, "complete_json", fail)


def test_brief_for_own_buddy_item(client, buddy, monkeypatch):
    _no_llm(monkeypatch)
    r = client.post(BRIEF, json={"item_id": 3, "booking_code": "SB-2027-0112"}, headers=buddy)  # 프론트 형식
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["booking_item_id"] == 3 and b["ai"] is False
    assert b["places"][0]["name"] == "성북근현대문학관"  # 버디 항목 course_id 3번 코스 순서
    assert b["brief"].startswith("비건, 버섯 알레르기 요청이 있어요. 식당에서 꼭 확인해 주세요.")  # 요청이 첫 문장
    assert "천천히" in b["brief"] and "문인의 성북동 산책" in b["brief"] and "투어" not in b["brief"] and b["phrases"]
    assert "입장료 1,000원" in b["places"][0]["tips"]  # 요금은 DB 값
    spec = client.post(BRIEF, json={"booking_item_id": 3}, headers=buddy)  # 명세 형식
    assert spec.status_code == 200


def test_brief_places_from_request_without_course(client, buddy, db, monkeypatch, reset_db):
    """코스가 없으면 요청의 places (그날 여는 곳)"""
    from app.models import BookingItem
    _no_llm(monkeypatch)
    it = db.get(BookingItem, 3)
    it.course_id = None
    db.commit()
    b = client.post(BRIEF, json={"booking_item_id": 3}, headers=buddy).json()
    assert [p["name"] for p in b["places"]] == ["길상사", "수연산방(이태준 가옥)"]


def test_brief_mentions_other_text(client, buddy, db, monkeypatch, reset_db):
    """'기타' 직접 입력도 첫 문장(대체 문구)과 LLM 자료에 들어간다"""
    from app.models import BookingItem
    _no_llm(monkeypatch)
    it = db.get(BookingItem, 3)
    it.request = (it.request or {}) | {"diet_other": "고수", "allergy_other": "복숭아"}
    db.commit()
    b = client.post(BRIEF, json={"booking_item_id": 3}, headers=buddy).json()
    assert b["ai"] is False
    assert b["brief"].startswith("비건, 기타: 고수, 버섯 알레르기, 복숭아 알레르기 요청이 있어요.")

    async def fake(system, user):
        assert "Traveler requests: 비건, 기타: 고수, 버섯 알레르기, 복숭아 알레르기" in user
        return {"brief": "고수와 복숭아를 피하는 식당을 골라 주세요.", "phrases": ["Hi!"]}

    monkeypatch.setattr(llm, "complete_json", fake)
    assert client.post(BRIEF, json={"booking_item_id": 3}, headers=buddy).json()["ai"] is True


def test_brief_llm_and_number_guard(client, buddy, monkeypatch):
    replies = [
        {"brief": "Emma 님은 오전에 문학 투어를 들었어요. 심우장 이야기로 시작해 보세요.", "phrases": ["Did you enjoy the tour?"]},
        {"brief": "입장료는 5,000원이에요.", "phrases": ["Hi!"]},  # 자료에 없는 금액
    ]

    async def fake(system, user):
        assert "MATERIAL:" in user and "Simujang" in user and "Traveler requests: 비건, 버섯 알레르기" in user
        return replies.pop(0)

    monkeypatch.setattr(llm, "complete_json", fake)
    first = client.post(BRIEF, json={"booking_item_id": 3}, headers=buddy).json()
    assert first["ai"] is True and first["phrases"] == ["Did you enjoy the tour?"]
    second = client.post(BRIEF, json={"booking_item_id": 3}, headers=buddy).json()
    assert second["ai"] is False and "5,000" not in second["brief"]


def test_brief_llm_gets_no_traveler_name_or_nationality(client, buddy, db, monkeypatch):
    """v3.9 개인정보: LLM에는 여행자 이름·국적을 보내지 않는다 (요청 사항·코스·장소만)"""
    from app.models import Booking, BookingItem
    item = db.get(BookingItem, 3)
    traveler = db.get(Booking, item.booking_id).traveler or {}
    seen: list[str] = []

    async def fake(system, user):
        seen.append(system + "\n" + user)
        return {"brief": "여행자와 천천히 걸어요.", "phrases": ["Shall we rest here?"]}

    monkeypatch.setattr(llm, "complete_json", fake)
    r = client.post(BRIEF, json={"booking_item_id": 3}, headers=buddy)
    assert r.status_code == 200 and r.json()["ai"] is True
    sent = seen[0]
    assert "name withheld" in sent and "Traveler requests: 비건, 버섯 알레르기" in sent
    for secret in [traveler.get("name"), (traveler.get("name") or "").split(" ")[0], traveler.get("nationality"), traveler.get("passport_no")]:
        if secret:
            assert secret not in sent


def test_brief_permissions(client, buddy, tourist, monkeypatch):
    _no_llm(monkeypatch)
    assert client.post(BRIEF, json={"booking_item_id": 13}, headers=buddy).status_code == 403  # 다른 버디(32번) 항목
    assert client.post(BRIEF, json={"booking_item_id": 1}, headers=buddy).status_code == 403  # 숙박 항목
    assert client.post(BRIEF, json={"booking_item_id": 3}, headers=tourist).status_code == 403
    assert client.post(BRIEF, json={"booking_item_id": 99999}, headers=buddy).status_code == 404
    assert client.post(BRIEF, json={}, headers=buddy).status_code == 422
    assert client.post(BRIEF, json={"booking_item_id": 3}).status_code == 401


TEXT = "체크인은 15:00부터 가능합니다. 취사는 금지입니다."


def test_notice_without_key_returns_original(client, operator, monkeypatch):
    _no_llm(monkeypatch)
    r = client.post(NOTICE, json={"text": TEXT, "target_languages": ["en", "ja"]}, headers=operator).json()
    assert r["ai"] is False and r["drafts"] == {"en": TEXT, "ja": TEXT} and r["warnings"]


def test_notice_llm_and_number_check(client, operator, monkeypatch):
    async def fake(system, user):
        assert "Keep every time" in system and TEXT in user
        return {"en": "Check-in is available from 15:00. Cooking is not allowed.", "ja": "チェックインは午後3時からです。"}

    monkeypatch.setattr(llm, "complete_json", fake)
    r = client.post(NOTICE, json={"text": TEXT, "target_languages": ["en", "ja"]}, headers=operator).json()
    assert r["ai"] is True and r["drafts"]["en"].startswith("Check-in")
    assert r["warnings"] == ["ja: 15:00 없음"]  # 숫자가 바뀐 초안을 알려 줌


def test_notice_permissions(client, operator, tourist):
    assert client.post(NOTICE, json={"text": TEXT, "target_languages": ["en"]}, headers=tourist).status_code == 403
    assert client.post(NOTICE, json={"text": TEXT, "target_languages": []}, headers=operator).status_code == 422
    assert client.post(NOTICE, json={"target_languages": ["en"]}, headers=operator).status_code == 422
