"""TR-01~05 코스·장소 (A 담당) — 경로·응답 형식은 docs/api-detail/TR-*.md 기준.

v3: tours는 무료 AI 산책 코스(price 0, 해설사 없음 → guide null, 예약 항목 아님). 장소 이야기는 AI-02.
공개 조회라 로그인 없이 호출된다. 운영 요일·좌표 같은 사실 값은 DB 그대로 내보낸다.
"""
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import rules
from app.core.db import get_db
from app.core.deps import require_role
from app.core.errors import api_error
from app.models import CourseSurvey, Place, Tour, User
from app.schemas.common import ListResponse
from app.schemas.tours import (
    CourseLegOut,
    PlaceOut,
    ReviewListOut,
    SurveyIn,
    SurveyOut,
    TourOut,
    TourPlaceOut,
)
from app.services import courses, free_tier
from app.services.reviews import average, item_reviews

router = APIRouter(tags=["tours"])

WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def _coord(v) -> float | None:
    return float(v) if v else None


def to_out(db: Session, t: Tour, routes: courses.Routes | None = None,
           rows: list | None = None) -> TourOut:
    """코스 + 장소(순서대로) + v3.5 걷는 구간·계산한 전체 시간. v3.8 routes(저장한 실제 경로)를 안 주면 여기서 한 번 읽는다"""
    rows = courses.stop_rows(db, t.id) if rows is None else rows
    if routes is None:
        routes = courses.load_routes(db, [p.id for _, p in rows])
    ct = courses.from_rows(rows, routes)
    return TourOut(
        id=t.id, title=t.title, title_en=t.title_en, theme=t.theme, guide=None,
        duration_min=ct.duration_min, stay_min_total=ct.stay_min_total, walk_m_total=ct.walk_m_total,
        walk_min_total=ct.walk_min_total, walk_complete=ct.walk_complete, route_source=ct.route_source,
        price=t.price, operating_days=t.operating_days or [],
        languages=t.languages or [], meeting_point=t.meeting_point, description=t.description,
        places=[TourPlaceOut(order=tp.seq, id=p.id, name=p.name, name_en=p.name_en, lat=_coord(p.lat), lng=_coord(p.lng),
                             stay_min=courses.stay_of(tp, p), photo_url=p.photo_url, photo_credit=p.photo_credit)
                for tp, p in rows],
        legs=[CourseLegOut(**vars(x)) for x in ct.legs],
    )


@router.get("/tours", response_model=ListResponse[TourOut])
def list_tours(
    theme: str | None = None, date: date | None = None, language: str | None = None,
    cursor: str | None = None, db: Session = Depends(get_db),
) -> ListResponse[TourOut]:
    """TR-01: theme·날짜(운영 요일, 비어 있으면 매일)·언어로 거른다. 코스가 몇 개뿐이라 cursor는 받기만 한다."""
    q = select(Tour).order_by(Tour.id)
    if theme:
        q = q.where(Tour.theme == theme)
    tours = []
    for t in db.scalars(q).all():
        if date and t.operating_days and WEEKDAYS[date.weekday()] not in t.operating_days:
            continue
        if language and language not in (t.languages or []):
            continue
        tours.append((t, courses.stop_rows(db, t.id)))
    # v3.8 모든 코스 장소 사이 경로를 한 번에 읽는다
    routes = courses.load_routes(db, [p.id for _, rows in tours for _, p in rows])
    return ListResponse(items=[to_out(db, t, routes, rows) for t, rows in tours])


@router.get("/tours/{tour_id}", response_model=TourOut)
def get_tour(tour_id: int, db: Session = Depends(get_db)) -> TourOut:
    """TR-02: 코스 상세 + 장소 순서(order 오름차순)"""
    t = db.get(Tour, tour_id)
    if not t:
        raise api_error(404, "NOT_FOUND", "코스를 찾을 수 없습니다")
    return to_out(db, t)


@router.get("/tours/{tour_id}/reviews", response_model=ReviewListOut)
def tour_reviews(tour_id: int, cursor: str | None = None, db: Session = Depends(get_db)) -> ReviewListOut:
    """TR-04 (목업): 코스는 예약하지 않아 실제 리뷰가 없으므로 고정 예시를 돌려준다."""
    if not db.get(Tour, tour_id):
        raise api_error(404, "NOT_FOUND", "코스를 찾을 수 없습니다")
    items, _ = item_reviews(db, "tour", tour_id)
    return ReviewListOut(items=items, average_rating=average(items))


@router.post("/tours/{tour_id}/survey", response_model=SurveyOut, status_code=201)
def course_survey(tour_id: int, body: SurveyIn, user: User = Depends(require_role("tourist")),
                  db: Session = Depends(get_db)) -> CourseSurvey:
    """TR-05 (v3.4): '코스 다 걸었어요' 뒤 설문 3문항 저장. 낸 때의 이용 방식(free|buddy)을 같이 남긴다."""
    if not db.get(Tour, tour_id):
        raise api_error(404, "NOT_FOUND", "코스를 찾을 수 없습니다")
    if body.pain not in rules.SURVEY_PAIN:
        raise api_error(422, "VALIDATION", f"pain은 {' | '.join(rules.SURVEY_PAIN)}")
    row = CourseSurvey(user_id=user.id, tour_id=tour_id, satisfaction=body.satisfaction, pain=body.pain,
                       want_buddy=body.want_buddy, plan=free_tier.plan_of(db, user))
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _place_out(p: Place) -> PlaceOut:
    return PlaceOut(
        id=p.id, name=p.name, name_en=p.name_en, lat=float(p.lat), lng=float(p.lng), address=p.address,
        hours=p.hours, closed_days=p.closed_days or [], fee=p.fee, need_reservation=p.need_reservation,
        stay_min=p.stay_min, tags=p.tags or [], photo_url=p.photo_url, photo_credit=p.photo_credit,
    )


@router.get("/places", response_model=ListResponse[PlaceOut])
def list_places(tag: str | None = None, db: Session = Depends(get_db)) -> ListResponse[PlaceOut]:
    """TR-03 목록: 코스 화면·버디 요청(더 가 보고 싶은 곳)·활동 기록에서 쓴다. tag로 거를 수 있다."""
    rows = db.scalars(select(Place).order_by(Place.id)).all()
    return ListResponse(items=[_place_out(p) for p in rows if not tag or tag in (p.tags or [])])


@router.get("/places/{place_id}", response_model=PlaceOut)
def get_place(place_id: int, db: Session = Depends(get_db)) -> PlaceOut:
    """TR-03: 장소 상세. 운영시간·휴관일·요금·좌표는 DB 값 그대로"""
    p = db.get(Place, place_id)
    if not p:
        raise api_error(404, "NOT_FOUND", "장소를 찾을 수 없습니다")
    return _place_out(p)
