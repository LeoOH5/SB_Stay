import pytest

from tests.conftest import login

TRAVELER = {"name": "Emma Clark", "nationality": "US", "email": "emma@example.com", "passport_no": "C123", "emergency_contact": "+1 555", "guests": 1}
ITEMS = [
    {"type": "dorm", "ref_id": 10, "date_from": "2027-01-12", "date_to": "2027-01-15", "guests": 1},
    {"type": "tour", "ref_id": 3, "date": "2027-01-16", "time": "10:00"},  # 1/16 토
    {"type": "buddy", "ref_id": 31, "date": "2027-01-13", "time": "14:00", "duration_min": 120},
]


@pytest.fixture
def booking(client, tourist, reset_db):
    r = client.post("/api/v1/bookings", json={"traveler": TRAVELER, "items": ITEMS}, headers=tourist)
    assert r.status_code == 201, r.text
    return r.json()


def test_create_booking_prices_and_status(booking):
    assert booking["code"].startswith("SB-2027-")
    assert booking["total_price"] == 105000 + 20000 + 30000
    assert booking["platform_fee"] == 15500
    by_type = {i["type"]: i for i in booking["items"]}
    assert by_type["dorm"]["status"] == "requested" and by_type["tour"]["status"] == "confirmed" and by_type["buddy"]["status"] == "requested"
    assert booking["status"] == "partially_approved"  # 투어가 즉시 확정
    assert by_type["dorm"]["title"] == "고려대학교 프런티어관 2인실" and "3박" in by_type["dorm"]["meta"]
    assert by_type["buddy"]["title"] == "지우와 동네 걷기"


def test_create_validation(client, tourist, reset_db):
    bad = [{"type": "dorm", "ref_id": 10, "date_from": "2027-01-15", "date_to": "2027-01-12"}]
    assert client.post("/api/v1/bookings", json={"traveler": TRAVELER, "items": bad}, headers=tourist).status_code == 422
    off = [{"type": "tour", "ref_id": 3, "date": "2027-01-13", "time": "10:00"}]  # 1/13 수요일, 토·일 운영
    r = client.post("/api/v1/bookings", json={"traveler": TRAVELER, "items": off}, headers=tourist)
    assert r.status_code == 422 and "운영 요일" in r.json()["error"]["message"]
    out = [{"type": "dorm", "ref_id": 10, "date_from": "2026-12-01", "date_to": "2026-12-03"}]
    assert client.post("/api/v1/bookings", json={"traveler": TRAVELER, "items": out}, headers=tourist).status_code == 422
    assert client.post("/api/v1/bookings", json={"traveler": TRAVELER, "items": [{"type": "buddy", "ref_id": 33, "date": "2027-01-14"}]}, headers=tourist).status_code == 404  # 미승인 버디


def test_passport_dropped_without_dorm(client, tourist, reset_db):
    r = client.post("/api/v1/bookings", json={"traveler": TRAVELER, "items": [ITEMS[1]]}, headers=tourist)
    assert r.status_code == 201 and "passport_no" not in r.json()["traveler"]


def test_my_bookings_and_detail_permissions(client, tourist, booking):
    mine = client.get("/api/v1/bookings/me", headers=tourist).json()["items"]
    assert mine[0]["id"] == booking["id"]
    yuki = login(client, "yuki@example.com")
    assert client.get(f"/api/v1/bookings/{booking['id']}", headers=yuki).status_code == 403
    jiwoo = login(client, "jiwoo@a-univ.ac.kr")
    assert client.get(f"/api/v1/bookings/{booking['id']}", headers=jiwoo).status_code == 200  # 버디 항목 공급자


def test_approval_flow_to_confirmed(client, tourist, univ_admin, buddy, operator, booking):
    bid = booking["id"]
    dorm = next(i for i in booking["items"] if i["type"] == "dorm")
    bud = next(i for i in booking["items"] if i["type"] == "buddy")
    # 관광객·버디는 숙박 승인 불가
    assert client.patch(f"/api/v1/bookings/{bid}/items/{dorm['id']}", json={"action": "approve"}, headers=tourist).status_code == 403
    assert client.patch(f"/api/v1/bookings/{bid}/items/{dorm['id']}", json={"action": "approve"}, headers=buddy).status_code == 403
    r = client.patch(f"/api/v1/bookings/{bid}/items/{dorm['id']}", json={"action": "approve"}, headers=univ_admin)
    assert r.status_code == 200 and r.json()["status"] == "approved"
    assert client.patch(f"/api/v1/bookings/{bid}/items/{dorm['id']}", json={"action": "approve"}, headers=univ_admin).status_code == 409
    assert client.get(f"/api/v1/bookings/{bid}", headers=tourist).json()["status"] == "partially_approved"
    r = client.patch(f"/api/v1/bookings/{bid}/items/{bud['id']}", json={"action": "approve"}, headers=buddy)
    assert r.json()["status"] == "confirmed"
    assert client.get(f"/api/v1/bookings/{bid}", headers=tourist).json()["status"] == "confirmed"


def test_reject_keeps_booking_going(client, tourist, univ_admin, buddy, booking):
    bid = booking["id"]
    dorm = next(i for i in booking["items"] if i["type"] == "dorm")
    bud = next(i for i in booking["items"] if i["type"] == "buddy")
    r = client.patch(f"/api/v1/bookings/{bid}/items/{dorm['id']}", json={"action": "reject", "reason": "만실"}, headers=univ_admin)
    assert r.json()["status"] == "rejected" and r.json()["reject_reason"] == "만실"
    client.patch(f"/api/v1/bookings/{bid}/items/{bud['id']}", json={"action": "approve"}, headers=buddy)
    assert client.get(f"/api/v1/bookings/{bid}", headers=tourist).json()["status"] == "confirmed"  # 거절 항목 제외하고 확정


def test_cancel(client, tourist, booking):
    bid = booking["id"]
    yuki = login(client, "yuki@example.com")
    assert client.post(f"/api/v1/bookings/{bid}/cancel", headers=yuki).status_code == 403
    r = client.post(f"/api/v1/bookings/{bid}/cancel", headers=tourist)
    assert r.status_code == 200 and r.json()["status"] == "cancelled" and all(i["status"] == "cancelled" for i in r.json()["items"])
    assert client.post(f"/api/v1/bookings/{bid}/cancel", headers=tourist).status_code == 409


def test_room_availability_decreases(client, tourist, booking):
    r = client.get("/api/v1/dorms/10", params={"check_in": "2027-01-12", "check_out": "2027-01-15"})
    assert r.json()["available_rooms"] == 40 - 1 - 1  # 시드 1건 + 방금 1건
    r = client.get("/api/v1/dorms/10", params={"check_in": "2027-02-01", "check_out": "2027-02-03"})
    assert r.json()["available_rooms"] == 40


def test_seeded_demo_booking_visible(client, tourist):
    mine = client.get("/api/v1/bookings/me", headers=tourist).json()["items"]
    codes = {b["code"] for b in mine}
    assert "SB-2027-0112" in codes
