"""버디·해설사 본인용 — BD-03 프로필 · BD-04 가능 일정 · BD-05 요청함 · BD-06 확정 일정 · BD-07 활동 내역 (B 담당)

해설사(guide)는 같은 엔드포인트를 쓰고 type=tour 항목만 본다.
"""
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import require_role
from app.core.errors import api_error
from app.models.booking import Booking, BookingItem
from app.models.supply import BuddyAvailability, BuddyProfile, Guide, Tour, University
from app.models.user import User
from app.schemas.buddy import (
    AvailabilityIn,
    AvailabilityOut,
    BuddyProfileIn,
    BuddyProfileOut,
    BuddyRequestOut,
    EarningItem,
    EarningsOut,
    TouristSummary,
)
from app.schemas.common import ListResponse
from app.services.booking_state import describe

router = APIRouter(prefix="/buddy", tags=["buddy"])
SUPPLIER = require_role("buddy", "guide")
MONTH = "2027-01"  # 데모 기간


def _profile(db: Session, user: User) -> BuddyProfile:
    prof = db.scalar(select(BuddyProfile).where(BuddyProfile.user_id == user.id))
    if not prof:
        raise api_error(404, "NOT_FOUND", "버디 프로필이 없습니다. 먼저 등록하세요")
    return prof


def _my_items(db: Session, user: User, statuses: list[str] | None = None) -> list[BookingItem]:
    if user.role == "guide":
        guide = db.scalar(select(Guide).where(Guide.user_id == user.id))
        tour_ids = db.scalars(select(Tour.id).where(Tour.guide_id == guide.id)).all() if guide else []
        q = select(BookingItem).where(BookingItem.type == "tour", BookingItem.ref_id.in_(tour_ids))
    else:
        prof = db.scalar(select(BuddyProfile).where(BuddyProfile.user_id == user.id))
        q = select(BookingItem).where(BookingItem.type == "buddy", BookingItem.ref_id == (prof.id if prof else -1))
    if statuses:
        q = q.where(BookingItem.status.in_(statuses))
    return db.scalars(q.order_by(BookingItem.date_from, BookingItem.time)).all()


def _req_out(db: Session, it: BookingItem) -> BuddyRequestOut:
    booking = db.get(Booking, it.booking_id)
    tourist = db.get(User, booking.tourist_id)
    trav = booking.traveler or {}
    title, _ = describe(db, it)
    meeting = None
    if it.type == "tour":
        tour = db.get(Tour, it.ref_id)
        meeting = tour.meeting_point if tour else None
    return BuddyRequestOut(
        item_id=it.id, id=it.id, booking_id=booking.id, booking_code=booking.code, type=it.type,
        tourist=TouristSummary(id=tourist.id, name=trav.get("name") or tourist.name, nationality=trav.get("nationality"), language=tourist.language),
        date=it.date_from.isoformat(), time=it.time, duration_min=it.duration_min, price=it.price,
        interests=trav.get("interests") or [], status=it.status, reject_reason=it.reject_reason,
        google_event_id=it.google_event_id, meeting_point=meeting, title=title,
    )


@router.get("/profile", response_model=BuddyProfileOut)
def get_profile(user: User = Depends(SUPPLIER), db: Session = Depends(get_db)) -> BuddyProfileOut:
    """BD-03 조회"""
    return _profile_out(db, user, _profile(db, user))


def _profile_out(db: Session, user: User, prof: BuddyProfile) -> BuddyProfileOut:
    uni = db.get(University, prof.university_id)
    dates = db.scalars(select(BuddyAvailability.date).where(BuddyAvailability.buddy_id == prof.id).order_by(BuddyAvailability.date)).all()
    return BuddyProfileOut(
        id=prof.id, user_id=user.id, name=user.name, university=uni.name if uni else "", university_id=prof.university_id,
        major=prof.major, year=prof.year, languages=prof.languages or [], interests=prof.interests or [], intro=prof.intro,
        avatar=prof.avatar, status=prof.status, hourly_fee=prof.hourly_fee, available_dates=[d.isoformat() for d in dates],
    )


@router.put("/profile", response_model=BuddyProfileOut)
def upsert_profile(body: BuddyProfileIn, user: User = Depends(SUPPLIER), db: Session = Depends(get_db)) -> BuddyProfileOut:
    """BD-03 등록·수정. 처음 만들면 status=pending(대학 담당자 승인 전)."""
    prof = db.scalar(select(BuddyProfile).where(BuddyProfile.user_id == user.id))
    if not prof:
        if not user.university_id:
            raise api_error(422, "VALIDATION", "소속 대학(university_id)이 먼저 필요합니다 (역할 선택 단계)")
        prof = BuddyProfile(user_id=user.id, university_id=user.university_id, status="pending", hourly_fee=15000)
        db.add(prof)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(prof, k, v)
    db.commit()
    db.refresh(prof)
    return _profile_out(db, user, prof)


@router.get("/availability", response_model=AvailabilityOut)
def get_availability(user: User = Depends(SUPPLIER), db: Session = Depends(get_db)) -> AvailabilityOut:
    prof = _profile(db, user)
    dates = db.scalars(select(BuddyAvailability.date).where(BuddyAvailability.buddy_id == prof.id).order_by(BuddyAvailability.date)).all()
    return AvailabilityOut(dates=[d.isoformat() for d in dates])


@router.put("/availability", response_model=AvailabilityOut)
def set_availability(body: AvailabilityIn, user: User = Depends(SUPPLIER), db: Session = Depends(get_db)) -> AvailabilityOut:
    """BD-04: 가능 날짜 목록 교체"""
    prof = _profile(db, user)
    db.execute(delete(BuddyAvailability).where(BuddyAvailability.buddy_id == prof.id))
    for d in sorted(set(body.dates)):
        db.add(BuddyAvailability(buddy_id=prof.id, date=d))
    db.commit()
    return AvailabilityOut(dates=[d.isoformat() for d in sorted(set(body.dates))])


@router.get("/requests", response_model=ListResponse[BuddyRequestOut])
def requests(status: str | None = None, user: User = Depends(SUPPLIER), db: Session = Depends(get_db)) -> ListResponse[BuddyRequestOut]:
    """BD-05: 내게 온 요청. status 미지정이면 전체"""
    if status and status not in ("requested", "approved", "rejected", "confirmed", "cancelled"):
        raise api_error(422, "VALIDATION", "status 값이 올바르지 않습니다")
    items = _my_items(db, user, [status] if status else None)
    return ListResponse(items=[_req_out(db, i) for i in items])


@router.get("/schedule", response_model=ListResponse[BuddyRequestOut])
def schedule(date_from: date | None = None, date_to: date | None = None, user: User = Depends(SUPPLIER), db: Session = Depends(get_db)) -> ListResponse[BuddyRequestOut]:
    """BD-06: 확정 일정"""
    items = [i for i in _my_items(db, user, ["approved", "confirmed"]) if (not date_from or i.date_from >= date_from) and (not date_to or i.date_from <= date_to)]
    return ListResponse(items=[_req_out(db, i) for i in items])


@router.get("/earnings", response_model=EarningsOut)
def earnings(month: str = MONTH, user: User = Depends(SUPPLIER), db: Session = Depends(get_db)) -> EarningsOut:
    """BD-07: 활동 내역·정산 (정산 지급은 목업: 지난달 이전 확정분은 paid, 이번 달은 pending)"""
    items = _my_items(db, user, ["approved", "confirmed"])
    rows: list[EarningItem] = []
    for it in items:
        booking = db.get(Booking, it.booking_id)
        trav = booking.traveler or {}
        title, _ = describe(db, it)
        status = "paid" if it.date_from.isoformat()[:7] < month else "pending"
        rows.append(EarningItem(booking_item_id=it.id, date=it.date_from.isoformat(), tourist=f"{trav.get('name', '')} · {trav.get('nationality', '')}", activity=title, amount=it.price, status=status))
    rows.sort(key=lambda r: r.date, reverse=True)
    this_month = [r for r in rows if r.date[:7] == month]
    paid = sum(r.amount for r in rows if r.status == "paid")
    pending = sum(r.amount for r in rows if r.status == "pending")
    return EarningsOut(month=month, period=month, activities=len(this_month), total_fee=sum(r.amount for r in this_month), paid=paid, pending=pending, items=rows)
