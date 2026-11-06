"""scripts/fetch_walk_routes.py — 네트워크 없이 쌍 만들기·응답 해석·저장 모양·이어 받기·코스 비교만 검사"""
import json

import httpx

from scripts import fetch_walk_routes as fw

PLACES = [{"id": 101, "name": "A", "lat": 37.59, "lng": 126.99}, {"id": 102, "name": "B", "lat": 37.591, "lng": 126.995},
          {"id": 103, "name": "C", "lat": 37.594, "lng": 126.992}, {"id": 129, "name": "좌표 없음", "lat": None, "lng": None}]
STOPS = [{"tour_id": 3, "place_id": 103, "seq": 2}, {"tour_id": 3, "place_id": 101, "seq": 1},
         {"tour_id": 3, "place_id": 129, "seq": 3}, {"tour_id": 4, "place_id": 102, "seq": 1}, {"tour_id": 4, "place_id": 101, "seq": 2}]
OSRM_OK = {"code": "Ok", "routes": [{"distance": 612.4, "duration": 440.1, "geometry": {
    "type": "LineString", "coordinates": [[126.9900001, 37.5900004], [126.9925, 37.5912], [126.995, 37.591]]}}]}


def test_pairs():
    assert fw.all_pairs(PLACES) == [(101, 102), (101, 103), (102, 103)]  # 좌표 없는 129 제외, 작은 id 먼저
    assert fw.course_pairs(PLACES, STOPS) == [(101, 102), (101, 103)]  # seq 순서로 이어지는 쌍, 129 구간은 뺌
    assert fw.todo_pairs([(101, 102), (101, 103)], [{"from_place_id": 102, "to_place_id": 101, "distance_m": 1, "path": []}]) == [(101, 103)]


def test_route_url_uses_lng_lat():
    url = fw.route_url(PLACES[0], PLACES[1])
    assert url == "https://routing.openstreetmap.de/routed-foot/route/v1/driving/126.990000,37.590000;126.995000,37.591000"
    assert fw.PARAMS == {"overview": "simplified", "geometries": "geojson"}
    assert "@" not in fw.USER_AGENT and fw.USER_AGENT.startswith("SBStay-hackathon/")


def test_parse_route():
    row = fw.parse_route(OSRM_OK, 101, 102)
    assert row == {"from_place_id": 101, "to_place_id": 102, "distance_m": 612,
                   "path": [[37.59, 126.99], [37.5912, 126.9925], [37.591, 126.995]]}  # [위도, 경도] 소수 6자리
    assert fw.parse_route({"code": "NoRoute", "routes": []}, 101, 102) is None
    assert fw.parse_route({"code": "Ok", "routes": [{"distance": 5, "geometry": {"coordinates": [[1, 2]]}}]}, 1, 2) is None
    assert fw.parse_route("not json", 1, 2) is None


def test_merge_and_dump_shape():
    a = {"from_place_id": 103, "to_place_id": 101, "distance_m": 700, "path": [[3, 3], [1, 1]]}  # 반대로 적힘
    b = {"from_place_id": 101, "to_place_id": 102, "distance_m": 612, "path": [[1, 1], [2, 2]]}
    rows = fw.merge([a], [b, {**b, "distance_m": 650}])
    assert rows == [{**b, "distance_m": 650}, {"from_place_id": 101, "to_place_id": 103, "distance_m": 700, "path": [[1, 1], [3, 3]]}]
    raw = fw.dump_routes(rows)
    assert json.loads(raw) == rows and raw.startswith('[\n  {\n    "from_place_id": 101,') and raw.endswith("  }\n]\n")
    assert '"path": [[1, 1], [2, 2]]\n' in raw  # path 는 한 줄
    assert fw.dump_routes([]) == "[]\n"


def test_fetch_one_with_fake_server_retries_once(monkeypatch, capsys):
    monkeypatch.setattr(fw, "RETRY_WAIT_S", 0)
    calls = []

    def handler(req: httpx.Request) -> httpx.Response:
        calls.append(str(req.url))
        assert req.headers["user-agent"] == fw.USER_AGENT
        return httpx.Response(503) if len(calls) == 1 else httpx.Response(200, json=OSRM_OK)

    with httpx.Client(transport=httpx.MockTransport(handler), headers={"User-Agent": fw.USER_AGENT}) as c:
        row = fw.fetch_one(c, PLACES[0], PLACES[1], lambda: None)
    assert row["distance_m"] == 612 and len(calls) == 2 and "overview=simplified" in calls[0]

    with httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(500))) as c:
        assert fw.fetch_one(c, PLACES[0], PLACES[2], lambda: None) is None
    assert "101–103 건너뜀" in capsys.readouterr().out


def test_course_report_compares_orders():
    places = [{"id": 1, "lat": 37.0, "lng": 127.0}, {"id": 2, "lat": 37.004, "lng": 127.0}, {"id": 3, "lat": 37.002, "lng": 127.0}]
    stops = [{"tour_id": 9, "place_id": 1, "seq": 1}, {"tour_id": 9, "place_id": 2, "seq": 2}, {"tour_id": 9, "place_id": 3, "seq": 3}]
    rows = [{"from_place_id": 1, "to_place_id": 2, "distance_m": 600, "path": [[37.0, 127.0], [37.004, 127.0]]}]
    lines = fw.course_report(places, stops, [{"id": 9, "title": "시험 코스"}], rows)
    assert len(lines) == 1 and lines[0].startswith("코스 9 시험 코스: 지금 1→2→3")
    assert "실제 경로 1/2구간" in lines[0] and "첫 장소 그대로 최적 1→3→2" in lines[0] and "더 짧아요" in lines[0]


def test_dry_run_and_resume(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(fw, "PLACES", tmp_path / "p.json")
    monkeypatch.setattr(fw, "TOUR_PLACES", tmp_path / "tp.json")
    monkeypatch.setattr(fw, "TOURS", tmp_path / "t.json")
    fw.PLACES.write_text(json.dumps(PLACES), encoding="utf-8")
    fw.TOUR_PLACES.write_text(json.dumps(STOPS), encoding="utf-8")
    fw.TOURS.write_text("[]", encoding="utf-8")
    out = tmp_path / "walk_routes.json"
    out.write_text(fw.dump_routes([fw.parse_route(OSRM_OK, 101, 102)]), encoding="utf-8")
    assert fw.main(["--dry-run", "--out", str(out)]) == 0
    assert "대상 쌍 3 · 이미 받음 1 · 이번에 받을 쌍 2" in capsys.readouterr().out
    assert fw.main(["--dry-run", "--only-courses", "--out", str(out)]) == 0
    assert "대상 쌍 2 · 이미 받음 1 · 이번에 받을 쌍 1" in capsys.readouterr().out
