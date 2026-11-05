from tests.conftest import login


def test_pay_checkin_chat_notifications(client, tourist, univ_admin, reset_db):
    r = client.post("/api/v1/bookings/502/pay", headers=tourist)
    assert r.status_code == 403  # 남의 예약
    yuki = login(client, "yuki@example.com")
    r = client.post("/api/v1/bookings/502/pay", headers=yuki)
    assert r.status_code == 200 and r.json()["status"] == "paid" and r.json()["payment"]["amount"] == 80000
    g = client.get("/api/v1/bookings/501/checkin-guide", headers=tourist).json()
    assert g["building"] == "A대학교 국제관" and g["checkin"] == "15:00" and g["wifi"] == "AUNIV-GUEST" and len(g["emergency"]) == 3
    c = client.get("/api/v1/bookings/501/chat", headers=tourist).json()
    assert len(c["items"]) == 2 and c["items"][0]["sender"] == "buddy"
    # 승인 → 관광객 알림 생성
    assert client.get("/api/v1/notifications", headers=tourist).json()["items"] == []
    client.patch("/api/v1/bookings/502/items/4", json={"action": "approve"}, headers=univ_admin)
    n = client.get("/api/v1/notifications", headers=yuki).json()["items"]
    assert len(n) == 1 and n[0]["type"] == "item_approved" and n[0]["read_at"] is None
    client.post("/api/v1/notifications/read-all", headers=yuki)
    assert client.get("/api/v1/notifications", headers=yuki).json()["items"][0]["read_at"] is not None


def test_review_once(client, tourist, reset_db):
    r = client.post("/api/v1/bookings/480/reviews", json={"item_id": 12, "rating": 5, "text": "좋았어요"}, headers=tourist)
    assert r.status_code == 201
    assert client.post("/api/v1/bookings/480/reviews", json={"item_id": 12, "rating": 4}, headers=tourist).status_code == 409
    assert client.post("/api/v1/bookings/480/reviews", json={"item_id": 11, "rating": 9}, headers=tourist).status_code == 422
    assert client.post("/api/v1/bookings/480/reviews", json={"item_id": 1, "rating": 5}, headers=tourist).status_code == 404  # 다른 예약 항목


def test_export_csv(client, operator, univ_admin):
    assert client.get("/api/v1/admin/export/foreign-guests", headers=univ_admin).status_code == 403
    r = client.get("/api/v1/admin/export/foreign-guests", headers=operator)
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
    lines = r.text.strip().splitlines()
    assert lines[0].startswith("booking_code,name") and any("SB-2027-0112" in ln for ln in lines[1:])
