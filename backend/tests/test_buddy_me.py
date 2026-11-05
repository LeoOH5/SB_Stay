from tests.conftest import login


def test_profile_and_availability(client, buddy, reset_db):
    r = client.get("/api/v1/buddy/profile", headers=buddy)
    assert r.status_code == 200 and r.json()["name"] == "지우" and r.json()["university"] == "고려대학교"
    r = client.put("/api/v1/buddy/profile", json={"intro": "새 소개", "languages": ["ko", "en"]}, headers=buddy)
    assert r.json()["intro"] == "새 소개" and r.json()["languages"] == ["ko", "en"]
    r = client.put("/api/v1/buddy/availability", json={"dates": ["2027-01-20", "2027-01-21", "2027-01-20"]}, headers=buddy)
    assert r.json()["dates"] == ["2027-01-20", "2027-01-21"]
    assert client.get("/api/v1/buddy/availability", headers=buddy).json()["dates"] == ["2027-01-20", "2027-01-21"]


def test_tourist_forbidden(client, tourist):
    assert client.get("/api/v1/buddy/requests", headers=tourist).status_code == 403


def test_new_buddy_creates_profile(client, reset_db):
    r = client.post("/api/v1/auth/signup", json={"name": "신규", "email": "nb@a-univ.ac.kr", "password": "password1"})
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    client.patch("/api/v1/auth/me/role", json={"role": "buddy", "university_id": 1}, headers=h)
    assert client.get("/api/v1/buddy/profile", headers=h).status_code == 404
    r = client.put("/api/v1/buddy/profile", json={"major": "사학", "year": 2}, headers=h)
    assert r.status_code == 200 and r.json()["status"] == "pending"


def test_requests_schedule_and_decide(client, buddy, tourist, reset_db):
    r = client.get("/api/v1/buddy/requests", params={"status": "requested"}, headers=buddy)
    assert r.status_code == 200
    reqs = r.json()["items"]
    assert len(reqs) == 1 and reqs[0]["booking_code"] == "SB-2027-0112" and reqs[0]["tourist"]["name"] == "Emma Clark"
    assert client.get("/api/v1/buddy/requests", params={"status": "nope"}, headers=buddy).status_code == 422
    # 수락 → 일정에 등장
    item = reqs[0]
    r = client.patch(f"/api/v1/bookings/{item['booking_id']}/items/{item['item_id']}", json={"action": "approve"}, headers=buddy)
    assert r.status_code == 200 and r.json()["status"] == "confirmed"
    sched = client.get("/api/v1/buddy/schedule", headers=buddy).json()["items"]
    assert any(s["item_id"] == item["item_id"] for s in sched)
    assert client.get("/api/v1/bookings/501", headers=tourist).json()["status"] == "confirmed"


def test_guide_sees_tour_items(client, guide):
    r = client.get("/api/v1/buddy/requests", headers=guide)
    assert r.status_code == 200
    assert all(i["type"] == "tour" for i in r.json()["items"]) and len(r.json()["items"]) >= 1
    assert r.json()["items"][0]["meeting_point"] == "한성대입구역 5번 출구"


def test_earnings(client, reset_db):
    minho = login(client, "minho@b-univ.ac.kr")
    r = client.get("/api/v1/buddy/earnings", headers=minho)
    assert r.status_code == 200
    j = r.json()
    assert j["paid"] == 10000 and j["pending"] == 0  # 2026-11 확정 1건 → paid
