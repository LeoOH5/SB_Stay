"""어드민 — AD-01 대시보드 · AD-02 예약 목록 · AD-03/04 버디 목록·승인 · AD-05 회원 · AD-06 정산 · AD-07 투어 조회 (B 담당)

응답은 프론트(frontend/src/lib/types.ts)의 평면 행 형식을 따른다. univ_admin은 자기 대학 데이터만, operator는 전체.
"""
from collections import defaultdict
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db
from app.core.deps import require_role, scope_university
from app.core.errors import api_error
from app.models.booking import Booking, BookingItem
from app.models.supply import BuddyProfile, DormRoom, Guide, Tour, University
from app.models.user import User
from app.schemas.admin import (
    AdminBookingRow,
    AdminBuddyRow,
    AdminTourRow,
    AdminUserRow,
    BuddyActionIn,
    DailyPoint,
    DashboardOut,
    SettlementRow,
    SettlementsOut,
)
from app.schemas.common import ListResponse
from app.services.availability import nights_between
from app.services.booking_state import describe

router = APIRouter(prefix="/admin", tags=["admin"])
ADMIN = require_role("univ_admin", "operator")
OPERATOR = require_role("operator")
OK = ("approved", "confirmed")
DEMO_FROM, DEMO_TO = date(2027, 1, 5), date(2027, 2, 20)


def _item_university(db: Session, it: BookingItem) -> int | None:
    if it.type == "dorm":
        room = db.get(DormRoom, it.ref_id)
        return room.university_id if room else None
    if it.type == "buddy":
        prof = db.get(BuddyProfile, it.ref_id)
        return prof.university_id if prof else None
    return None


def _visible_items(db: Session, user: User) -> list[BookingItem]:
    items = db.scalars(select(BookingItem).order_by(BookingItem.id.desc())).all()
    if user.role == "operator":
        return items
    return [i for i in items if _item_university(db, i) == user.university_id]


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(from_: date | None = None, to: date | None = None, user: User = Depends(ADMIN), db: Session = Depends(get_db)) -> DashboardOut:
    """AD-01: 기간 내 숙박 항목 기준 예약 수·승인 대기·박수·숙박 매출·플랫폼 수수료·상태별 건수·일별 추이"""
    f, t = from_ or DEMO_FROM, to or DEMO_TO
    items = [i for i in _visible_items(db, user) if i.type == "dorm" and i.date_from and f <= i.date_from <= t]
    fee_rate = get_settings().platform_fee_rate
    nights = sum(nights_between(i.date_from, i.date_to) for i in items if i.status in OK and i.date_to)
    revenue = sum(i.price for i in items if i.status in OK)
    by_status: dict[str, int] = defaultdict(int)
    daily: dict[str, DailyPoint] = {}
    for i in items:
        by_status[i.status] += 1
        d = i.date_from.isoformat()
        p = daily.setdefault(d, DailyPoint(date=d, bookings=0, revenue=0))
        p.bookings += 1
        if i.status in OK:
            p.revenue += i.price
    return DashboardOut(
        period={"from": f.isoformat(), "to": t.isoformat()}, bookings=len({i.booking_id for i in items}),
        pending=sum(1 for i in items if i.status == "requested"), nights=nights, dorm_revenue=revenue,
        platform_fee=round(revenue * fee_rate), fee_rate=fee_rate, by_status=dict(by_status),
        daily=sorted(daily.values(), key=lambda p: p.date),
    )


@router.get("/bookings", response_model=ListResponse[AdminBookingRow])
def admin_bookings(type: str | None = None, status: str | None = None, q: str | None = None, user: User = Depends(ADMIN), db: Session = Depends(get_db)) -> ListResponse[AdminBookingRow]:
    """AD-02: 예약 항목 목록 (유형·상태·검색)"""
    rows = []
    for it in _visible_items(db, user):
        if type and it.type != type:
            continue
        if status and it.status != status:
            continue
        booking = db.get(Booking, it.booking_id)
        trav = booking.traveler or {}
        name = trav.get("name") or db.get(User, booking.tourist_id).name
        if q and q.lower() not in booking.code.lower() and q.lower() not in name.lower():
            continue
        title, meta = describe(db, it)
        rows.append(AdminBookingRow(
            booking_id=booking.id, item_id=it.id, code=booking.code, tourist=name, nationality=trav.get("nationality"),
            type=it.type, title=title, schedule=meta.split(" · ")[0], price=it.price, status=it.status,
            university_id=_item_university(db, it), date_from=it.date_from, date_to=it.date_to, created_at=booking.created_at,
        ))
    return ListResponse(items=rows)


def _buddy_row(db: Session, prof: BuddyProfile) -> AdminBuddyRow:
    u = db.get(User, prof.user_id)
    return AdminBuddyRow(id=prof.id, user_id=u.id, name=u.name, email=u.email, university_id=prof.university_id, major=prof.major, year=prof.year, languages=prof.languages or [], interests=prof.interests or [], status=prof.status)


@router.get("/buddies", response_model=ListResponse[AdminBuddyRow])
def admin_buddies(status: str | None = None, user: User = Depends(ADMIN), db: Session = Depends(get_db)) -> ListResponse[AdminBuddyRow]:
    """AD-03: 소속 버디 목록"""
    q = select(BuddyProfile).order_by(BuddyProfile.id)
    if user.role == "univ_admin":
        q = q.where(BuddyProfile.university_id == user.university_id)
    if status:
        q = q.where(BuddyProfile.status == status)
    return ListResponse(items=[_buddy_row(db, p) for p in db.scalars(q).all()])


@router.patch("/buddies/{profile_id}", response_model=AdminBuddyRow)
def decide_buddy(profile_id: int, body: BuddyActionIn, user: User = Depends(ADMIN), db: Session = Depends(get_db)) -> AdminBuddyRow:
    """AD-04: 버디 승인·제재"""
    prof = db.get(BuddyProfile, profile_id)
    if not prof:
        raise api_error(404, "NOT_FOUND", "버디를 찾을 수 없습니다")
    scope_university(user, prof.university_id)
    if body.action not in ("approve", "suspend"):
        raise api_error(422, "VALIDATION", "action은 approve | suspend")
    prof.status = "approved" if body.action == "approve" else "suspended"
    db.commit()
    db.refresh(prof)
    return _buddy_row(db, prof)


@router.get("/users", response_model=ListResponse[AdminUserRow])
def admin_users(role: str | None = None, user: User = Depends(OPERATOR), db: Session = Depends(get_db)) -> ListResponse[AdminUserRow]:
    """AD-05 (운영자)"""
    q = select(User).order_by(User.id)
    if role:
        q = q.where(User.role == role)
    return ListResponse(items=[AdminUserRow.model_validate(u) for u in db.scalars(q).all()])


@router.get("/settlements", response_model=SettlementsOut)
def settlements(from_: date | None = None, to: date | None = None, user: User = Depends(OPERATOR), db: Session = Depends(get_db)) -> SettlementsOut:
    """AD-06 (운영자): 확정 항목을 공급자별로 집계. 지급 처리는 목업(전부 pending)."""
    f, t = from_ or DEMO_FROM, to or DEMO_TO
    fee_rate = get_settings().platform_fee_rate
    agg: dict[tuple[str, int], SettlementRow] = {}
    for it in db.scalars(select(BookingItem).where(BookingItem.status.in_(OK))).all():
        if not it.date_from or not (f <= it.date_from <= t):
            continue
        if it.type == "dorm":
            room = db.get(DormRoom, it.ref_id)
            uni = db.get(University, room.university_id)
            key, name = ("university", uni.id), f"{uni.name} {room.building}"
        elif it.type == "tour":
            tour = db.get(Tour, it.ref_id)
            guide = db.get(Guide, tour.guide_id)
            key, name = ("guide", guide.id), f"해설사 {db.get(User, guide.user_id).name}"
        else:
            prof = db.get(BuddyProfile, it.ref_id)
            key, name = ("buddy", prof.id), f"버디 {db.get(User, prof.user_id).name}"
        row = agg.setdefault(key, SettlementRow(party_type=key[0], party_id=key[1], target=name, count=0, revenue=0, fee=0, payout=0, status="pending"))
        row.count += 1
        row.revenue += it.price
    for row in agg.values():
        row.fee = round(row.revenue * fee_rate)
        row.payout = row.revenue - row.fee
    items = sorted(agg.values(), key=lambda r: -r.revenue)
    return SettlementsOut(period={"from": f.isoformat(), "to": t.isoformat()}, total=sum(r.revenue for r in items), items=items)


@router.get("/tours", response_model=ListResponse[AdminTourRow])
def admin_tours(user: User = Depends(ADMIN), db: Session = Depends(get_db)) -> ListResponse[AdminTourRow]:
    """AD-07: 투어 코스 조회(시드 데이터)"""
    rows = []
    for t in db.scalars(select(Tour).order_by(Tour.id)).all():
        guide = db.get(Guide, t.guide_id)
        rows.append(AdminTourRow(id=t.id, title=t.title, title_en=t.title_en, theme=t.theme, guide=db.get(User, guide.user_id).name if guide else "", duration_min=t.duration_min, price=t.price, operating_days=t.operating_days or [], languages=t.languages or []))
    return ListResponse(items=rows)
