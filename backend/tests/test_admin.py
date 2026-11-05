def test_dashboard_scoped(client, univ_admin, operator, tourist):
    assert client.get("/api/v1/admin/dashboard", headers=tourist).status_code == 403
    a = client.get("/api/v1/admin/dashboard", headers=univ_admin).json()
    # A대학: 501 숙박(approved, 3박 105,000) + 502 숙박(requested)
    assert a["bookings"] == 2 and a["pending"] == 1 and a["nights"] == 3 and a["dorm_revenue"] == 105000 and a["platform_fee"] == 10500
    assert a["by_status"] == {"approved": 1, "requested": 1}
    assert a["daily"][0]["date"] == "2027-01-12"
    o = client.get("/api/v1/admin/dashboard", headers=operator).json()
    assert o["bookings"] >= a["bookings"]


def test_admin_bookings_filters(client, univ_admin, operator):
    rows = client.get("/api/v1/admin/bookings", headers=univ_admin).json()["items"]
    assert all(r["university_id"] == 1 for r in rows)
    assert {r["type"] for r in rows} <= {"dorm", "buddy"}
    dorm_req = client.get("/api/v1/admin/bookings", params={"type": "dorm", "status": "requested"}, headers=univ_admin).json()["items"]
    assert [r["tourist"] for r in dorm_req] == ["Yuki Sato"]
    assert client.get("/api/v1/admin/bookings", params={"q": "SB-2027-0112"}, headers=operator).json()["items"]
    all_rows = client.get("/api/v1/admin/bookings", headers=operator).json()["items"]
    assert any(r["type"] == "tour" for r in all_rows)


def test_buddy_approve_scoped(client, univ_admin, reset_db):
    rows = client.get("/api/v1/admin/buddies", params={"status": "pending"}, headers=univ_admin).json()["items"]
    assert {r["name"] for r in rows} == {"하린", "도윤"}
    r = client.patch("/api/v1/admin/buddies/33", json={"action": "approve"}, headers=univ_admin)
    assert r.status_code == 200 and r.json()["status"] == "approved"
    assert client.patch("/api/v1/admin/buddies/32", json={"action": "approve"}, headers=univ_admin).status_code == 403  # B대 버디
    assert client.patch("/api/v1/admin/buddies/33", json={"action": "x"}, headers=univ_admin).status_code == 422


def test_users_and_settlements_operator_only(client, univ_admin, operator):
    assert client.get("/api/v1/admin/users", headers=univ_admin).status_code == 403
    users = client.get("/api/v1/admin/users", params={"role": "buddy"}, headers=operator).json()["items"]
    assert len(users) == 6
    s = client.get("/api/v1/admin/settlements", headers=operator).json()
    targets = {r["target"]: r for r in s["items"]}
    assert targets["A대학교 국제관"]["revenue"] == 105000 and targets["A대학교 국제관"]["payout"] == 94500
    assert "해설사 박해설" in targets and s["total"] == sum(r["revenue"] for r in s["items"])


def test_admin_tours(client, univ_admin):
    rows = client.get("/api/v1/admin/tours", headers=univ_admin).json()["items"]
    assert len(rows) == 5 and rows[0]["guide"] == "박해설"  # 시드 투어 5개 (A: 7번 왕릉과 산사 추가)
