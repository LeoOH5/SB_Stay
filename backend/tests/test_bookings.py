import pytest

from tests.conftest import login

TRAVELER = {"name": "Emma Clark", "nationality": "US", "email": "emma@example.com", "passport_no": "C123", "emergency_contact": "+1 555", "guests": 1}
DORM = {"type": "dorm", "ref_id": 10, "date_from": "2027-01-12", "date_to": "2027-01-15", "guests": 1, "request": {"late_checkin": True}}
BUDDY = {"type": "buddy", "ref_id": 31, "date": "2027-01-13", "time": "14:00", "duration_min": 120, "course_id": 3,
         "request": {"diet": ["vegan"], "allergies": ["mushroom"], "pace": "slow", "places": [104, 102], "note": "언덕은 천천히"},
         "meal_count": 2, "album": True}
ITEMS = [DORM, BUDDY]
URL = "/api/v1/bookings"


def _post(client, headers, items, traveler=TRAVELER):
    return client.post(URL, json={"traveler": traveler, "items": items}, headers=headers)


def _code(r):
    return r.json()["error"]["code"]


@pytest.fixture
def booking(client, tourist, reset_db):
    r = _post(client, tourist, ITEMS)
    assert r.status_code == 201, r.text
    return r.json()


def test_create_booking_prices_and_status(booking):
    assert booking["code"].startswith("SB-2027-")
    # 숙박 105,000 + 버디 (활동 30,000 + 앨범 5,000 + 식사 2 × 20,000)
    assert booking["total_price"] == 105000 + 75000
    # 숙박 10% + (활동비 + 앨범) × (1 − 지우 정산율 75%). 식사 보증금에는 수수료 없음 (v3.6 앨범도 정산율)
    assert booking["platform_fee"] == 10500 + (30000 + 5000) - 26250 == 10500 + 8750
    by_type = {i["type"]: i for i in booking["items"]}
    assert by_type["dorm"]["status"] == "requested" and by_type["buddy"]["status"] == "requested"
    assert booking["status"] == "requested"
    assert by_type["dorm"]["title"] == "고려대학교 프런티어관 2인실" and "3박" in by_type["dorm"]["meta"]
    assert by_type["dorm"]["request"] == {"late_checkin": True, "quiet_room": False, "low_floor": False}
    b = by_type["buddy"]
    assert b["title"] == "지우와 동네 걷기" and b["course_id"] == 3 and b["course_title"] == "문인의 성북동 산책"
    assert b["meal_count"] == 2 and b["meal_deposit"] == 40000 and b["meal_refund"] == 40000 and b["album"] is True
    assert b["request"]["diet"] == ["vegan"] and b["can_review"] is False and b["reviewed"] is False


def test_create_rules(client, tourist, reset_db):
    tour = {"type": "tour", "ref_id": 3, "date": "2027-01-16", "time": "10:00"}
    assert _code(_post(client, tourist, [DORM, BUDDY, tour])) == "COURSE_NOT_BOOKABLE"
    two = DORM | {"ref_id": 11}
    assert _code(_post(client, tourist, [DORM, two, BUDDY])) == "ONE_STAY"
    r = _post(client, tourist, [DORM])
    assert r.status_code == 422 and _code(r) == "BUDDY_REQUIRED" and "버디가 1명" in r.json()["error"]["message"]
    assert _code(_post(client, tourist, [DORM, BUDDY | {"date": "2027-01-16"}])) == "BUDDY_OUT_OF_STAY"
    assert _post(client, tourist, [DORM, BUDDY | {"date": "2027-01-15"}]).status_code == 201  # 체크아웃 날도 기간 안


@pytest.mark.parametrize("bad", [
    {"meal_count": 5}, {"course_id": 999}, {"request": {"diet": ["keto"]}}, {"request": {"pace": "fast"}},
    {"request": {"places": [101, 102, 103, 104]}}, {"request": {"note": "x" * 301}}, {"request": {"foo": 1}},
])
def test_buddy_item_validation(client, tourist, bad, reset_db):
    r = _post(client, tourist, [BUDDY | bad])
    assert r.status_code == 422 and _code(r) == "VALIDATION"


def test_other_validation(client, tourist, reset_db):
    bad = [DORM | {"date_from": "2027-01-15", "date_to": "2027-01-12"}, BUDDY]
    assert _post(client, tourist, bad).status_code == 422
    out = [DORM | {"date_from": "2026-12-01", "date_to": "2026-12-03"}, BUDDY | {"date": "2026-12-02"}]
    assert _post(client, tourist, out).status_code == 422
    assert _post(client, tourist, [DORM | {"request": {"late_checkin": "yes"}}, BUDDY]).status_code == 422
    assert _post(client, tourist, [{"type": "buddy", "ref_id": 33, "date": "2027-01-14"}]).status_code == 404  # 미승인 버디


def test_buddy_only_drops_passport(client, tourist, reset_db):
    r = _post(client, tourist, [BUDDY | {"meal_count": 0, "album": False}])
    assert r.status_code == 201 and "passport_no" not in r.json()["traveler"]
    assert r.json()["total_price"] == 30000 and r.json()["platform_fee"] == 7500  # 성장 75% → 플랫폼 25%
    r = _post(client, tourist, [BUDDY | {"meal_count": 1, "album": True}])
    assert r.json()["total_price"] == 30000 + 5000 + 20000 and r.json()["platform_fee"] == 7500 + 1250  # 앨범 5,000 × 25%


def test_detail_privacy(client, tourist, univ_admin, booking):
    bid = booking["id"]
    mine = client.get("/api/v1/bookings/me", headers=tourist).json()["items"]
    assert mine[0]["id"] == bid and mine[0]["traveler"]["passport_no"] == "C123"
    assert client.get(f"{URL}/{bid}", headers=login(client, "yuki@example.com")).status_code == 403
    assert client.get(f"{URL}/{bid}", headers=login(client, "minho@b-univ.ac.kr")).status_code == 403  # 다른 버디
    # 버디: 이름·국적·인원만, 자기 항목만, 자기 항목 요청은 보임
    j = client.get(f"{URL}/{bid}", headers=login(client, "jiwoo@a-univ.ac.kr")).json()
    assert j["traveler"] == {"name": "Emma Clark", "nationality": "US", "guests": 1}
    assert [i["type"] for i in j["items"]] == ["buddy"] and j["items"][0]["request"]["allergies"] == ["mushroom"]
    # 대학 담당자: 체크인용 traveler 전체, 버디 항목 요청은 숨김
    a = client.get(f"{URL}/{bid}", headers=univ_admin).json()
    assert a["traveler"]["passport_no"] == "C123"
    req = {i["type"]: i["request"] for i in a["items"]}
    assert req["dorm"]["late_checkin"] is True and req["buddy"] is None
    # 국민대 담당자는 볼 수 없음 (자기 대학 항목 없음) — 시드에 국민대 담당자가 없어 운영자만 확인
    assert client.get(f"{URL}/{bid}", headers=login(client, "operator@sbstay.app")).json()["items"][1]["request"]


def test_approval_flow_to_confirmed(client, tourist, univ_admin, buddy, booking):
    bid = booking["id"]
    dorm = next(i for i in booking["items"] if i["type"] == "dorm")
    bud = next(i for i in booking["items"] if i["type"] == "buddy")
    assert client.patch(f"{URL}/{bid}/items/{dorm['id']}", json={"action": "approve"}, headers=tourist).status_code == 403
    assert client.patch(f"{URL}/{bid}/items/{dorm['id']}", json={"action": "approve"}, headers=buddy).status_code == 403
    r = client.patch(f"{URL}/{bid}/items/{dorm['id']}", json={"action": "approve"}, headers=univ_admin)
    assert r.status_code == 200 and r.json()["status"] == "approved"
    assert client.patch(f"{URL}/{bid}/items/{dorm['id']}", json={"action": "approve"}, headers=univ_admin).status_code == 409
    assert client.get(f"{URL}/{bid}", headers=tourist).json()["status"] == "partially_approved"
    r = client.patch(f"{URL}/{bid}/items/{bud['id']}", json={"action": "approve"}, headers=buddy)
    assert r.json()["status"] == "confirmed"
    assert client.get(f"{URL}/{bid}", headers=tourist).json()["status"] == "confirmed"


def test_reject_keeps_booking_going(client, tourist, univ_admin, buddy, booking):
    bid = booking["id"]
    dorm = next(i for i in booking["items"] if i["type"] == "dorm")
    bud = next(i for i in booking["items"] if i["type"] == "buddy")
    r = client.patch(f"{URL}/{bid}/items/{dorm['id']}", json={"action": "reject", "reason": "만실"}, headers=univ_admin)
    assert r.json()["status"] == "rejected" and r.json()["reject_reason"] == "만실"
    client.patch(f"{URL}/{bid}/items/{bud['id']}", json={"action": "approve"}, headers=buddy)
    assert client.get(f"{URL}/{bid}", headers=tourist).json()["status"] == "confirmed"  # 거절 항목 제외하고 확정


def test_replace_buddy(client, tourist, buddy, booking):
    bid = booking["id"]
    old = next(i for i in booking["items"] if i["type"] == "buddy")
    path = f"{URL}/{bid}/items/{old['id']}/replace-buddy"
    assert client.post(path, json={"buddy_id": 35}, headers=login(client, "yuki@example.com")).status_code == 403
    assert _code(client.post(path, json={"buddy_id": 35, "date": "2027-01-17"}, headers=tourist)) == "BUDDY_OUT_OF_STAY"
    assert client.post(path, json={"buddy_id": 31}, headers=tourist).status_code == 422  # 같은 버디
    assert client.post(path, json={"buddy_id": 33}, headers=tourist).status_code == 404  # 미승인
    r = client.post(path, json={"buddy_id": 35, "time": "15:00"}, headers=tourist)
    assert r.status_code == 200, r.text
    j = r.json()
    items = {i["id"]: i for i in j["items"]}
    assert items[old["id"]]["status"] == "cancelled"
    new = next(i for i in j["items"] if i["type"] == "buddy" and i["status"] == "requested")
    assert new["ref_id"] == 35 and new["time"] == "15:00" and new["date_from"] == "2027-01-13"
    assert new["request"] == old["request"] and new["course_id"] == 3 and new["meal_count"] == 2 and new["album"] is True
    assert j["total_price"] == 180000 and j["platform_fee"] == 10500 + 9000 + 1500  # 취소 항목 빼고, 서연(기본 70%)으로 어림 (앨범 5,000 × 30%)
    seen = client.get(f"{URL}/{bid}", headers=buddy).json()["items"]  # 지우에게는 취소된 자기 항목만
    assert [(i["id"], i["status"]) for i in seen] == [(old["id"], "cancelled")]
    # 거절된 항목을 바꾸면 거절 상태 그대로
    seo = login(client, "seoyeon@b-univ.ac.kr")
    client.patch(f"{URL}/{bid}/items/{new['id']}", json={"action": "reject"}, headers=seo)
    r = client.post(f"{URL}/{bid}/items/{new['id']}/replace-buddy", json={"buddy_id": 36, "date": "2027-01-14"}, headers=tourist)
    assert r.status_code == 200
    assert {i["id"]: i for i in r.json()["items"]}[new["id"]]["status"] == "rejected"


def test_cancel(client, tourist, booking):
    bid = booking["id"]
    assert client.post(f"{URL}/{bid}/cancel", headers=login(client, "yuki@example.com")).status_code == 403
    r = client.post(f"{URL}/{bid}/cancel", headers=tourist)
    assert r.status_code == 200 and r.json()["status"] == "cancelled" and all(i["status"] == "cancelled" for i in r.json()["items"])
    assert client.post(f"{URL}/{bid}/cancel", headers=tourist).status_code == 409


def test_room_availability_decreases(client, tourist, booking):
    r = client.get("/api/v1/dorms/10", params={"check_in": "2027-01-12", "check_out": "2027-01-15"})
    assert r.json()["available_rooms"] == 40 - 1 - 1  # 시드 1건 + 방금 1건
    r = client.get("/api/v1/dorms/10", params={"check_in": "2027-02-01", "check_out": "2027-02-03"})
    assert r.json()["available_rooms"] == 40


def test_seeded_demo_booking(client, tourist):
    """Emma SB-2027-0112: 숙박 + 지우(코스 3, 비건·버섯·천천히, 식사 2, 앨범). 식비 1건 확인 중, 앨범 6장"""
    b = next(x for x in client.get("/api/v1/bookings/me", headers=tourist).json()["items"] if x["code"] == "SB-2027-0112")
    assert b["status"] == "confirmed" and b["total_price"] == 180000 and b["platform_fee"] == 10500 + 7500 + 1250  # 지우 75% 고정 (앨범 5,000 × 25%)
    bud = next(i for i in b["items"] if i["type"] == "buddy")
    assert bud["course_id"] == 3 and bud["request"]["pace"] == "slow" and bud["album_photos"] == 6
    assert bud["meal_used"] == 23500 and bud["meal_approved"] == 0 and bud["meal_refund"] == 40000
    assert bud["can_review"] is True  # DEMO_TODAY 2027-01-14 ≥ 1/13 (동행은 끝남, 숙박은 진행 중)


def test_review_trip_not_done_and_sub_scores(client, tourist, buddy, reset_db):
    # 아직 오지 않은 여행 (2/2 동행) → 409 TRIP_NOT_DONE
    r = _post(client, tourist, [DORM | {"date_from": "2027-02-01", "date_to": "2027-02-03"}, BUDDY | {"date": "2027-02-02"}])
    j = r.json()
    bud = next(i for i in j["items"] if i["type"] == "buddy")
    client.patch(f"{URL}/{j['id']}/items/{bud['id']}", json={"action": "approve"}, headers=buddy)
    r = client.post(f"{URL}/{j['id']}/reviews", json={"item_id": bud["id"], "rating": 5}, headers=tourist)
    assert r.status_code == 409 and _code(r) == "TRIP_NOT_DONE"
    # 지난 여행 (시드 1/13 지우) → 세부 점수·태그와 함께 저장
    bad = {"item_id": 3, "rating": 5, "sub_scores": {"kind": 6}}
    assert client.post(f"{URL}/501/reviews", json=bad, headers=tourist).status_code == 422
    assert client.post(f"{URL}/501/reviews", json={"item_id": 3, "rating": 5, "tags": ["nope"]}, headers=tourist).status_code == 422
    body = {"item_id": 3, "rating": 4, "text": "Great walk", "sub_scores": {"kind": 5, "talk": 3, "punctual": 5, "local": 4},
            "tags": ["cares_requests", "knows_food"]}
    r = client.post(f"{URL}/501/reviews", json=body, headers=tourist)
    assert r.status_code == 201 and r.json()["sub_scores"]["talk"] == 3 and r.json()["tags"] == ["cares_requests", "knows_food"]
    assert client.post(f"{URL}/501/reviews", json=body, headers=tourist).status_code == 409
    item = next(i for i in client.get(f"{URL}/501", headers=tourist).json()["items"] if i["id"] == 3)
    assert item["reviewed"] is True and item["can_review"] is False
    jiwoo = client.get("/api/v1/buddies/31").json()  # 세부 점수 있는 시드 후기(Lena) + 방금 후기 평균
    assert jiwoo["sub_scores"] == {"kind": 5.0, "talk": 4.0, "punctual": 5.0, "local": 4.0}
    assert set(jiwoo["tags_top"][:2]) == {"knows_food", "cares_requests"} and jiwoo["review_count"] == 5  # 여름 후기 3건 포함


def test_album(client, tourist):
    r = client.get(f"{URL}/501/album", headers=tourist)
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) == 1 and items[0]["buddy_name"] == "지우" and len(items[0]["photos"]) == 6 and "수연산방" in items[0]["places"]
    assert client.get(f"{URL}/501/album", headers=login(client, "yuki@example.com")).status_code == 403
