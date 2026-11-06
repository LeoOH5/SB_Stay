"""v3.8 실제 도보 경로(OpenStreetMap) · 장소 순서 정하기 (services/courses.py) · TR-02/AD-07 · AI-01/AI-04 · 시드 · 마이그레이션"""
import os
import random
import subprocess
import sys
import uuid
from itertools import permutations
from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect, text

from app.models import BookingItem, Place, WalkRoute
from app.seeds.__main__ import load, walk_rows
from app.services import courses, llm, planner
from app.services.courses import Route, Stop

LIT = Stop(111, 37.59251, 126.997056, 40)  # 성북근현대문학관
SUY = Stop(102, 37.595107, 126.994855, 30)  # 수연산방
PATH_102_111 = [[37.595107, 126.994855], [37.5940, 126.9960], [37.59251, 126.997056]]  # 102 → 111 방향


def _square() -> tuple[list[Stop], courses.Routes]:
    """한 변 100 m 정사각형 1-2-3-4 (둘레 순서), 대각선 141 m. 거리는 저장한 경로로 딱 정한다"""
    st = {1: Stop(1, 37.0, 127.0, 0), 2: Stop(2, 37.0, 127.001, 0), 3: Stop(3, 37.001, 127.001, 0), 4: Stop(4, 37.001, 127.0, 0)}
    side, diag = [(1, 2), (2, 3), (3, 4), (1, 4)], [(1, 3), (2, 4)]
    routes = {k: Route(100, [[0, 0], [1, 1]]) for k in side} | {k: Route(141, [[0, 0], [1, 1]]) for k in diag}
    return list(st.values()), routes


# ---------- 순서 정하기
def test_best_order_square_brute_force():
    st, routes = _square()
    by = {s.place_id: s for s in st}
    shuffled = [by[1], by[3], by[2], by[4]]  # 1→3→2→4 = 141 + 100 + 141
    assert courses.path_m(shuffled, routes) == 382
    best = courses.best_order(shuffled, routes=routes)
    assert [s.place_id for s in best] == [1, 2, 3, 4] and courses.path_m(best, routes) == 300  # 둘레를 따라, 같으면 id 사전순


def test_best_order_keep_first_and_deterministic():
    st, routes = _square()
    by = {s.place_id: s for s in st}
    got = courses.best_order([by[3], by[1], by[4], by[2]], keep_first=True, routes=routes)
    assert [s.place_id for s in got] == [3, 2, 1, 4]  # 3→2→1→4 와 3→4→1→2 모두 300 m → id 사전순
    rnd = random.Random(7)
    for _ in range(5):  # 넣는 순서가 달라도 늘 같은 답
        xs = st[:]
        rnd.shuffle(xs)
        assert [s.place_id for s in courses.best_order(xs, routes=routes)] == [1, 2, 3, 4]


def test_best_order_unknown_coords_last_in_original_order():
    st, routes = _square()
    a, b = Stop(9, None, None, 0), Stop(8, 0, 0, 0)  # 좌표 없음 (None·0)
    got = courses.best_order([st[2], a, st[0], b, st[3], st[1]], routes=routes)
    assert [s.place_id for s in got] == [1, 2, 3, 4, 9, 8]
    assert courses.best_order([a]) == [a] and courses.best_order([]) == []
    # keep_first인데 첫 장소에 좌표가 없으면 첫 자리만 지킨다
    assert [s.place_id for s in courses.best_order([a, st[2], st[0]], keep_first=True, routes=routes)] == [9, 1, 3]
    skew = {(1, 2): Route(500, []), (2, 3): Route(100, []), (1, 3): Route(100, [])}  # 나머지 정할 때도 저장한 경로 거리를 쓴다
    assert [s.place_id for s in courses.best_order([a, st[0], st[1], st[2]], keep_first=True, routes=skew)] == [9, 1, 3, 2]
    assert [s.place_id for s in courses.best_order([a, st[0], st[1], st[2]], keep_first=True)] == [9, 1, 2, 3]  # 추정이면 둘레


def test_best_order_many_stops_uses_heuristic():
    """9곳 이상은 가까운 곳 먼저 + 2-opt. 한 줄로 늘어선 장소는 끝에서 끝으로 한 번에 걷는다"""
    line = [Stop(100 + i, 37.0 + i * 0.001, 127.0, 0) for i in range(11)]
    xs = line[:]
    random.Random(3).shuffle(xs)
    got = courses.best_order(xs)
    assert [s.place_id for s in got] == [s.place_id for s in line]
    assert courses.path_m(got) == courses.path_m(line) < courses.path_m(xs)
    fixed = courses.best_order([line[5], *line[:5], *line[6:]], keep_first=True)
    assert fixed[0].place_id == 105 and len(fixed) == 11


# ---------- 구간: 실제 경로 vs 추정
def test_leg_uses_stored_route_and_reverses_path():
    routes = {(102, 111): Route(523, PATH_102_111)}
    lg = courses.leg(LIT, SUY, routes)  # 111 → 102 : 저장은 102 → 111 이라 path를 뒤집는다
    # 523 m → 10 m 반올림 520, 523 ÷ 4 km/h = 7.845분 → 8분 (속도는 추정과 같은 4 km/h)
    assert (lg.walk_m, lg.walk_min, lg.source) == (520, 8, "route")
    assert lg.path == PATH_102_111[::-1] and lg.path[0] == [LIT.lat, LIT.lng]
    fwd = courses.leg(SUY, LIT, routes)
    assert fwd.path == PATH_102_111 and fwd.walk_m == 520
    est = courses.leg(LIT, SUY)  # 저장한 경로 없음 → 직선 × 1.3
    assert (est.walk_m, est.walk_min, est.source, est.path) == (450, 7, "estimate", None)
    assert courses.leg(LIT, Stop(1, None, None, 0), routes).source is None


def test_route_source_summary():
    routes = {(102, 111): Route(523, PATH_102_111)}
    third = Stop(103, 37.5936, 126.9918, 25)
    assert courses.summarize([LIT, SUY], routes).route_source == "route"
    assert courses.summarize([LIT, SUY]).route_source == "estimate"
    mixed = courses.summarize([LIT, SUY, third], routes)
    assert mixed.route_source == "mixed" and [x.source for x in mixed.legs] == ["route", "estimate"]
    assert mixed.walk_m_total == sum(x.walk_m for x in mixed.legs) and isinstance(mixed.walk_m_total, int)
    assert courses.summarize([LIT]).route_source == "estimate"


def test_seed_walk_rows_filter_and_normalize():
    rows = [{"from_place_id": 111, "to_place_id": 102, "distance_m": 523, "path": PATH_102_111[::-1]},
            {"from_place_id": 102, "to_place_id": 999, "distance_m": 1, "path": []},  # 없는 장소
            {"from_place_id": 102, "to_place_id": 111, "distance_m": 600, "path": []}]  # 같은 쌍 두 번째는 버림
    assert walk_rows(rows, {102, 111}) == [{"from_place_id": 102, "to_place_id": 111, "distance_m": 523, "path": PATH_102_111}]


# ---------- TR-02 · AD-07 (DB에 경로를 넣어 보고 시드로 되돌린다)
@pytest.fixture
def no_routes(db, reset_db):
    """시드의 실제 경로(walk_routes.json)를 비워 '저장한 경로 없음 = 추정'에서 시작. 끝나면 reset_db가 시드를 다시 넣는다"""
    db.query(WalkRoute).delete()
    db.commit()
    yield


def test_seed_routes_used_by_tour(client):
    """시드 상태: 코스 3의 모든 구간이 저장한 실제 경로를 쓴다"""
    t = client.get("/api/v1/tours/3").json()
    assert t["route_source"] == "route" and all(x["source"] == "route" and x["path"] for x in t["legs"])
    assert t["walk_m_total"] == sum(x["walk_m"] for x in t["legs"])


def test_seed_course_times_match_real_routes(client):
    """시드 상태: 모든 코스 시간이 walk_routes.json(실제 경로)으로 계산한 값과 같다.
    TR-01 v3.9 코스 5 '정릉과 성곽길'은 정릉(105) → 한양도성(107) → 선잠박물관(106): 실제 도보 3,910 m → 3,558 m"""
    places = {p["id"]: p for p in load("places.json")}
    routes = {(r["from_place_id"], r["to_place_id"]): Route(r["distance_m"], r["path"]) for r in walk_rows(load("walk_routes.json"), set(places))}
    rows = load("tour_places.json")
    items = {t["id"]: t for t in client.get("/api/v1/tours").json()["items"]}
    assert {t["title"]: t["duration_min"] for t in items.values()} == {
        "문인의 성북동 산책": 170, "독립운동가의 길": 110, "정릉과 성곽길": 210, "길상사와 한옥 골목": 100, "왕릉과 산사": 100}
    for tid, t in items.items():
        stops = [Stop(r["place_id"], places[r["place_id"]]["lat"], places[r["place_id"]]["lng"], r["stay_min"])
                 for r in sorted((r for r in rows if r["tour_id"] == tid), key=lambda r: r["seq"])]
        want = courses.summarize(stops, routes)
        assert [p["id"] for p in t["places"]] == [s.place_id for s in stops]
        assert (t["walk_m_total"], t["walk_min_total"], t["duration_min"], t["route_source"]) == (want.walk_m_total, want.walk_min_total, want.duration_min, "route")

    t5 = items[5]
    assert t5["title"] == "정릉과 성곽길" and [p["id"] for p in t5["places"]] == [105, 107, 106]
    by = {s: Stop(s, places[s]["lat"], places[s]["lng"], 0) for s in (105, 106, 107)}
    assert courses.path_m([by[105], by[107], by[106]], routes) == 3558 < courses.path_m([by[105], by[106], by[107]], routes) == 3910
    assert (t5["walk_m_total"], t5["walk_min_total"], t5["stay_min_total"]) == (3560, 54, 150)
    assert [(x["from_place_id"], x["to_place_id"]) for x in t5["legs"]] == [(105, 107), (107, 106)]


def test_tour_api_uses_stored_route(client, db, operator, no_routes):
    before = client.get("/api/v1/tours/3").json()
    assert before["route_source"] == "estimate" and all(x["source"] == "estimate" and x["path"] is None for x in before["legs"])
    db.add(WalkRoute(from_place_id=102, to_place_id=111, distance_m=523, path=PATH_102_111))
    db.commit()
    t = client.get("/api/v1/tours/3").json()
    first = t["legs"][0]
    assert (first["from_place_id"], first["to_place_id"], first["source"], first["walk_m"], first["walk_min"]) == (111, 102, "route", 520, 8)
    assert first["path"] == PATH_102_111[::-1]  # 코스 방향(111 → 102)으로 뒤집힘
    assert t["route_source"] == "mixed" and t["walk_m_total"] == sum(x["walk_m"] for x in t["legs"])
    listed = next(x for x in client.get("/api/v1/tours").json()["items"] if x["id"] == 3)
    assert listed["legs"] == t["legs"] and listed["duration_min"] == t["duration_min"]
    rows = {r["id"]: r for r in client.get("/api/v1/admin/tours", headers=operator).json()["items"]}
    assert rows[3]["route_source"] == "mixed" and rows[3]["duration_min"] == t["duration_min"] and rows[4]["route_source"] == "estimate"
    for a, b in [(102, 103), (103, 104)]:
        db.add(WalkRoute(from_place_id=a, to_place_id=b, distance_m=400, path=[[37.59, 126.99], [37.591, 126.991]]))
    db.commit()
    assert client.get("/api/v1/tours/3").json()["route_source"] == "route"


def test_load_routes_one_query(db, no_routes):
    db.add(WalkRoute(from_place_id=102, to_place_id=111, distance_m=523, path=PATH_102_111))
    db.commit()
    assert courses.load_routes(db, [111, 102, 103]) == {(102, 111): Route(523, PATH_102_111)}
    assert courses.load_routes(db, [111]) == {} and courses.load_routes(db, [103, 104]) == {}


# ---------- AI-01 자유 장소 순서
def _place(pid: int, lat: float, lng: float) -> planner.PlaceC:
    return planner.PlaceC(Place(id=pid, name=f"P{pid}", name_en=f"P{pid}", lat=lat, lng=lng, stay_min=20), 0)


def test_planner_orders_free_places_by_walking():
    a, b, c = _place(1, 37.0, 127.0), _place(2, 37.004, 127.0), _place(3, 37.002, 127.0)  # 3번이 가운데
    got, walk_m, walk_min = planner.order_free([a, b, c])
    assert [p.place.id for p in got] == [1, 3, 2]
    assert walk_m == courses.summarize([courses.Stop(i, p.place.lat, p.place.lng, 0) for i, p in ((1, a), (3, c), (2, b))]).walk_m_total
    assert walk_min >= 1
    one, m1, n1 = planner.order_free([a])
    assert [p.place.id for p in one] == [1] and m1 is None and n1 is None


def test_plan_free_order_comes_from_code_not_llm(client, tourist, monkeypatch):
    async def fake(system, user):
        return {"dorm_id": 10, "buddy_id": 35, "buddy_date": "2027-01-13", "course_id": 3,
                "free_place_ids": [120, 104], "reason": "Two picks."}  # LLM은 120 → 104 순서로 냈다
    monkeypatch.setattr(llm, "complete_json", fake)
    r = client.post("/api/v1/ai/plan", headers=tourist, json={"check_in": "2027-01-12", "check_out": "2027-01-15", "budget": 200000,
                                                              "interests": ["literature"], "with_buddy": True, "language": "ko"})
    assert r.status_code == 200, r.text
    free = [i for d in r.json()["days"] for i in d["items"] if i["type"] == "free" and i.get("place_ids")]
    assert len(free) == 1
    it = free[0]
    # 두 곳이면 어느 쪽으로 걸어도 같은 거리 → id 순서 (LLM 순서를 따르지 않음)
    assert it["place_ids"] == [104, 120] and it["title"].startswith("길상사 · 북정마을")
    assert it["walk_m"] > 0 and f"사이 도보 {it['walk_min']}분" in it["meta"]


# ---------- AI-04 추천 동선
def _brief(client, buddy, monkeypatch):
    async def fail(*_a, **_k):
        raise llm.LLMUnavailable("test")
    monkeypatch.setattr(llm, "complete_json", fail)
    r = client.post("/api/v1/ai/buddy-brief", json={"booking_item_id": 3}, headers=buddy)
    assert r.status_code == 200, r.text
    return r.json()


def _optimal_keep_first(ids: list[int], db) -> int:
    ps = {p.id: p for p in db.query(Place).filter(Place.id.in_(ids)).all()}
    st = [Stop(i, ps[i].lat, ps[i].lng, 0) for i in ids]
    return min(courses.path_m([st[0], *perm]) for perm in permutations(st[1:]))


def test_brief_route_course_only(client, buddy, db, monkeypatch, no_routes):
    b = _brief(client, buddy, monkeypatch)
    route = b["route"]
    ids = [x["place_id"] for x in route]
    assert ids[0] == 111 and sorted(ids) == [102, 103, 104, 111]  # 요청 장소 104·102는 이미 코스에 있음
    assert all(x["from_course"] for x in route) and route[0]["walk_m_from_prev"] is None
    assert b["route_walk_m"] == sum(x["walk_m_from_prev"] for x in route[1:])
    assert b["route_walk_min"] == sum(x["walk_min_from_prev"] for x in route[1:])
    assert b["route_source"] == "estimate" and all(x["source"] == "estimate" and x["path"] is None for x in route[1:])
    st = [Stop(x["place_id"], x["lat"], x["lng"], 0) for x in route]
    assert courses.path_m(st) == _optimal_keep_first(ids, db)
    assert " → ".join(x["name"] for x in route) in b["brief"]  # 템플릿 안내도 같은 순서


def test_brief_route_adds_wanted_places(client, buddy, db, monkeypatch, no_routes):
    it = db.get(BookingItem, 3)
    it.request = {**(it.request or {}), "places": [120, 101, 123, 117, 104]}  # 101은 늘 휴관 → 빠짐, 최대 3곳
    db.commit()
    b = _brief(client, buddy, monkeypatch)
    ids = [x["place_id"] for x in b["route"]]
    assert ids[0] == 111 and sorted(ids) == [102, 103, 104, 111, 117, 120, 123]
    assert {x["place_id"] for x in b["route"] if not x["from_course"]} == {117, 120, 123}
    st = [Stop(x["place_id"], x["lat"], x["lng"], 0) for x in b["route"]]
    assert courses.path_m(st) == _optimal_keep_first(ids, db)
    assert b["places"][0]["name"] == "성북근현대문학관"  # 장소 자료(places)는 그대로 코스 순서


# ---------- 마이그레이션 (빈 DB에 처음부터 올리고 내리기)
def test_migration_upgrade_downgrade():
    base = "postgresql+psycopg://sbstay:sbstay@localhost:5432"
    name = f"sbstay_migr_{uuid.uuid4().hex[:8]}"
    admin = create_engine(f"{base}/postgres", isolation_level="AUTOCOMMIT")
    try:
        with admin.connect() as c:
            c.execute(text(f'CREATE DATABASE "{name}"'))
    except Exception as e:  # noqa: BLE001
        pytest.skip(f"임시 DB를 만들 수 없음: {e}")
    env = {**os.environ, "DATABASE_URL": f"{base}/{name}"}
    cwd = Path(__file__).resolve().parents[1]

    def alembic(*args: str) -> None:
        r = subprocess.run([sys.executable, "-m", "alembic", *args], check=False, cwd=cwd, env=env, capture_output=True, text=True, timeout=180)
        assert r.returncode == 0, r.stderr[-2000:]

    eng = create_engine(f"{base}/{name}")
    try:
        alembic("upgrade", "head")
        with eng.connect() as c:
            assert c.scalar(text("SELECT version_num FROM alembic_version")) == "v3h_walk_routes"
        ins = inspect(eng)
        assert {c["name"] for c in ins.get_columns("walk_routes")} == {"from_place_id", "to_place_id", "distance_m", "path"}
        assert ins.get_pk_constraint("walk_routes")["constrained_columns"] == ["from_place_id", "to_place_id"]
        alembic("downgrade", "-1")
        with eng.connect() as c:
            assert c.scalar(text("SELECT version_num FROM alembic_version")) == "v3g_monthly_grade"
        assert not inspect(eng).has_table("walk_routes")
        alembic("upgrade", "head")
        assert inspect(eng).has_table("walk_routes")
    finally:
        eng.dispose()
        with admin.connect() as c:
            c.execute(text(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))
        admin.dispose()
