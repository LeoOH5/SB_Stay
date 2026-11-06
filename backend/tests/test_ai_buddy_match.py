"""AI-03 버디 매칭: DB 거르기(승인·날짜·언어), 점수 순 폴백, LLM 선택 검증, 권한·입력 오류"""
from app.services import llm

URL = "/api/v1/ai/buddy-match"
DEMO = {"language": "en", "date": "2027-01-13", "interests": ["literature"]}


def _no_llm(monkeypatch):
    async def fail(*_a, **_k):
        raise llm.LLMUnavailable("test")
    monkeypatch.setattr(llm, "complete_json", fail)


def test_match_fallback_filters_and_scores(client, tourist, monkeypatch):
    _no_llm(monkeypatch)
    r = client.post(URL, json=DEMO, headers=tourist | {"Accept-Language": "ko"}).json()
    ids = [m["buddy_id"] for m in r["matches"]]
    assert ids == [31, 35, 32]  # 1/13 가능 + 영어 + 승인, 문학 겹치는 버디가 먼저
    assert r["matches"][0]["score"] > r["matches"][2]["score"] and r["ai"] is False
    assert r["reason"] == "문학 관심·영어 가능한 순으로 골랐어요."
    assert "문학 관심이 같아요" in r["matches"][0]["reason"]


def test_match_never_returns_pending_or_unavailable(client, tourist, monkeypatch):
    _no_llm(monkeypatch)
    r = client.post(URL, json={"language": "zh", "date": "2027-01-14"}, headers=tourist).json()
    assert r["matches"] == []  # 33번은 중국어 가능하지만 승인 전(pending)
    r = client.post(URL, json={"language": "ja", "date": "2027-01-14", "interests": ["hanok"]}, headers=tourist).json()
    assert [m["buddy_id"] for m in r["matches"]] == [36, 31]  # 후보가 2명이면 2명만


def test_match_english_reason(client, tourist, monkeypatch):
    _no_llm(monkeypatch)
    r = client.post(URL, json=DEMO, headers=tourist | {"Accept-Language": "en"}).json()
    assert r["reason"].startswith("Sorted by") and "speaks English" in r["matches"][0]["reason"]


def test_match_llm_order_kept_and_unknown_ids_dropped(client, tourist, monkeypatch):
    async def fake(system, user):
        assert "Never invent ids" in system and "id 35" in user
        return {"matches": [{"buddy_id": 35, "reason": "Loves poetry too."}, {"buddy_id": 999, "reason": "x"},
                            {"buddy_id": 33, "reason": "pending buddy"}],
                "reason": "Poetry lovers first."}
    monkeypatch.setattr(llm, "complete_json", fake)
    r = client.post(URL, json=DEMO, headers=tourist).json()
    assert r["ai"] is True and r["reason"] == "Poetry lovers first."
    assert [m["buddy_id"] for m in r["matches"]] == [35, 31, 32]  # LLM 1명 + 점수 순으로 채움
    assert r["matches"][0]["reason"] == "Loves poetry too." and r["matches"][0]["score"] == 0.8  # 점수는 코드 값


def test_match_errors_and_roles(client, tourist, buddy, monkeypatch):
    _no_llm(monkeypatch)
    assert client.post(URL, json=DEMO).status_code == 401
    assert client.post(URL, json=DEMO, headers=buddy).status_code == 403
    assert client.post(URL, json={"date": "2027-13-01"}, headers=tourist).status_code == 422
    assert client.post(URL, json={"language": "fr"}, headers=tourist).status_code == 422
    assert client.post(URL, json={"interests": ["DROP TABLE"]}, headers=tourist).status_code == 422
