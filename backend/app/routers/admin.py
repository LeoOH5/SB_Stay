"""어드민 — AD-01 대시보드 · AD-02 예약 목록 · AD-03/04 버디 목록·승인 · AD-05 회원 · AD-06 정산 · AD-07 코스 조회
· 식비 심사 · 신고 처리 (B 담당)

응답은 프론트(frontend/src/lib/types.ts)의 평면 행 형식을 따른다. univ_admin은 자기 대학 데이터만, operator는 전체.
"""
from collections import defaultdict
from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import rules
from app.core.config import get_settings
from app.core.db import get_db
from app.core.deps import require_role, scope_university
from app.core.errors import api_error
from app.models.booking import Booking, BookingItem, MealClaim, Report
from app.models.supply import BuddyProfile, DormRoom, Place, Tour, TourPlace, University
from app.models.user import User
from app.schemas.admin import (
    AdminBookingRow,
    AdminBuddyRow,
    AdminReportRow,
    AdminTourRow,
    AdminUserRow,
    BuddyActionIn,
    DailyPoint,
    DashboardOut,
    MealDecideIn,
    ReportActionIn,
    SettlementRow,
    SettlementsOut,
)
from app.schemas.buddy import AdminMealClaimOut
from app.schemas.common import ListResponse
from app.services import meals, reports
from app.services.availability import nights_between
from app.services.booking_state import album_fee, describe, meal_sums

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
    return AdminBuddyRow(
        id=prof.id, user_id=u.id, name=u.name, email=u.email, university_id=prof.university_id, major=prof.major, year=prof.year,
        languages=prof.languages or [], interests=prof.interests or [], status=prof.status,
        age=rules.age_on(u.birth_date, get_settings().today()) if u.birth_date else None,
        school_email_verified=prof.school_email_verified_at is not None, code_agreed=prof.code_agreed_at is not None,
        quiz_score=prof.quiz_score, report_count=reports.count_for(db, prof.id), can_help=prof.can_help or [],
    )


def missing_for_approval(db: Session, prof: BuddyProfile) -> list[str]:
    """승인 조건: 학교 메일 인증 · 만 19세 · 약속 동의 · 퀴즈 8점 이상"""
    u = db.get(User, prof.user_id)
    miss = []
    if not prof.school_email_verified_at:
        miss.append("학교 메일 인증")
    if not u.birth_date or rules.age_on(u.birth_date, get_settings().today()) < rules.BUDDY_MIN_AGE:
        miss.append(f"만 {rules.BUDDY_MIN_AGE}세 확인")
    if not prof.code_agreed_at:
        miss.append("버디 약속 동의")
    if (prof.quiz_score or 0) < rules.QUIZ_PASS:
        miss.append(f"교육 퀴즈 {rules.QUIZ_PASS}점 이상")
    return miss


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
    """AD-04: 버디 승인·제재. 승인은 학교 메일·만 19세·약속 동의·퀴즈 8점을 모두 채워야 한다 (아니면 409 NOT_READY)."""
    prof = db.get(BuddyProfile, profile_id)
    if not prof:
        raise api_error(404, "NOT_FOUND", "버디를 찾을 수 없습니다")
    scope_university(user, prof.university_id)
    if body.action not in ("approve", "suspend"):
        raise api_error(422, "VALIDATION", "action은 approve | suspend")
    if body.action == "approve" and (miss := missing_for_approval(db, prof)):
        raise api_error(409, "NOT_READY", "아직 승인할 수 없어요: " + ", ".join(miss))
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
    """AD-06 (운영자): 확정 항목을 대학·버디별로 집계. 수수료 10%는 숙박·활동비에만, 버디 지급 = 활동비×0.9 + 승인 식비.
    앨범(5,000)은 전액 플랫폼 수입이라 버디 행에 넣지 않는다.
    meal_refund_total = 여행자에게 돌려줄 남은 식사 보증금 합. 지급 처리는 목업(전부 pending)."""
    f, t = from_ or DEMO_FROM, to or DEMO_TO
    fee_rate = get_settings().platform_fee_rate
    agg: dict[tuple[str, int], SettlementRow] = {}
    meal_pending: set[int] = set()
    refund = 0
    for it in db.scalars(select(BookingItem).where(BookingItem.status.in_(OK), BookingItem.type.in_(("dorm", "buddy")))).all():
        if not it.date_from or not (f <= it.date_from <= t):
            continue
        if it.type == "dorm":
            room = db.get(DormRoom, it.ref_id)
            uni = db.get(University, room.university_id)
            key, name = ("university", uni.id), f"{uni.name} {room.building}"
        else:
            prof = db.get(BuddyProfile, it.ref_id)
            key, name = ("buddy", prof.id), f"버디 {db.get(User, prof.user_id).name}"
        row = agg.setdefault(key, SettlementRow(party_type=key[0], party_id=key[1], target=name, count=0, revenue=0, fee=0, payout=0, status="pending"))
        row.count += 1
        row.revenue += it.price - (it.meal_deposit or 0) - album_fee(it)
        if it.type == "buddy" and it.meal_deposit:
            used, approved = meal_sums(db, it.id)
            row.meals += approved
            refund += it.meal_deposit - approved
            if used > approved:
                meal_pending.add(key[1])
    for row in agg.values():
        row.fee = round(row.revenue * fee_rate)
        row.payout = row.revenue - row.fee + row.meals
        if row.party_type == "buddy" and row.party_id in meal_pending:
            row.status = "meal_pending"
    items = sorted(agg.values(), key=lambda r: -r.revenue)
    return SettlementsOut(period={"from": f.isoformat(), "to": t.isoformat()}, total=sum(r.revenue for r in items),
                          meal_refund_total=refund, items=items)


@router.get("/tours", response_model=ListResponse[AdminTourRow])
def admin_tours(user: User = Depends(ADMIN), db: Session = Depends(get_db)) -> ListResponse[AdminTourRow]:
    """AD-07: 무료 산책 코스 (장소·이야기 자료 준비 수·이 코스를 고른 버디 동행 수)"""
    rows = []
    for t in db.scalars(select(Tour).order_by(Tour.id)).all():
        places = db.scalars(select(Place).join(TourPlace, TourPlace.place_id == Place.id).where(TourPlace.tour_id == t.id).order_by(TourPlace.seq)).all()
        walks = db.scalar(select(func.count()).select_from(BookingItem).where(BookingItem.type == "buddy", BookingItem.course_id == t.id, BookingItem.status != "cancelled")) or 0
        rows.append(AdminTourRow(id=t.id, title=t.title, theme=t.theme, duration_min=t.duration_min, places=[p.name for p in places],
                                 place_count=len(places), story_ready=sum(1 for p in places if p.story_doc), buddy_walks=walks))
    return ListResponse(items=rows)


# ---------- 식비 심사 (운영자)
@router.get("/meal-claims", response_model=ListResponse[AdminMealClaimOut])
def admin_meal_claims(status: str | None = None, user: User = Depends(OPERATOR), db: Session = Depends(get_db)) -> ListResponse[AdminMealClaimOut]:
    """버디가 올린 식비 영수증 목록. status = requested | approved | rejected"""
    q = select(MealClaim).order_by(MealClaim.status != "requested", MealClaim.id.desc())
    if status:
        q = q.where(MealClaim.status == status)
    return ListResponse(items=[meals.admin_claim_out(db, c) for c in db.scalars(q).all()])


@router.patch("/meal-claims/{claim_id}", response_model=AdminMealClaimOut)
def decide_meal_claim(claim_id: int, body: MealDecideIn, user: User = Depends(OPERATOR), db: Session = Depends(get_db)) -> AdminMealClaimOut:
    """승인한 금액만 버디에게 정산하고, 남은 보증금은 여행자에게 환불된다. 승인 합은 보증금을 넘을 수 없다."""
    c = db.get(MealClaim, claim_id)
    if not c:
        raise api_error(404, "NOT_FOUND", "식비 청구를 찾을 수 없습니다")
    if body.action not in ("approve", "reject"):
        raise api_error(422, "VALIDATION", "action은 approve | reject")
    if c.status != "requested":
        raise api_error(409, "CONFLICT", "이미 처리한 청구입니다")
    if body.action == "approve":
        it = db.get(BookingItem, c.booking_item_id)
        _, approved = meal_sums(db, it.id)
        if approved + c.amount > (it.meal_deposit or 0):
            raise api_error(409, "OVER_DEPOSIT", f"승인 합이 보증금(₩{it.meal_deposit or 0:,})을 넘어요")
    c.status = "approved" if body.action == "approve" else "rejected"
    c.reason, c.decided_by, c.decided_at = body.reason, user.id, datetime.now(UTC)
    db.commit()
    return meals.admin_claim_out(db, c)


# ---------- 신고 처리 (운영자)
@router.get("/reports", response_model=ListResponse[AdminReportRow])
def admin_reports(status: str | None = None, user: User = Depends(OPERATOR), db: Session = Depends(get_db)) -> ListResponse[AdminReportRow]:
    """신고 목록. status = open | resolved | dismissed"""
    q = select(Report).order_by(Report.status != "open", Report.id.desc())
    if status:
        q = q.where(Report.status == status)
    return ListResponse(items=[reports.row(db, r) for r in db.scalars(q).all()])


@router.patch("/reports/{report_id}", response_model=AdminReportRow)
def decide_report(report_id: int, body: ReportActionIn, user: User = Depends(OPERATOR), db: Session = Depends(get_db)) -> AdminReportRow:
    """warn(경고) · suspend(정지) · unsuspend(정지 풀기) · dismiss(기각). 신고는 resolved(기각이면 dismissed)."""
    r = db.get(Report, report_id)
    if not r:
        raise api_error(404, "NOT_FOUND", "신고를 찾을 수 없습니다")
    if body.action not in ("warn", "suspend", "unsuspend", "dismiss"):
        raise api_error(422, "VALIDATION", "action은 warn | suspend | unsuspend | dismiss")
    prof = db.get(BuddyProfile, r.buddy_id)
    if body.action == "suspend":
        prof.status = "suspended"
    elif body.action == "unsuspend" and prof.status == "suspended":
        prof.status = "approved"
    r.status = "dismissed" if body.action == "dismiss" else "resolved"
    r.action, r.resolved_at = body.action, datetime.now(UTC)
    db.commit()
    return reports.row(db, r)


# ---------- AD-08 외국인 숙박신고 내보내기 (운영자) — 운영 단계 기능이지만 CSV는 바로 만들 수 있어 포함
import csv
import io

from fastapi.responses import StreamingResponse


@router.get("/export/foreign-guests")
def export_foreign_guests(from_: date | None = None, to: date | None = None, user: User = Depends(OPERATOR), db: Session = Depends(get_db)) -> StreamingResponse:
    f, t = from_ or DEMO_FROM, to or DEMO_TO
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["booking_code", "name", "nationality", "passport_no", "check_in", "check_out", "university", "building"])
    for it in db.scalars(select(BookingItem).where(BookingItem.type == "dorm", BookingItem.status.in_(OK)).order_by(BookingItem.date_from)).all():
        if not (f <= it.date_from <= t):
            continue
        b = db.get(Booking, it.booking_id)
        trav = b.traveler or {}
        if (trav.get("nationality") or "KR").upper() in ("KR", "한국", "KOREA"):
            continue
        room = db.get(DormRoom, it.ref_id)
        uni = db.get(University, room.university_id)
        w.writerow([b.code, trav.get("name", ""), trav.get("nationality", ""), trav.get("passport_no", ""), it.date_from, it.date_to, uni.name, room.building])
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=foreign-guests.csv"})
