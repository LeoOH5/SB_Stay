"""TR-01~04 투어·장소 (A 담당) — 경로·응답 형식은 docs/api-detail/TR-*.md 기준.

공개 조회라 로그인 없이 호출된다. 가격·운영 요일·좌표 같은 사실 값은 DB 그대로 내보낸다.
"""
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.errors import api_error
from app.models import BookingItem, Guide, Place, Review, Tour, TourPlace, User
from app.schemas.common import ListResponse
from app.schemas.tours import GuideBrief, PlaceOut, ReviewListOut, ReviewOut, TourOut, TourPlaceOut

router = APIRouter(tags=["tours"])

WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

# TR-04: 실제 리뷰가 아직 없을 때 화면이 비지 않도록 보여 주는 고정 예시
SAMPLE_REVIEWS = [
    ReviewOut(id=1, rating=5, text="해설이 정말 좋았어요. 심우장 이야기가 기억에 남아요.", created_at=date(2027, 1, 20)),
    ReviewOut(id=2, rating=5, text="The guide explained everything in English. Loved the hanok alleys.", created_at=date(2027, 1, 18)),
    ReviewOut(id=3, rating=4, text="코스가 알차요. 언덕이 있어서 편한 신발 추천합니다.", created_at=date(2027, 1, 16)),
]


def _guide(db: Session, guide_id: int) -> GuideBrief:
    g = db.get(Guide, guide_id)
    if not g:
        return GuideBrief(id=guide_id, name="")
    u = db.get(User, g.user_id)
    return GuideBrief(id=g.id, name=u.name if u else "", license=g.license, languages=g.languages or [])


def _places(db: Session, tour_id: int) -> list[TourPlaceOut]:
    rows = db.execute(
        select(TourPlace, Place).join(Place, Place.id == TourPlace.place_id)
        .where(TourPlace.tour_id == tour_id).order_by(TourPlace.seq)
    ).all()
    return [
        TourPlaceOut(order=tp.seq, id=p.id, name=p.name, name_en=p.name_en, lat=float(p.lat), lng=float(p.lng),
                     stay_min=tp.stay_min or p.stay_min)
        for tp, p in rows
    ]


def to_out(db: Session, t: Tour) -> TourOut:
    return TourOut(
        id=t.id, title=t.title, title_en=t.title_en, theme=t.theme, guide=_guide(db, t.guide_id),
        duration_min=t.duration_min, price=t.price, operating_days=t.operating_days or [],
        languages=t.languages or [], meeting_point=t.meeting_point, description=t.description,
        places=_places(db, t.id),
    )


@router.get("/tours", response_model=ListResponse[TourOut])
def list_tours(
    theme: str | None = None, date: date | None = None, language: str | None = None,
    cursor: str | None = None, db: Session = Depends(get_db),
) -> ListResponse[TourOut]:
    """TR-01: theme·참가 날짜(운영 요일)·가이드 언어로 거른다. 코스가 몇 개뿐이라 cursor는 받기만 한다."""
    q = select(Tour).order_by(Tour.id)
    if theme:
        q = q.where(Tour.theme == theme)
    items = []
    for t in db.scalars(q).all():
        if date and WEEKDAYS[date.weekday()] not in (t.operating_days or []):
            continue
        if language and language not in (t.languages or []):
            continue
        items.append(to_out(db, t))
    return ListResponse(items=items)


@router.get("/tours/{tour_id}", response_model=TourOut)
def get_tour(tour_id: int, db: Session = Depends(get_db)) -> TourOut:
    """TR-02: 코스 상세 + 장소 순서(order 오름차순)"""
    t = db.get(Tour, tour_id)
    if not t:
        raise api_error(404, "NOT_FOUND", "투어 코스를 찾을 수 없습니다")
    return to_out(db, t)


@router.get("/tours/{tour_id}/reviews", response_model=ReviewListOut)
def tour_reviews(tour_id: int, cursor: str | None = None, db: Session = Depends(get_db)) -> ReviewListOut:
    """TR-04 (목업): BK-08로 남긴 실제 리뷰가 있으면 그것을, 없으면 고정 예시를 돌려준다."""
    if not db.get(Tour, tour_id):
        raise api_error(404, "NOT_FOUND", "투어 코스를 찾을 수 없습니다")
    rows = db.scalars(
        select(Review).join(BookingItem, BookingItem.id == Review.booking_item_id)
        .where(BookingItem.type == "tour", BookingItem.ref_id == tour_id).order_by(Review.id.desc())
    ).all()
    items = [ReviewOut(id=r.id, rating=r.rating, text=r.text, created_at=r.created_at.date()) for r in rows] or SAMPLE_REVIEWS
    avg = round(sum(r.rating for r in items) / len(items), 1)
    return ReviewListOut(items=items, average_rating=avg)


@router.get("/places/{place_id}", response_model=PlaceOut)
def get_place(place_id: int, db: Session = Depends(get_db)) -> PlaceOut:
    """TR-03: 장소 상세. 운영시간·휴관일·요금·좌표는 DB 값 그대로"""
    p = db.get(Place, place_id)
    if not p:
        raise api_error(404, "NOT_FOUND", "장소를 찾을 수 없습니다")
    return PlaceOut(
        id=p.id, name=p.name, name_en=p.name_en, lat=float(p.lat), lng=float(p.lng), address=p.address,
        hours=p.hours, closed_days=p.closed_days or [], fee=p.fee, need_reservation=p.need_reservation,
        stay_min=p.stay_min, tags=p.tags or [],
    )
