"""v3.5 코스 걷는 시간 계산 (services/courses.py) · TR-01/02 · AD-07 응답"""
from itertools import pairwise

import pytest

from app.core import rules
from app.services import courses
from app.services.courses import Stop

# 성북근현대문학관(111) → 수연산방(102): 직선 약 348 m (시드 좌표)
LIT = Stop(111, 37.59251, 126.997056, 40)
SUY = Stop(102, 37.595107, 126.994855, 30)


def test_straight_distance_known_points():
    # 위도 0.001도 ≈ 111.2 m (경도 같음)
    assert courses.straight_m(37.0, 127.0, 37.001, 127.0) == pytest.approx(111.19, abs=0.05)
    assert courses.straight_m(LIT.lat, LIT.lng, SUY.lat, SUY.lng) == pytest.approx(348, abs=1)


def test_leg_detour_rounding_and_ceil():
    lg = courses.leg(LIT, SUY)
    # 348 m × 1.3 = 452 m → 10 m 반올림 450, 452 m ÷ 4 km/h = 6.78분 → 7분
    assert (lg.from_place_id, lg.to_place_id, lg.walk_m, lg.walk_min) == (111, 102, 450, 7)
    assert isinstance(lg.walk_m, int) and isinstance(lg.walk_min, int)
    assert rules.WALK_DETOUR_PERCENT == 130 and rules.WALK_M_PER_HOUR == 4000


def test_leg_exact_minute_and_same_place():
    # 직선 1000 m 가 되도록 위도 차이를 잡으면 걷는 길 1300 m → 19.5분 → 20분
    d = 1000 / 111_194.93
    lg = courses.leg(Stop(1, 37.0, 127.0, 0), Stop(2, 37.0 + d, 127.0, 0))
    assert (lg.walk_m, lg.walk_min) == (1300, 20)
    same = courses.leg(Stop(1, 37.0, 127.0, 0), Stop(2, 37.0, 127.0, 0))
    assert (same.walk_m, same.walk_min) == (0, 0)


def test_summarize_rounds_up_to_10_minutes():
    ct = courses.summarize([LIT, SUY])
    # 머무는 70 + 걷는 7 = 77 → 80
    assert (ct.stay_min_total, ct.walk_m_total, ct.walk_min_total, ct.duration_min, ct.walk_complete) == (70, 450, 7, 80, True)
    # 딱 떨어지면 그대로
    assert courses.summarize([Stop(1, None, None, 60)]).duration_min == 60
    assert courses.summarize([]).duration_min == 0


def test_missing_coordinates_skip_leg():
    no_xy = Stop(129, None, None, 30)
    ct = courses.summarize([LIT, SUY, no_xy, Stop(130, 0, 0, 20)])
    assert [x.walk_m for x in ct.legs] == [450, None, None]
    assert ct.walk_complete is False
    assert (ct.walk_m_total, ct.walk_min_total, ct.stay_min_total) == (450, 7, 120)
    assert ct.duration_min == 130  # 120 + 7 → 130


def test_tours_api_fields(client):
    items = client.get("/api/v1/tours").json()["items"]
    assert len(items) == 5
    for t in items:
        assert {"duration_min", "stay_min_total", "walk_m_total", "walk_min_total", "walk_complete", "legs"} <= set(t)
        assert len(t["legs"]) == len(t["places"]) - 1
        assert t["stay_min_total"] == sum(p["stay_min"] for p in t["places"])
        assert t["walk_m_total"] == sum(x["walk_m"] for x in t["legs"])
        assert t["walk_min_total"] == sum(x["walk_min"] for x in t["legs"])
        assert t["duration_min"] % 10 == 0 and t["duration_min"] >= t["stay_min_total"] + t["walk_min_total"]
        assert t["walk_complete"] is True
        assert {"photo_url", "photo_credit"} <= set(t["places"][0])
        ids = [p["id"] for p in t["places"]]
        assert [(x["from_place_id"], x["to_place_id"]) for x in t["legs"]] == list(pairwise(ids))


def test_writers_walk_now_reports_real_time(client):
    t = client.get("/api/v1/tours/3").json()
    assert t["title"] == "문인의 성북동 산책"
    # 손으로 적던 120분은 머무는 시간(135분)보다도 짧았다. 좌표는 places.json이 바뀌면 조금 달라질 수 있어 범위로 본다
    assert t["duration_min"] >= 170
    assert t["stay_min_total"] == 135 and len(t["legs"]) == 3
    assert 1200 <= t["walk_m_total"] <= 2200 and all(x["walk_min"] >= 1 for x in t["legs"])


def test_admin_tours_uses_computed_duration(client, operator):
    rows = {r["id"]: r for r in client.get("/api/v1/admin/tours", headers=operator).json()["items"]}
    detail = client.get("/api/v1/tours/3").json()
    assert rows[3]["duration_min"] == detail["duration_min"] >= 170
    assert rows[3]["walk_complete"] is True
