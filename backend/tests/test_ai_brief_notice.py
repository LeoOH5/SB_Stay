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
    assert b["places"][0]["name"] == "성북근현대문학관"  # 같은 예약의 투어 3번 코스 순서
    assert "문인의 성북동 산책" in b["brief"] and b["phrases"]
    assert "입장료 1,000원" in b["places"][0]["tips"]  # 요금은 DB 값
    spec = client.post(BRIEF, json={"booking_item_id": 3}, headers=buddy)  # 명세 형식
    assert spec.status_code == 200


def test_brief_guide_gets_own_tour_item(client, guide, monkeypatch):
    _no_llm(monkeypatch)
    r = client.post(BRIEF, json={"booking_item_id": 2}, headers=guide)
    assert r.status_code == 200 and "코스 순서" in r.json()["brief"]


def test_brief_llm_and_number_guard(client, buddy, monkeypatch):
    replies = [
        {"brief": "Emma 님은 오전에 문학 투어를 들었어요. 심우장 이야기로 시작해 보세요.", "phrases": ["Did you enjoy the tour?"]},
        {"brief": "입장료는 5,000원이에요.", "phrases": ["Hi!"]},  # 자료에 없는 금액
    ]

    async def fake(system, user):
        assert "MATERIAL:" in user and "Simujang" in user
        return replies.pop(0)

    monkeypatch.setattr(llm, "complete_json", fake)
    first = client.post(BRIEF, json={"booking_item_id": 3}, headers=buddy).json()
    assert first["ai"] is True and first["phrases"] == ["Did you enjoy the tour?"]
    second = client.post(BRIEF, json={"booking_item_id": 3}, headers=buddy).json()
    assert second["ai"] is False and "5,000" not in second["brief"]


def test_brief_permissions(client, buddy, tourist, monkeypatch):
    _no_llm(monkeypatch)
    assert client.post(BRIEF, json={"booking_item_id": 13}, headers=buddy).status_code == 403  # 다른 버디(32번) 항목
    assert client.post(BRIEF, json={"booking_item_id": 2}, headers=buddy).status_code == 403  # 투어 항목
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
