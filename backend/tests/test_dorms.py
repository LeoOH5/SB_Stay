def test_list_universities(client):
    r = client.get("/api/v1/universities")
    assert r.status_code == 200 and len(r.json()["items"]) == 2


def test_list_dorms_and_filter(client):
    r = client.get("/api/v1/dorms")
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) == 3 and items[0]["university"]["name"] == "A대학교"
    r = client.get("/api/v1/dorms", params={"university_id": 2})
    assert [i["id"] for i in r.json()["items"]] == [12]


def test_list_dorms_outside_open_period(client):
    r = client.get("/api/v1/dorms", params={"check_in": "2026-11-20", "check_out": "2026-11-22"})
    assert r.json()["items"] == []
    assert client.get("/api/v1/dorms", params={"check_in": "2027-01-15", "check_out": "2027-01-12"}).status_code == 422


def test_get_dorm(client):
    r = client.get("/api/v1/dorms/10")
    assert r.status_code == 200
    j = r.json()
    assert j["price_per_night"] == 35000 and j["available_rooms"] == 39 and len(j["rules"]) == 4  # 시드 예약 1건 점유
    assert client.get("/api/v1/dorms/999").status_code == 404


def test_admin_dorm_crud_scoped(client, univ_admin, operator, tourist, reset_db):
    assert client.post("/api/v1/admin/dorms", json={"building": "x", "room_type": "single", "price_per_night": 1, "total_rooms": 1}, headers=tourist).status_code == 403
    r = client.post("/api/v1/admin/dorms", json={"building": "제2기숙사", "room_type": "twin", "price_per_night": 45000, "total_rooms": 5}, headers=univ_admin)
    assert r.status_code == 201 and r.json()["university"]["id"] == 1
    new_id = r.json()["id"]
    r = client.patch(f"/api/v1/admin/dorms/{new_id}", json={"price_per_night": 42000, "active": False}, headers=univ_admin)
    assert r.json()["price_per_night"] == 42000 and r.json()["active"] is False
    # 비활성 객실은 공개 목록에서 제외
    assert new_id not in [i["id"] for i in client.get("/api/v1/dorms").json()["items"]]
    # A대학 담당자는 B대학 객실(12) 수정 불가, 운영자는 가능
    assert client.patch("/api/v1/admin/dorms/12", json={"price_per_night": 1}, headers=univ_admin).status_code == 403
    assert client.patch("/api/v1/admin/dorms/12", json={"price_per_night": 31000}, headers=operator).status_code == 200
    r = client.patch("/api/v1/admin/universities/1", json={"open_from": "2027-01-04"}, headers=univ_admin)
    assert r.status_code == 200 and r.json()["open_from"] == "2027-01-04"
    assert client.patch("/api/v1/admin/universities/2", json={"open_from": "2027-01-04"}, headers=univ_admin).status_code == 403
    assert len(client.get("/api/v1/admin/dorms", headers=univ_admin).json()["items"]) == 3
