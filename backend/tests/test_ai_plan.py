"""AI-01 여행 설계: 폴백(키 없음), 버디 필수(숙박 기간 안·같은 대학 우선), 무료 코스, LLM 선택 검증, 경고·권한·입력 오류"""
from datetime import date

from app.services import llm

DEMO = {"check_in": "2027-01-12", "check_out": "2027-01-15", "budget": 200000,
        "interests": ["literature", "independence"], "with_buddy": True, "language": "en"}
WD = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def _no_llm(monkeypatch):
    async def fail(*_a, **_k):
        raise llm.LLMUnavailable("test")
    monkeypatch.setattr(llm, "complete_json", fail)


def _items(plan):
    return [it for d in plan["days"] for it in d["items"]]


def _plan(client, tourist, **kw):
    r = client.post("/api/v1/ai/plan", json=DEMO | kw, headers=tourist)
    assert r.status_code == 200, r.text
    return r.json()


def test_plan_fallback_shape(client, tourist, monkeypatch):
    _no_llm(monkeypatch)
    p = _plan(client, tourist)
    assert p["plan_id"].startswith("pl_") and p["ai"] is False and p["reason"] and p["warnings"] == []
    assert [d["date"] for d in p["days"]] == ["2027-01-12", "2027-01-13", "2027-01-14", "2027-01-15"]
    dorm = [i for i in _items(p) if i["type"] == "dorm"]
    room = client.get(f"/api/v1/dorms/{dorm[0]['ref_id']}").json()
    assert len(dorm) == 1 and dorm[0]["price"] == room["price_per_night"] * 3  # DB 가격 그대로
    assert p["total_price"] == sum(i["price"] for i in _items(p)) <= DEMO["budget"]
    buddy = [i for i in _items(p) if i["type"] == "buddy"]
    assert len(buddy) == 1 and buddy[0]["ref_id"] in (31, 32, 35, 36) and buddy[0]["price"] == 30000
    assert buddy[0]["course_id"] in (3, 4)  # 문학·독립운동 코스를 버디와 함께 (무료)
    assert not [i for i in _items(p) if i["type"] in ("tour", "course")]  # 버디가 있으면 코스는 버디 항목에 붙는다


def test_plan_buddy_in_stay_same_university(client, tourist, monkeypatch):
    """숙소를 넣으면 버디는 숙박 기간 안, 숙소와 같은 대학 우선 (with_buddy=false여도 필수)"""
    _no_llm(monkeypatch)
    p = _plan(client, tourist, with_buddy=False)
    dorm = next(i for i in _items(p) if i["type"] == "dorm")
    day, buddy = next((d["date"], i) for d in p["days"] for i in d["items"] if i["type"] == "buddy")
    assert DEMO["check_in"] <= day <= DEMO["check_out"]
    uni = client.get(f"/api/v1/dorms/{dorm['ref_id']}").json()["university"]["id"]
    assert client.get(f"/api/v1/buddies/{buddy['ref_id']}").json()["university_id"] == uni


def test_plan_course_only_on_open_day(client, tourist, monkeypatch):
    """코스는 모든 장소가 그날 여는 날에만 (1/15~1/18 금~월, 월요일 휴관 장소가 있는 코스는 월요일 불가)"""
    _no_llm(monkeypatch)
    p = _plan(client, tourist, check_in="2027-01-15", check_out="2027-01-18")
    for d in p["days"]:
        for it in d["items"]:
            cid = it.get("course_id") or (it["ref_id"] if it["type"] == "course" else None)
            if cid:
                for stop in client.get(f"/api/v1/tours/{cid}").json()["places"]:
                    place = client.get(f"/api/v1/places/{stop['id']}").json()
                    assert WD[date.fromisoformat(d["date"]).weekday()] not in place["closed_days"]


def test_plan_no_buddy_warning(client, tourist, monkeypatch):
    _no_llm(monkeypatch)
    p = _plan(client, tourist, check_in="2027-02-01", check_out="2027-02-03")  # 가능한 버디 없음
    assert p["warnings"] == ["NO_BUDDY"] and not [i for i in _items(p) if i["type"] == "buddy"]
    course = [i for i in _items(p) if i["type"] == "course"]
    assert course and course[0]["price"] == 0 and course[0]["meta"].startswith("Free course")
    assert "No buddy" in p["reason"]


def test_plan_over_budget_keeps_buddy(client, tourist, monkeypatch):
    _no_llm(monkeypatch)
    p = _plan(client, tourist, budget=110000)
    assert p["warnings"] == ["OVER_BUDGET"] and p["total_price"] > 110000
    assert [i for i in _items(p) if i["type"] == "buddy"]


def test_plan_uses_llm_choice_and_rejects_unknown_ids(client, tourist, monkeypatch):
    async def fake(system, user):
        assert "Course candidates" in user and "REQUIRED" in system and "Never invent" in system
        return {"dorm_id": 10, "buddy_id": 35, "buddy_date": "2027-01-13", "course_id": 999,
                "free_place_ids": [105, 9999], "reason": "Picked for a poetry lover."}
    monkeypatch.setattr(llm, "complete_json", fake)
    p = _plan(client, tourist)
    assert p["ai"] is True and p["reason"].startswith("Picked for a poetry lover.")
    bud = next(i for i in _items(p) if i["type"] == "buddy")
    assert bud["ref_id"] == 35 and bud["course_id"] == 3  # 없는 코스 id는 버리고 그날 최고 점수 코스
    assert all(i["ref_id"] != 9999 for i in _items(p))


def test_plan_llm_cannot_drop_buddy(client, tourist, monkeypatch):
    async def fake(system, user):
        return {"dorm_id": 10, "buddy_id": None, "buddy_date": None, "course_id": None, "free_place_ids": [], "reason": "No buddy."}
    monkeypatch.setattr(llm, "complete_json", fake)
    p = _plan(client, tourist)
    bud = [i for i in _items(p) if i["type"] == "buddy"]
    assert bud and bud[0]["course_id"] is None and p["warnings"] == []  # 버디는 필수, 코스 없음은 허용


def _timed(plan, kind):
    return [(d["date"], i) for d in plan["days"] for i in d["items"] if i["type"] == kind]


def test_plan_buddy_meta_language_names(client, tourist, monkeypatch):
    """버디 meta의 언어는 코드(ko/en/ja)가 아니라 이름 — 일정 언어에 맞춰"""
    _no_llm(monkeypatch)
    en = next(i for _, i in _timed(_plan(client, tourist), "buddy"))
    assert "Korean" in en["meta"] and "English" in en["meta"] and "ko/" not in en["meta"] and "/en" not in en["meta"]
    ko = next(i for _, i in _timed(_plan(client, tourist, language="ko"), "buddy"))
    assert "한국어·영어" in ko["meta"] and "/" not in ko["meta"].split(" · ")[1]


def test_plan_buddy_after_check_in(client, tourist, monkeypatch):
    """체크인(15:00) 날 버디는 16:00, 다른 날은 14:00. 돈·합계는 그대로"""
    _no_llm(monkeypatch)
    p = _plan(client, tourist)  # 3박: 버디는 체크인 다음 날부터
    (day, bud), = _timed(p, "buddy")
    assert day != DEMO["check_in"] and bud["time"] == "14:00" and bud["price"] == 30000
    one = _plan(client, tourist, check_in="2027-01-13", check_out="2027-01-14")  # 1박: 버디는 도착일 오후
    (day, bud), = _timed(one, "buddy")
    (dorm_day, dorm), = _timed(one, "dorm")
    assert day == dorm_day == "2027-01-13" and dorm["time"] == "15:00" and bud["time"] == "16:00"
    assert [i["type"] for i in one["days"][0]["items"]][:2] == ["dorm", "buddy"]  # 시간 순: 체크인 → 버디
    assert one["total_price"] == sum(i["price"] for i in _items(one)) == dorm["price"] + bud["price"]


def test_plan_course_only_after_check_in(client, tourist, monkeypatch):
    """버디가 없어 코스만 넣을 때도 체크인 날이면 16:00 (아니면 10:00)"""
    _no_llm(monkeypatch)
    one = _plan(client, tourist, check_in="2027-02-02", check_out="2027-02-03")  # 가능한 버디 없음, 1박
    assert one["warnings"] == ["NO_BUDDY"]
    (day, course), = _timed(one, "course")
    assert day == "2027-02-02" and course["time"] == "16:00" and course["price"] == 0
    three = _plan(client, tourist, check_in="2027-02-01", check_out="2027-02-03")
    (day, course), = _timed(three, "course")
    assert day != "2027-02-01" and course["time"] == "10:00"


def test_plan_validation_and_role(client, tourist, buddy, monkeypatch):
    _no_llm(monkeypatch)
    bad = DEMO | {"check_in": "2027-01-15", "check_out": "2027-01-12"}
    assert client.post("/api/v1/ai/plan", json=bad, headers=tourist).status_code == 422
    assert client.post("/api/v1/ai/plan", json=DEMO | {"budget": -1}, headers=tourist).status_code == 422
    assert client.post("/api/v1/ai/plan", json=DEMO, headers=buddy).status_code == 403
    assert client.post("/api/v1/ai/plan", json=DEMO).status_code == 401


def test_extract_json_handles_fences():
    assert llm._extract_json('Sure!\n```json\n{"a": 1}\n```') == {"a": 1}
