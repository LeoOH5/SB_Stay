"""v3.5 코스 걷는 시간 — 손으로 적은 duration_min 대신 장소 좌표·머무는 시간으로 계산한다.

구간(장소 → 다음 장소): 직선거리(위도·경도) × 1.3(돌아가는 길) → walk_m(10 m 단위 반올림), 4 km/h → walk_min(올림).
코스: stay_min_total(장소마다 머무는 시간 합) + walk_min_total, 10분 단위로 올림 = duration_min.
좌표가 없는 장소가 끼면 그 구간의 걷는 시간은 빼고(null) walk_complete=false 로 알린다.
TR-01·TR-02(routers/tours.py)와 AD-07(routers/admin.py)이 모두 이 함수를 쓴다.
"""
import math
from dataclasses import dataclass, field
from itertools import pairwise

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import rules
from app.models import Place, TourPlace

EARTH_RADIUS_M = 6_371_000


@dataclass(frozen=True)
class Stop:
    place_id: int
    lat: float | None
    lng: float | None
    stay_min: int


@dataclass(frozen=True)
class Leg:
    from_place_id: int
    to_place_id: int
    walk_m: int | None  # 10 m 단위. 좌표가 없으면 None
    walk_min: int | None


@dataclass(frozen=True)
class CourseTime:
    stay_min_total: int
    walk_m_total: int
    walk_min_total: int
    duration_min: int
    walk_complete: bool  # 모든 구간의 걷는 시간이 들어갔으면 True
    legs: list[Leg] = field(default_factory=list)


def straight_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """두 좌표 사이 직선거리(m, 하버사인). 거리는 float 중간값을 쓰고 밖으로는 int만 내보낸다."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(h))


def _has_coords(s: Stop) -> bool:
    return bool(s.lat) and bool(s.lng)  # None 이나 0 은 좌표 없음


def leg(a: Stop, b: Stop) -> Leg:
    """한 구간. 걷는 길 m = 직선 m × 130% (정수), walk_m = 10 m 반올림, walk_min = 걷는 길 ÷ 4 km/h 올림"""
    if not (_has_coords(a) and _has_coords(b)):
        return Leg(a.place_id, b.place_id, None, None)
    route_m = rules.pct(round(straight_m(float(a.lat), float(a.lng), float(b.lat), float(b.lng))), rules.WALK_DETOUR_PERCENT)
    walk_m = (route_m + 5) // 10 * 10
    walk_min = -(-route_m * 60 // rules.WALK_M_PER_HOUR)  # 올림
    return Leg(a.place_id, b.place_id, walk_m, walk_min)


def summarize(stops: list[Stop]) -> CourseTime:
    """순서대로 놓인 장소 목록 → 구간·합계. duration_min = (머무는 시간 + 걷는 시간)을 10분 단위로 올림"""
    legs = [leg(a, b) for a, b in pairwise(stops)]
    stay = sum(s.stay_min for s in stops)
    walk_m = sum(x.walk_m or 0 for x in legs)
    walk_min = sum(x.walk_min or 0 for x in legs)
    step = rules.DURATION_STEP_MIN
    duration = -(-(stay + walk_min) // step) * step
    return CourseTime(stay_min_total=stay, walk_m_total=walk_m, walk_min_total=walk_min, duration_min=duration,
                      walk_complete=all(x.walk_m is not None for x in legs), legs=legs)


def stop_rows(db: Session, tour_id: int) -> list[tuple[TourPlace, Place]]:
    """코스 장소를 순서(tour_places.seq)대로"""
    return [tuple(r) for r in db.execute(
        select(TourPlace, Place).join(Place, Place.id == TourPlace.place_id)
        .where(TourPlace.tour_id == tour_id).order_by(TourPlace.seq)
    ).all()]


def stay_of(tp: TourPlace, p: Place) -> int:
    """이 코스에서 머무는 시간: 코스별 값(tour_places.stay_min)이 있으면 그것, 없으면 장소 기본값"""
    return tp.stay_min or p.stay_min or 0


def from_rows(rows: list[tuple[TourPlace, Place]]) -> CourseTime:
    return summarize([Stop(p.id, p.lat, p.lng, stay_of(tp, p)) for tp, p in rows])


def course_time(db: Session, tour_id: int) -> CourseTime:
    """코스 하나의 걷는 시간·전체 시간 (TR-01·02, AD-07 공용)"""
    return from_rows(stop_rows(db, tour_id))
