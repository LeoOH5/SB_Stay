"""AI-01 여행 설계: 폴백(키 없음), LLM 선택 검증, 예산·권한·입력 오류"""
from app.services import llm

DEMO = {"check_in": "2027-01-12", "check_out": "2027-01-15", "budget": 200000,
        "interests": ["literature", "independence"], "with_buddy": True, "language": "en"}


def _no_llm(monkeypatch):
    async def fail(*_a, **_k):
        raise llm.LLMUnavailable("test")
    monkeypatch.setattr(llm, "complete_json", fail)


def _items(plan):
    return [it for d in plan["days"] for it in d["items"]]


def test_plan_fallback_shape(client, tourist, monkeypatch):
    _no_llm(monkeypatch)
    r = client.post("/api/v1/ai/plan", json=DEMO, headers=tourist)
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["plan_id"].startswith("pl_") and p["ai"] is False and p["reason"]
    assert [d["date"] for d in p["days"]] == ["2027-01-12", "2027-01-13", "2027-01-14", "2027-01-15"]
    dorm = [i for i in _items(p) if i["type"] == "dorm"]
    room = client.get(f"/api/v1/dorms/{dorm[0]['ref_id']}").json()
    assert len(dorm) == 1 and dorm[0]["price"] == room["price_per_night"] * 3  # DB 가격 그대로
    assert p["total_price"] == sum(i["price"] for i in _items(p)) <= DEMO["budget"]
    buddy = [i for i in _items(p) if i["type"] == "buddy"]
    assert buddy and buddy[0]["ref_id"] in (31, 32, 35, 36)


def test_plan_tour_only_on_operating_day(client, tourist, monkeypatch):
    """투어는 운영 요일에만 들어간다 (1/12~1/15는 화~금, 토·일 투어는 못 들어감)"""
    _no_llm(monkeypatch)
    p = client.post("/api/v1/ai/plan", json=DEMO, headers=tourist).json()
    for d in p["days"]:
        for it in d["items"]:
            if it["type"] == "tour":
                tour = client.get(f"/api/v1/tours/{it['ref_id']}").json()
                from datetime import date
                wd = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"][date.fromisoformat(d["date"]).weekday()]
                assert wd in tour["operating_days"]


def test_plan_weekend_includes_tour(client, tourist, monkeypatch):
    _no_llm(monkeypatch)
    body = DEMO | {"check_in": "2027-01-15", "check_out": "2027-01-18"}  # 금~월, 토·일 포함
    p = client.post("/api/v1/ai/plan", json=body, headers=tourist).json()
    tours = [i for i in _items(p) if i["type"] == "tour"]
    assert tours and tours[0]["ref_id"] in (3, 4)  # 문학·독립운동 테마 우선


def test_plan_uses_llm_choice_and_rejects_unknown_ids(client, tourist, monkeypatch):
    async def fake(system, user):
        assert "Tour candidates" in user and "Never invent" in system
        return {"tour_id": 999, "tour_date": "2027-01-13", "buddy_id": 35, "buddy_date": "2027-01-13",
                "free_place_ids": [105, 9999], "reason": "Picked for a poetry lover."}
    monkeypatch.setattr(llm, "complete_json", fake)
    p = client.post("/api/v1/ai/plan", json=DEMO, headers=tourist).json()
    assert p["ai"] is True and p["reason"].startswith("Picked for a poetry lover.")
    assert all(i["ref_id"] != 999 for i in _items(p))  # 없는 투어 id는 버림
    assert any(i["type"] == "buddy" and i["ref_id"] == 35 for i in _items(p))


def test_plan_budget_drops_extras(client, tourist, monkeypatch):
    _no_llm(monkeypatch)
    p = client.post("/api/v1/ai/plan", json=DEMO | {"budget": 110000}, headers=tourist).json()
    assert p["total_price"] <= 110000
    assert not [i for i in _items(p) if i["type"] == "buddy"]


def test_plan_validation_and_role(client, tourist, buddy, monkeypatch):
    _no_llm(monkeypatch)
    bad = DEMO | {"check_in": "2027-01-15", "check_out": "2027-01-12"}
    assert client.post("/api/v1/ai/plan", json=bad, headers=tourist).status_code == 422
    assert client.post("/api/v1/ai/plan", json=DEMO | {"budget": -1}, headers=tourist).status_code == 422
    assert client.post("/api/v1/ai/plan", json=DEMO, headers=buddy).status_code == 403
    assert client.post("/api/v1/ai/plan", json=DEMO).status_code == 401


def test_extract_json_handles_fences():
    assert llm._extract_json('Sure!\n```json\n{"a": 1}\n```') == {"a": 1}
