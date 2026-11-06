"""v3.5 코스 걷는 시간 — 손으로 적은 duration_min 대신 장소 좌표·머무는 시간으로 계산한다.

구간(장소 → 다음 장소): 직선거리(위도·경도) × 1.3(돌아가는 길) → walk_m(10 m 단위 반올림), 4 km/h → walk_min(올림).
코스: stay_min_total(장소마다 머무는 시간 합) + walk_min_total, 10분 단위로 올림 = duration_min.
좌표가 없는 장소가 끼면 그 구간의 걷는 시간은 빼고(null) walk_complete=false 로 알린다.
TR-01·TR-02(routers/tours.py)와 AD-07(routers/admin.py)이 모두 이 함수를 쓴다.

v3.8 실제 도보 경로: 두 장소 사이 OpenStreetMap 도보 경로(walk_routes 표, scripts/fetch_walk_routes.py로 미리 받아 둠)가
있으면 그 거리(distance_m)를 쓰고 지도에 그릴 길(path)도 같이 내보낸다 (source "route"). 없으면 위의 직선 × 1.3 추정
(source "estimate", path null). 걷는 속도는 둘 다 4 km/h — 거리만 실제 값으로 바뀐다. 요청 중에 외부 API는 부르지 않는다.
경로는 한 요청에 한 번만 읽는다(load_routes, 필요한 장소 쌍 한 번에).

장소 순서 정하기(best_order): 끝에서 돌아오지 않는 한 줄 길의 걷는 거리 합이 가장 짧은 순서.
실제 경로가 있으면 그 거리, 없으면 추정 거리. 8곳 이하는 모든 순서를 다 보고, 넘으면 가까운 곳 먼저 + 2-opt.
거리가 같으면 장소 id 순서가 앞서는 쪽. 좌표 없는 장소는 원래 순서대로 맨 뒤.
"""
import math
from dataclasses import dataclass, field
from itertools import pairwise, permutations
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import rules
from app.models import Place, TourPlace, WalkRoute

EARTH_RADIUS_M = 6_371_000


@dataclass(frozen=True)
class Stop:
    place_id: int
    lat: float | None
    lng: float | None
    stay_min: int


LegSource = Literal["route", "estimate"]
RouteSource = Literal["route", "estimate", "mixed"]


@dataclass(frozen=True)
class Route:
    """저장해 둔 실제 도보 경로 한 방향 (path는 출발 → 도착 [[위도, 경도], ...])"""
    distance_m: int
    path: list[list[float]]


Routes = dict[tuple[int, int], Route]  # (작은 장소 id, 큰 장소 id) → 작은 id에서 큰 id로 가는 경로


@dataclass(frozen=True)
class Leg:
    from_place_id: int
    to_place_id: int
    walk_m: int | None  # 10 m 단위. 좌표가 없으면 None
    walk_min: int | None
    source: LegSource | None = None  # v3.8 route = OpenStreetMap 실제 경로, estimate = 직선 × 1.3, 좌표 없으면 None
    path: list[list[float]] | None = None  # v3.8 실제 경로일 때만 [[위도, 경도], ...] (from → to 방향)


@dataclass(frozen=True)
class CourseTime:
    stay_min_total: int
    walk_m_total: int
    walk_min_total: int
    duration_min: int
    walk_complete: bool  # 모든 구간의 걷는 시간이 들어갔으면 True
    legs: list[Leg] = field(default_factory=list)
    route_source: RouteSource = "estimate"  # v3.8 모든 구간이 실제 경로면 route, 하나도 없으면 estimate, 섞이면 mixed


def straight_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """두 좌표 사이 직선거리(m, 하버사인). 거리는 float 중간값을 쓰고 밖으로는 int만 내보낸다."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(h))


def _has_coords(s: Stop) -> bool:
    return bool(s.lat) and bool(s.lng)  # None 이나 0 은 좌표 없음


def estimate_m(a: Stop, b: Stop) -> int:
    """추정 걷는 길 m = 직선 m × 130% (정수). 좌표가 있어야 한다"""
    return rules.pct(round(straight_m(float(a.lat), float(a.lng), float(b.lat), float(b.lng))), rules.WALK_DETOUR_PERCENT)


def route_between(routes: Routes | None, a_id: int, b_id: int) -> Route | None:
    """저장한 경로는 (작은 id → 큰 id) 한 줄뿐이라, 반대 방향이면 거리는 같고 path만 뒤집는다"""
    if not routes or a_id == b_id:
        return None
    if a_id < b_id:
        return routes.get((a_id, b_id))
    r = routes.get((b_id, a_id))
    return Route(r.distance_m, r.path[::-1]) if r else None


def walk_min_of(route_m: int) -> int:
    """걷는 길 ÷ 4 km/h, 올림"""
    return -(-route_m * 60 // rules.WALK_M_PER_HOUR)


def leg(a: Stop, b: Stop, routes: Routes | None = None) -> Leg:
    """한 구간. 실제 경로가 있으면 그 거리, 없으면 직선 × 130%. walk_m = 10 m 반올림, walk_min = 걷는 길 ÷ 4 km/h 올림"""
    if not (_has_coords(a) and _has_coords(b)):
        return Leg(a.place_id, b.place_id, None, None)
    r = route_between(routes, a.place_id, b.place_id)
    route_m = r.distance_m if r else estimate_m(a, b)
    walk_m = (route_m + 5) // 10 * 10
    if r:
        return Leg(a.place_id, b.place_id, walk_m, walk_min_of(route_m), "route", r.path)
    return Leg(a.place_id, b.place_id, walk_m, walk_min_of(route_m), "estimate")


def route_source_of(legs: list[Leg]) -> RouteSource:
    """모든 구간이 실제 경로 → route, 실제 경로가 하나도 없음(구간 없음 포함) → estimate, 그 밖 → mixed"""
    real = sum(1 for x in legs if x.source == "route")
    if legs and real == len(legs):
        return "route"
    return "estimate" if real == 0 else "mixed"


def summarize(stops: list[Stop], routes: Routes | None = None) -> CourseTime:
    """순서대로 놓인 장소 목록 → 구간·합계. duration_min = (머무는 시간 + 걷는 시간)을 10분 단위로 올림"""
    legs = [leg(a, b, routes) for a, b in pairwise(stops)]
    stay = sum(s.stay_min for s in stops)
    walk_m = sum(x.walk_m or 0 for x in legs)
    walk_min = sum(x.walk_min or 0 for x in legs)
    step = rules.DURATION_STEP_MIN
    duration = -(-(stay + walk_min) // step) * step
    return CourseTime(stay_min_total=stay, walk_m_total=walk_m, walk_min_total=walk_min, duration_min=duration,
                      walk_complete=all(x.walk_m is not None for x in legs), legs=legs, route_source=route_source_of(legs))


# ---------- v3.8 저장한 실제 경로 읽기
def load_routes(db: Session, place_ids) -> Routes:
    """이 장소들 사이에 저장된 경로를 한 번에 읽는다 (한 요청에 한 번)"""
    ids = sorted({int(i) for i in place_ids})
    if len(ids) < 2:
        return {}
    rows = db.scalars(select(WalkRoute).where(WalkRoute.from_place_id.in_(ids), WalkRoute.to_place_id.in_(ids))).all()
    return {(r.from_place_id, r.to_place_id): Route(r.distance_m, r.path or []) for r in rows}


# ---------- v3.8 걷는 거리가 가장 짧은 순서
BRUTE_MAX = 8  # 좌표 있는 장소가 이 개수 이하면 모든 순서를 다 본다 (최대 8! = 40,320)


def pair_m(a: Stop, b: Stop, routes: Routes | None = None) -> int:
    """두 장소 사이 걷는 거리(m, 정수): 실제 경로 → 없으면 추정. 둘 다 좌표가 있어야 한다"""
    r = route_between(routes, a.place_id, b.place_id)
    return r.distance_m if r else estimate_m(a, b)


def path_m(stops: list[Stop], routes: Routes | None = None) -> int:
    """순서대로 걸을 때 거리 합 (좌표 없는 구간은 뺀다)"""
    return sum(pair_m(a, b, routes) for a, b in pairwise(stops) if _has_coords(a) and _has_coords(b))


def _open_cost(order: tuple[int, ...], dist: list[list[int]]) -> int:
    return sum(dist[i][j] for i, j in pairwise(order))


def _two_opt(order: list[int], dist: list[list[int]], start: int) -> list[int]:
    """열린 길 2-opt: order[i..j] 를 뒤집어 짧아지면 바꾼다. start 앞은 고정 (keep_first면 1)"""
    n = len(order)
    improved = True
    while improved:
        improved = False
        for i in range(start, n - 1):
            for j in range(i + 1, n):
                a, b = order[i], order[j]
                before = (dist[order[i - 1]][a] if i > 0 else 0) + (dist[b][order[j + 1]] if j + 1 < n else 0)
                after = (dist[order[i - 1]][b] if i > 0 else 0) + (dist[a][order[j + 1]] if j + 1 < n else 0)
                if after < before:
                    order[i:j + 1] = order[i:j + 1][::-1]
                    improved = True
    return order


def _nearest(dist: list[list[int]], first: int, n: int) -> list[int]:
    """가까운 곳 먼저 (거리가 같으면 앞 번호 = 작은 장소 id)"""
    order, left = [first], set(range(n)) - {first}
    while left:
        nxt = min(left, key=lambda j: (dist[order[-1]][j], j))
        order.append(nxt)
        left.remove(nxt)
    return order


def best_order(stops: list[Stop], keep_first: bool = False, routes: Routes | None = None) -> list[Stop]:
    """걷는 거리 합이 가장 짧은 순서 (돌아오지 않는 한 줄 길). keep_first면 첫 장소는 그대로 첫 번째.
    좌표 없는 장소는 원래 순서대로 맨 뒤. 거리가 같으면 장소 id 순서가 사전순으로 앞서는 쪽 (늘 같은 답)."""
    if len(stops) < 2:
        return list(stops)
    head = [stops[0]] if keep_first else []
    rest = stops[1:] if keep_first else list(stops)
    unknown = [s for s in rest if not _has_coords(s)]
    known = sorted((s for s in rest if _has_coords(s)), key=lambda s: s.place_id)
    if head and not _has_coords(head[0]):  # 첫 장소 좌표가 없으면 첫 자리만 지키고 나머지끼리 정한다
        return head + best_order(known, routes=routes) + unknown
    nodes = head + known  # 0번 = 고정 첫 장소 (있으면)
    n = len(nodes)
    if n < 2:
        return nodes + unknown
    dist = [[0 if i == j else pair_m(nodes[i], nodes[j], routes) for j in range(n)] for i in range(n)]
    fixed = 1 if head else 0
    free = list(range(fixed, n))
    if n <= BRUTE_MAX:
        best, best_cost = None, None
        for perm in permutations(free):  # free가 장소 id 순이라 사전순으로 나온다 → 처음 찾은 최소가 tie-break 답
            order = (0, *perm) if fixed else perm
            cost = _open_cost(order, dist)
            if best_cost is None or cost < best_cost:
                best, best_cost = order, cost
        idx = list(best)
    else:
        starts = [0] if fixed else free
        cands = [_two_opt(_nearest(dist, s, n), dist, fixed) for s in starts]
        idx = min(cands, key=lambda o: (_open_cost(tuple(o), dist), [nodes[i].place_id for i in o]))
    return [nodes[i] for i in idx] + unknown


def stop_rows(db: Session, tour_id: int) -> list[tuple[TourPlace, Place]]:
    """코스 장소를 순서(tour_places.seq)대로"""
    return [tuple(r) for r in db.execute(
        select(TourPlace, Place).join(Place, Place.id == TourPlace.place_id)
        .where(TourPlace.tour_id == tour_id).order_by(TourPlace.seq)
    ).all()]


def stay_of(tp: TourPlace, p: Place) -> int:
    """이 코스에서 머무는 시간: 코스별 값(tour_places.stay_min)이 있으면 그것, 없으면 장소 기본값"""
    return tp.stay_min or p.stay_min or 0


def from_rows(rows: list[tuple[TourPlace, Place]], routes: Routes | None = None) -> CourseTime:
    return summarize([Stop(p.id, p.lat, p.lng, stay_of(tp, p)) for tp, p in rows], routes)


def course_time(db: Session, tour_id: int) -> CourseTime:
    """코스 하나의 걷는 시간·전체 시간 (TR-01·02, AD-07 공용)"""
    rows = stop_rows(db, tour_id)
    return from_rows(rows, load_routes(db, [p.id for _, p in rows]))
