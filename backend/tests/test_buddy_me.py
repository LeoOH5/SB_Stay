from app.services import buddy_quiz
from tests.conftest import login

B = "/api/v1/buddy"


def test_profile_and_availability(client, buddy, reset_db):
    r = client.get(f"{B}/profile", headers=buddy)
    j = r.json()
    assert r.status_code == 200 and j["name"] == "지우" and j["university"] == "고려대학교"
    assert j["school_email_verified"] is True and j["quiz_score"] == 9 and j["can_help"] == ["vegan_food", "photo", "subway"]
    body = {"intro": "새 소개", "languages": ["ko", "en"], "personality": ["humor"], "style": ["explore"], "can_help": ["halal_food"],
            "bank_account": "국민 000-00-000000"}
    r = client.put(f"{B}/profile", json=body, headers=buddy)
    assert r.json()["intro"] == "새 소개" and r.json()["personality"] == ["humor"] and r.json()["bank_account"] == "국민 000-00-000000"
    assert client.put(f"{B}/profile", json={"personality": ["grumpy"]}, headers=buddy).status_code == 422
    assert j["can_drive"] is False and client.get("/api/v1/buddies/31").json()["can_drive"] is False
    r = client.put(f"{B}/profile", json={"can_drive": True}, headers=buddy)  # 운전 가능은 표시만 (차량 동행 없음)
    assert r.json()["can_drive"] is True and client.get(f"{B}/profile", headers=buddy).json()["can_drive"] is True
    assert client.get("/api/v1/buddies/31").json()["can_drive"] is True and r.json()["intro"] == "새 소개"
    r = client.put(f"{B}/availability", json={"dates": ["2027-01-20", "2027-01-21", "2027-01-20"]}, headers=buddy)
    assert r.json()["dates"] == ["2027-01-20", "2027-01-21"]
    assert client.get(f"{B}/availability", headers=buddy).json()["dates"] == ["2027-01-20", "2027-01-21"]


def test_tourist_forbidden(client, tourist):
    assert client.get(f"{B}/requests", headers=tourist).status_code == 403


def test_requests_privacy_schedule_and_decide(client, buddy, reset_db):
    reqs = client.get(f"{B}/requests", params={"status": "requested"}, headers=buddy).json()["items"]
    assert len(reqs) == 1
    it = reqs[0]
    assert it["booking_code"] == "SB-2027-0114" and it["tourist"]["name"] == "Yuki Sato" and it["tourist"]["nationality"] == "JP"
    assert set(it["tourist"]) == {"id", "name", "nationality", "language"}  # 여권·연락처·이메일 없음
    assert it["request"]["diet"] == ["no_pork"] and it["course_title"] == "길상사와 한옥 골목" and it["meal_count"] == 0
    assert client.get(f"{B}/requests", params={"status": "nope"}, headers=buddy).status_code == 422
    emma = next(x for x in client.get(f"{B}/requests", headers=buddy).json()["items"] if x["booking_code"] == "SB-2027-0112")
    assert emma["request"]["allergies"] == ["mushroom"] and emma["meal_count"] == 2 and emma["album"] is True
    r = client.patch(f"/api/v1/bookings/{it['booking_id']}/items/{it['item_id']}", json={"action": "approve"}, headers=buddy)
    assert r.status_code == 200 and r.json()["status"] == "confirmed"
    assert any(s["item_id"] == it["item_id"] for s in client.get(f"{B}/schedule", headers=buddy).json()["items"])


def test_earnings_are_net(client):
    minho = login(client, "minho@b-univ.ac.kr")
    j = client.get(f"{B}/earnings", headers=minho).json()
    assert j["paid"] == 21000 and j["pending"] == 0  # 2026-11 확정 1건 30,000 × 기본 70%
    jiwoo = client.get(f"{B}/earnings", headers=login(client, "jiwoo@a-univ.ac.kr")).json()
    jan = {i["booking_item_id"]: i["amount"] for i in jiwoo["items"] if i["date"] >= "2027-01"}
    assert jan == {3: 22500, 32: 22500, 51: 22500, 52: 22500}  # 식사 보증금·앨범 제외, 성장 75%
    assert {i["amount"] for i in jiwoo["items"] if i["date"] < "2027"} == {21000}  # 여름: 기본 70%일 때 확정


def test_settlement(client, buddy):
    s = client.get(f"{B}/settlement", params={"month": "2027-01"}, headers=buddy).json()
    assert s["pay_date"] == "2027-02-28" and s["account"] == "신한 110-***-***482" and s["walks"] == 4  # Lena·Mia·Emma·Lucas
    assert (s["grade"], s["payout_rate"]) == ("growth", 0.75)
    assert (s["gross"], s["fee"], s["net"]) == (120000, 30000, 90000)  # 활동비만 × 75% (앨범은 플랫폼 수입)
    assert s["meals_approved"] == 18000 and s["meals_pending"] == 23500 and s["payout"] == 108000
    rows = {r["item_id"]: r for r in s["items"]}
    assert rows[32]["status"] == "confirmed" and rows[3]["status"] == "meal_pending" and rows[3]["net"] == 22500
    assert all(r["payout_rate"] == 0.75 for r in s["items"])
    summer = client.get(f"{B}/settlement", params={"month": "2026-07"}, headers=buddy).json()
    assert summer["walks"] == 4 and summer["net"] == 4 * 21000 and {r["payout_rate"] for r in summer["items"]} == {0.7}
    assert client.get(f"{B}/settlement", params={"month": "2027-13"}, headers=buddy).status_code == 422


def test_meal_claim_limit_approve_and_settlement(client, buddy, operator, reset_db):
    # Emma 항목(식사 2회): 시드 청구 1건 + 1건 더 → 3번째는 MEAL_LIMIT
    r = client.post(f"{B}/meal-claims", json={"item_id": 3, "place": "성북동 국숫집", "items": "비빔국수 2", "amount": 17000}, headers=buddy)
    assert r.status_code == 201 and r.json()["over_limit"] is False and r.json()["booking_code"] == "SB-2027-0112"
    r = client.post(f"{B}/meal-claims", json={"item_id": 3, "place": "x", "amount": 1000}, headers=buddy)
    assert r.status_code == 409 and r.json()["error"]["code"] == "MEAL_LIMIT"
    assert client.post(f"{B}/meal-claims", json={"item_id": 5, "place": "x", "amount": 1000}, headers=buddy).status_code == 409  # 미확정
    assert client.post(f"{B}/meal-claims", json={"item_id": 13, "place": "x", "amount": 1000}, headers=buddy).status_code == 403  # 남의 항목
    assert len(client.get(f"{B}/meal-claims", headers=buddy).json()["items"]) == 3
    # 운영자 심사: 시드 대기 청구(₩23,500, 한도 초과) 승인
    assert client.get("/api/v1/admin/meal-claims", headers=buddy).status_code == 403
    rows = client.get("/api/v1/admin/meal-claims", params={"status": "requested"}, headers=operator).json()["items"]
    seed = next(c for c in rows if c["amount"] == 23500)
    assert seed["over_limit"] is True and seed["deposit"] == 40000 and seed["deposit_left"] == 40000
    assert seed["request_summary"] == "비건, 버섯 알레르기, 천천히" and seed["buddy_name"] == "지우" and seed["tourist"] == "Emma Clark"
    r = client.patch(f"/api/v1/admin/meal-claims/{seed['id']}", json={"action": "approve"}, headers=operator)
    assert r.status_code == 200 and r.json()["status"] == "approved" and r.json()["deposit_left"] == 40000  # 자기 청구는 빼고
    assert client.patch(f"/api/v1/admin/meal-claims/{seed['id']}", json={"action": "approve"}, headers=operator).status_code == 409
    new = next(c for c in rows if c["amount"] == 17000)
    r = client.patch(f"/api/v1/admin/meal-claims/{new['id']}", json={"action": "approve"}, headers=operator)
    assert r.status_code == 409 and r.json()["error"]["code"] == "OVER_DEPOSIT"  # 23,500 + 17,000 > 40,000
    r = client.patch(f"/api/v1/admin/meal-claims/{new['id']}", json={"action": "reject", "reason": "보증금 초과"}, headers=operator)
    assert r.json()["status"] == "rejected" and r.json()["reason"] == "보증금 초과"
    # 정산 반영: 식비 승인 18,000 + 23,500, 확인 중 0
    s = client.get(f"{B}/settlement", headers=buddy).json()
    assert s["meals_approved"] == 41500 and s["meals_pending"] == 0 and s["payout"] == 90000 + 41500
    item = next(i for i in client.get("/api/v1/bookings/501", headers=login(client, "emma@example.com")).json()["items"] if i["id"] == 3)
    assert item["meal_used"] == 23500 and item["meal_approved"] == 23500 and item["meal_refund"] == 16500
    a = client.get("/api/v1/admin/settlements", headers=operator).json()
    jiwoo = next(r for r in a["items"] if r["target"] == "버디 지우")
    assert jiwoo["meals"] == 41500 and jiwoo["payout"] == round(120000 * 0.75) + 41500 and jiwoo["status"] == "pending"
    assert a["meal_refund_total"] == 16500 + 2000


def test_activities(client, buddy, reset_db):
    r = client.post(f"{B}/activities", json={"item_id": 3, "date": "2027-01-13", "places": ["심우장"], "foods": "대추차", "photos": ["/a.jpg"]}, headers=buddy)
    assert r.status_code == 201 and r.json()["booking_code"] == "SB-2027-0112" and r.json()["tourist"] == "Emma Clark"
    assert client.post(f"{B}/activities", json={"item_id": 13, "date": "2027-01-13"}, headers=buddy).status_code == 403
    mine = client.get(f"{B}/activities", headers=buddy).json()["items"]
    assert len(mine) == 4 and mine[0]["date"] == "2027-01-13"
    assert len(client.get("/api/v1/bookings/501/album", headers=login(client, "emma@example.com")).json()["items"][0]["photos"]) == 7
    pub = client.get("/api/v1/buddies/31/activities").json()["items"]
    assert len(pub) == 4 and set(pub[0]) == {"date", "places", "foods"}  # 메모·사진·여행자 없음


def test_public_detail_can_drive(client):
    """운전 가능은 표시만: 시드 민호(32) true, 지우(31) false. 차량·운송 요금 필드는 없다"""
    minho = client.get("/api/v1/buddies/32").json()
    assert minho["can_drive"] is True and client.get("/api/v1/buddies/31").json()["can_drive"] is False
    assert not any("car" in k or "ride" in k for k in minho)
    assert next(b for b in client.get("/api/v1/buddies").json()["items"] if b["id"] == 32)["can_drive"] is True


def _new_buddy(client, email="new@korea.ac.kr"):
    r = client.post("/api/v1/auth/signup", json={"name": "새버디", "email": email, "password": "password1"})
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    assert client.patch("/api/v1/auth/me/role", json={"role": "buddy"}, headers=h).status_code == 200
    return h


def test_apply_flow(client, univ_admin, operator, reset_db):
    h = _new_buddy(client)
    s = client.get(f"{B}/apply", headers=h).json()
    assert s["status"] == "none" and s["email_verified"] is False and s["quiz_passed"] is False
    r = client.post(f"{B}/apply/email", json={"email": "me@gmail.com"}, headers=h)
    assert r.status_code == 422 and r.json()["error"]["code"] == "NOT_SEONGBUK_SCHOOL"
    r = client.post(f"{B}/apply/email", json={"email": "new@korea.ac.kr"}, headers=h).json()
    assert r == {"sent": True, "university": "고려대학교", "dev_code": None}
    assert client.post(f"{B}/apply/agree", headers=h).status_code == 409  # 메일 인증 먼저
    bad = client.post(f"{B}/apply/verify", json={"email": "new@korea.ac.kr", "code": "000000", "birth_date": "2003-01-01"}, headers=h)
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "BAD_CODE"
    young = client.post(f"{B}/apply/verify", json={"email": "new@korea.ac.kr", "code": "123456", "birth_date": "2008-06-01", "korean_national": True}, headers=h)
    assert young.status_code == 422 and young.json()["error"]["code"] == "TOO_YOUNG"
    alien = {"email": "new@korea.ac.kr", "code": "123456", "birth_date": "2003-01-01"}  # 국적 확인 없음 → 422
    r = client.post(f"{B}/apply/verify", json=alien, headers=h)
    assert r.status_code == 422 and r.json()["error"]["code"] == "NOT_KOREAN_NATIONAL"
    assert client.get(f"{B}/apply", headers=h).json()["korean_national"] is False
    ok = client.post(f"{B}/apply/verify", json=alien | {"korean_national": True}, headers=h).json()
    assert ok["email_verified"] and ok["age_ok"] and ok["korean_national"] and ok["university"] == "고려대학교" and ok["status"] == "pending"
    assert client.post(f"{B}/apply/agree", headers=h).json()["code_agreed"] is True
    qs = client.get(f"{B}/apply/quiz", headers=h).json()["questions"]
    assert len(qs) == 10 and all("answer" not in q and len(q["options"]) >= 2 for q in qs)
    right = {q["id"]: q["answer"] for q in buddy_quiz.QUESTIONS}
    seven = right | {"q1": 0, "q2": 1, "q3": 0}
    assert client.post(f"{B}/apply/quiz", json={"answers": seven}, headers=h).json() == {"score": 7, "total": 10, "passed": False, "best_score": 7}
    # 퀴즈 7점이면 승인 불가
    prof_id = client.get(f"{B}/profile", headers=h).json()["id"]
    r = client.patch(f"/api/v1/admin/buddies/{prof_id}", json={"action": "approve"}, headers=operator)
    assert r.status_code == 409 and r.json()["error"]["code"] == "NOT_READY" and "퀴즈" in r.json()["error"]["message"]
    r = client.post(f"{B}/apply/quiz", json={"answers": right}, headers=h).json()
    assert r["score"] == 10 and r["passed"] is True
    client.put(f"{B}/profile", json={"major": "사학", "intro": "안녕하세요", "languages": ["ko", "en"]}, headers=h)
    s = client.get(f"{B}/apply", headers=h).json()
    assert s["quiz_score"] == 10 and s["profile_done"] is True
    r = client.patch(f"/api/v1/admin/buddies/{prof_id}", json={"action": "approve"}, headers=operator)
    assert r.status_code == 200 and r.json()["status"] == "approved" and r.json()["age"] == 24 and r.json()["quiz_score"] == 10


def test_apply_debug_code(client, monkeypatch, reset_db):
    from app.core.config import get_settings
    monkeypatch.setattr(get_settings(), "debug", True)
    h = _new_buddy(client, "dbg@b-univ.ac.kr")
    r = client.post(f"{B}/apply/email", json={"email": "dbg@b-univ.ac.kr"}, headers=h).json()
    assert r["dev_code"] == "123456" and r["university"] == "국민대학교"
