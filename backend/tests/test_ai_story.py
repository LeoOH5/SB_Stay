"""AI-02 역사 스토리: 소개·질문 답(규칙 검색), 자료 밖 질문, LLM 답 검증, 권한·입력 오류"""
from app.routers import ai as ai_router
from app.services import llm, story

URL = "/api/v1/ai/story"


def _no_llm(monkeypatch):
    async def fail(*_a, **_k):
        raise llm.LLMUnavailable("test")
    monkeypatch.setattr(llm, "complete_json", fail)


def test_story_intro_ko_and_en(client, tourist, monkeypatch):
    _no_llm(monkeypatch)
    ko = client.post(URL, json={"place_id": 103, "language": "ko"}, headers=tourist).json()
    assert ko["grounded"] is True and ko["ai"] is False and "한용운" in ko["answer"]
    assert ko["sources"] and ko["sources"][0]["url"].startswith("https://")
    en = client.post(URL, json={"place_id": 103, "language": "en"}, headers=tourist).json()
    assert "Han Yong-un" in en["answer"] and en["grounded"] is True


def test_story_answers_from_document(client, tourist, monkeypatch):
    _no_llm(monkeypatch)
    en = client.post(URL, json={"place_id": 103, "question": "Why does this house face north?", "language": "en"},
                     headers=tourist).json()
    assert en["grounded"] is True and "Government-General" in en["answer"]
    ko = client.post(URL, json={"place_id": 103, "question": "집이 왜 북향이에요?", "language": "ko"}, headers=tourist).json()
    assert ko["grounded"] is True and "조선총독부" in ko["answer"]


def test_story_outside_document_is_not_grounded(client, tourist, monkeypatch):
    _no_llm(monkeypatch)
    r = client.post(URL, json={"place_id": 103, "question": "Who won the 2002 World Cup?", "language": "en"},
                    headers=tourist).json()
    assert r["grounded"] is False and r["answer"] == story.NOT_FOUND["en"]
    assert r["sources"]  # 출처는 항상 포함


def test_story_uses_llm_and_rejects_invented_numbers(client, tourist, monkeypatch):
    calls = []

    async def fake(system, user):
        calls.append(user)
        assert "ONLY facts" in system and "DOCUMENT:" in user and "심우장" in user
        if len(calls) == 1:
            return {"answer": "He refused to face the Government-General building.", "grounded": True}
        return {"answer": "He built it in 1925.", "grounded": True}  # 문서에 없는 연도

    monkeypatch.setattr(llm, "complete_json", fake)
    body = {"place_id": 103, "question": "Why north?", "language": "en"}
    first = client.post(URL, json=body, headers=tourist).json()
    assert first["ai"] is True and first["answer"].startswith("He refused")
    second = client.post(URL, json=body, headers=tourist).json()
    assert second["ai"] is False  # 지어낸 숫자 → 규칙 답으로 대신


def test_story_intro_cache(client, tourist, monkeypatch):
    ai_router._intro_cache.clear()
    n = []

    async def fake(system, user):
        n.append(1)
        return {"answer": "A short story.", "grounded": True}

    monkeypatch.setattr(llm, "complete_json", fake)
    for _ in range(2):
        r = client.post(URL, json={"place_id": 102, "language": "en"}, headers=tourist).json()
        assert r["answer"] == "A short story." and r["ai"] is True
    assert len(n) == 1  # 두 번째는 저장해 둔 소개
    ai_router._intro_cache.clear()


def test_story_errors_and_roles(client, tourist, buddy, monkeypatch):
    _no_llm(monkeypatch)
    assert client.post(URL, json={"place_id": 99999}, headers=tourist).status_code == 404
    assert client.post(URL, json={"place_id": 103}).status_code == 401
    assert client.post(URL, json={"place_id": 103, "language": "ja"}, headers=tourist).status_code == 422
    assert client.post(URL, json={"language": "ko"}, headers=tourist).status_code == 422
    assert client.post(URL, json={"place_id": 103}, headers=buddy).status_code == 200  # 모든 역할 허용


def test_parse_hides_data_team_notes():
    doc = story.parse("## 한 줄 소개\n작은 문 [확인 필요: 출처 없음].\n\n## 기본 사실과 이야기\n- 역사 이야기는 없어도 됨\n- 1994년 다시 지었다")
    assert doc["ko"].intro == "작은 문."
    assert doc["ko"].story == ["1994년 다시 지었다"]
    assert story.tokens("백석은 누구예요?") == {"백석", "누구"}
