from tests.conftest import login


def test_dashboard_scoped(client, univ_admin, operator, tourist):
    assert client.get("/api/v1/admin/dashboard", headers=tourist).status_code == 403
    a = client.get("/api/v1/admin/dashboard", headers=univ_admin).json()
    # 고려대: 501 숙박(approved, 3박 105,000) + 490 숙박(approved, 3박 114,000) + 502 숙박(requested)
    assert a["bookings"] == 3 and a["pending"] == 1 and a["nights"] == 6 and a["dorm_revenue"] == 219000 and a["platform_fee"] == 21900
    assert a["by_status"] == {"approved": 2, "requested": 1}
    assert a["daily"][0]["date"] == "2027-01-05"
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
    assert {r["type"] for r in all_rows} == {"dorm", "buddy"}  # 코스는 예약 항목이 아님


def test_buddy_rows_and_approve_readiness(client, univ_admin, operator, reset_db):
    # v3.3: 버디 승인은 운영자만. 대학 담당자는 버디 목록·승인 모두 403
    assert client.get("/api/v1/admin/buddies", headers=univ_admin).status_code == 403
    assert client.patch("/api/v1/admin/buddies/34", json={"action": "approve"}, headers=univ_admin).status_code == 403
    rows = client.get("/api/v1/admin/buddies", params={"status": "pending"}, headers=operator).json()["items"]
    by_name = {r["name"]: r for r in rows}
    assert {"하린", "도윤"} <= set(by_name)
    assert by_name["하린"]["quiz_score"] == 7 and by_name["하린"]["school_email_verified"] and by_name["하린"]["age"] == 23
    r = client.patch("/api/v1/admin/buddies/33", json={"action": "approve"}, headers=operator)
    assert r.status_code == 409 and r.json()["error"]["code"] == "NOT_READY" and "퀴즈 8점" in r.json()["error"]["message"]
    r = client.patch("/api/v1/admin/buddies/34", json={"action": "approve"}, headers=operator)
    assert r.status_code == 200 and r.json()["status"] == "approved" and r.json()["can_help"] == ["subway", "shopping"]
    assert client.patch("/api/v1/admin/buddies/34", json={"action": "x"}, headers=operator).status_code == 422
    junseo = next(r for r in client.get("/api/v1/admin/buddies", headers=operator).json()["items"] if r["name"] == "준서")
    assert junseo["report_count"] == 1


def test_users_and_settlements_operator_only(client, univ_admin, operator):
    assert client.get("/api/v1/admin/users", headers=univ_admin).status_code == 403
    assert {u["role"] for u in client.get("/api/v1/admin/users", headers=operator).json()["items"]} == {"tourist", "buddy", "univ_admin", "operator"}
    assert len(client.get("/api/v1/admin/users", params={"role": "buddy"}, headers=operator).json()["items"]) == 8  # + 수아(휴면) · 가은(성북구 거주, v3.7)
    s = client.get("/api/v1/admin/settlements", headers=operator).json()
    targets = {r["target"]: r for r in s["items"]}
    assert set(targets) == {"고려대학교 프런티어관", "버디 지우", "버디 준서"}  # 해설사 행 없음
    assert targets["고려대학교 프런티어관"]["revenue"] == 105000 + 114000 and targets["고려대학교 프런티어관"]["meals"] == 0
    j = targets["버디 지우"]  # 1월 동행 4회 (활동비 120,000 + 앨범 5,000, 보증금 제외) × 정산율 75% · 승인 식비 18,000 · 대기 1건
    assert (j["revenue"], j["album"], j["fee"], j["meals"], j["payout"], j["status"]) == (125000, 5000, 31250, 18000, 111750, "meal_pending")
    assert j["payout_rate"] == 0.75 and targets["버디 준서"]["payout_rate"] == 0.7 and targets["버디 준서"]["fee"] == 9000
    assert s["meal_refund_total"] == 40000 + 2000 and s["total"] == sum(r["revenue"] for r in s["items"])
    # 판매가(숙박 219,000 + 활동비 150,000 + 앨범 5,000) − 원가(대학 90% + 버디 항목별 정산율) = 이익 (식비·보증금 제외)
    p = s["profit"]
    assert (p["sales_dorm"], p["sales_buddy"], p["sales_album"], p["sales"]) == (219000, 150000, 5000, 374000)
    # 지우 75% (활동비 90,000 + 앨범 3,750) · 준서 70%
    assert (p["cost_university"], p["cost_buddy"], p["cost_buddy_album"], p["cost_other"]) == (197100, 90000 + 3750 + 21000, 3750, 0)
    assert p["profit"] == 62150 == 21900 + 39000 + 1250 and p["margin"] == 0.166


def test_settlements_univ_admin_sees_own_dorm_only(client, univ_admin):
    """대학 담당자: 자기 학교 숙박 행만, 버디 행·수익 구조 없음"""
    s = client.get("/api/v1/admin/settlements", headers=univ_admin).json()
    assert [r["target"] for r in s["items"]] == ["고려대학교 프런티어관"]
    assert s["items"][0]["payout"] == 219000 - 21900 and s["total"] == 219000
    assert s["profit"] is None and s["meal_refund_total"] == 0


def test_admin_courses(client, univ_admin, operator):
    assert client.get("/api/v1/admin/tours", headers=univ_admin).status_code == 403  # 코스 관리는 운영자만
    rows = client.get("/api/v1/admin/tours", headers=operator).json()["items"]
    assert len(rows) == 5
    by_id = {r["id"]: r for r in rows}
    assert by_id[3]["places"] == ["성북근현대문학관", "수연산방(이태준 가옥)", "심우장", "길상사"] and by_id[3]["place_count"] == 4
    assert by_id[3]["story_ready"] == 4 and by_id[3]["buddy_walks"] == 1 and by_id[6]["buddy_walks"] == 2
    assert set(rows[0]) == {"id", "title", "theme", "duration_min", "walk_complete", "places", "place_count", "story_ready", "buddy_walks"}


def test_reports_auto_suspend_and_actions(client, operator, reset_db):
    yuki = login(client, "yuki@example.com")
    emma = login(client, "emma@example.com")
    body = {"booking_item_id": 41, "category": "no_show", "text": "약속 장소에 오지 않았어요"}
    assert client.post("/api/v1/reports", json=body, headers=emma).status_code == 403  # 남의 예약
    assert client.post("/api/v1/reports", json=body | {"category": "x"}, headers=yuki).status_code == 422
    assert client.post("/api/v1/reports", json=body | {"booking_item_id": 4}, headers=yuki).status_code == 422  # 숙박 항목
    assert client.get("/api/v1/buddies/36").status_code == 200
    r = client.post("/api/v1/reports", json=body, headers=yuki)  # 시드 1건 + 1건 = 2건 → 자동 정지
    assert r.status_code == 201 and r.json()["auto_suspended"] is True and r.json()["buddy_id"] == 36
    assert client.get("/api/v1/buddies/36").status_code == 404  # 목록·상세에서 빠짐
    assert 36 not in [b["id"] for b in client.get("/api/v1/buddies").json()["items"]]
    assert client.get("/api/v1/admin/reports", headers=yuki).status_code == 403
    rows = client.get("/api/v1/admin/reports", params={"status": "open"}, headers=operator).json()["items"]
    assert len(rows) == 2 and rows[0]["count_for_buddy"] == 2 and rows[0]["buddy_status"] == "suspended"
    assert rows[0]["buddy_name"] == "준서" and rows[0]["reporter"] == "Yuki Sato" and rows[0]["booking_code"] == "SB-2027-0108"
    # 첫 신고 기각 → 정지 풀기
    first = next(x for x in rows if not x["auto_suspended"])
    r = client.patch(f"/api/v1/admin/reports/{first['id']}", json={"action": "dismiss"}, headers=operator).json()
    assert r["status"] == "dismissed" and r["count_for_buddy"] == 1
    r = client.patch(f"/api/v1/admin/reports/{rows[0]['id']}", json={"action": "unsuspend"}, headers=operator).json()
    assert r["status"] == "resolved" and r["action"] == "unsuspend" and r["buddy_status"] == "approved"
    assert client.patch(f"/api/v1/admin/reports/{first['id']}", json={"action": "boom"}, headers=operator).status_code == 422
