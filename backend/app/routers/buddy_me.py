"""버디 본인용 — BD-03 프로필 · BD-04 가능 일정 · BD-05 요청함 · BD-06 확정 일정 · BD-07 활동 내역 (B 담당)

v3: 버디(role=buddy)만. 식비 청구 · 활동 기록 · 월 정산 · 지원 5단계(학교 메일 → 인증번호 → 약속 동의 → 퀴즈 → 승인 대기).
v3.2: 등급·정산율(/buddy/grade), 휴면 복귀(/buddy/confirm-active). 정산은 항목마다 확정 때 고정한 정산율.
v3.7: 등급은 매달 1일 지난달 동행으로. 지원 1단계 자격 두 경로(성북구 대학 메일 / 성북구 거주), 퀴즈 전 사전 교육 영상.
"""
from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core import rules
from app.core.config import get_settings
from app.core.db import get_db
from app.core.deps import require_role
from app.core.errors import api_error
from app.models.booking import Booking, BookingItem, MealClaim
from app.models.supply import BuddyActivity, BuddyAvailability, BuddyProfile, Tour, University
from app.models.user import User
from app.routers.buddies import verified, walk_count
from app.schemas.buddy import (
    ActivityIn,
    ActivityOut,
    ApplyEmailIn,
    ApplyResidenceIn,
    ApplyStatusOut,
    ApplyVerifyIn,
    AvailabilityIn,
    AvailabilityOut,
    BuddyProfileIn,
    BuddyProfileOut,
    BuddyRequestOut,
    BuddySettlementOut,
    EarningItem,
    EarningsOut,
    EducationOut,
    EducationVideo,
    GradeNeed,
    GradeNext,
    GradeOut,
    GradeStats,
    MealClaimIn,
    MealClaimOut,
    QuizAnswersIn,
    QuizOut,
    QuizQuestion,
    QuizResultOut,
    SettlementItem,
    TouristSummary,
)
from app.schemas.common import ListResponse
from app.services import buddy_quiz, eligibility, grades, meals, storage
from app.services.booking_state import album_fee, describe
from app.services.reviews import average, item_reviews

router = APIRouter(prefix="/buddy", tags=["buddy"])
SUPPLIER = require_role("buddy")
MONTH = "2027-01"  # 데모 기간
CODE_SETS = {"personality": rules.PERSONALITY, "style": rules.STYLE, "can_help": rules.CAN_HELP}


def _profile(db: Session, user: User) -> BuddyProfile:
    prof = db.scalar(select(BuddyProfile).where(BuddyProfile.user_id == user.id))
    if not prof:
        raise api_error(404, "NOT_FOUND", "버디 프로필이 없습니다. 먼저 등록하세요")
    return prof


def _my_items(db: Session, user: User, statuses: list[str] | None = None) -> list[BookingItem]:
    prof = db.scalar(select(BuddyProfile).where(BuddyProfile.user_id == user.id))
    q = select(BookingItem).where(BookingItem.type == "buddy", BookingItem.ref_id == (prof.id if prof else -1))
    if statuses:
        q = q.where(BookingItem.status.in_(statuses))
    return db.scalars(q.order_by(BookingItem.date_from, BookingItem.time)).all()


def _my_item(db: Session, user: User, item_id: int) -> BookingItem:
    prof = _profile(db, user)
    it = db.get(BookingItem, item_id)
    if not it or it.type != "buddy":
        raise api_error(404, "NOT_FOUND", "예약 항목을 찾을 수 없습니다")
    if it.ref_id != prof.id:
        raise api_error(403, "FORBIDDEN", "본인에게 온 항목이 아닙니다")
    return it


def _req_out(db: Session, it: BookingItem) -> BuddyRequestOut:
    """버디에게 보이는 여행자 정보는 이름·국적(+대화 언어)만. 본인 항목이라 요청은 보인다."""
    booking = db.get(Booking, it.booking_id)
    tourist = db.get(User, booking.tourist_id)
    trav = booking.traveler or {}
    title, _ = describe(db, it)
    course = db.get(Tour, it.course_id) if it.course_id else None
    return BuddyRequestOut(
        item_id=it.id, id=it.id, booking_id=booking.id, booking_code=booking.code, type=it.type,
        tourist=TouristSummary(id=tourist.id, name=trav.get("name") or tourist.name, nationality=trav.get("nationality"), language=tourist.language),
        date=it.date_from.isoformat(), time=it.time, duration_min=it.duration_min, price=it.price,
        interests=trav.get("interests") or [], status=it.status, reject_reason=it.reject_reason,
        google_event_id=it.google_event_id, meeting_point=course.meeting_point if course else None, title=title,
        request=it.request, course_id=it.course_id, course_title=course.title if course else None,
        meal_count=it.meal_count or 0, album=bool(it.album),
    )


# ---------- BD-03 프로필
def _profile_out(db: Session, user: User, prof: BuddyProfile) -> BuddyProfileOut:
    dates = db.scalars(select(BuddyAvailability.date).where(BuddyAvailability.buddy_id == prof.id).order_by(BuddyAvailability.date)).all()
    reviews, _ = item_reviews(db, "buddy", prof.id)
    return BuddyProfileOut(
        id=prof.id, user_id=user.id, name=user.name, university=eligibility.university_name(db, prof), university_id=prof.university_id,
        major=prof.major, year=prof.year, languages=prof.languages or [], interests=prof.interests or [], intro=prof.intro,
        avatar=prof.avatar, status=prof.status, hourly_fee=prof.hourly_fee, available_dates=[d.isoformat() for d in dates],
        school_email=prof.school_email, school_email_verified=prof.school_email_verified_at is not None,
        code_agreed=prof.code_agreed_at is not None, quiz_score=prof.quiz_score,
        rating=average(reviews) or 0, review_count=len(reviews),
        personality=prof.personality or [], style=prof.style or [], can_help=prof.can_help or [], bank_account=prof.bank_account,
        can_drive=bool(prof.can_drive), walk_count=walk_count(db, prof.id), verified=verified(prof),
    )


@router.get("/profile", response_model=BuddyProfileOut)
def get_profile(user: User = Depends(SUPPLIER), db: Session = Depends(get_db)) -> BuddyProfileOut:
    """BD-03 조회"""
    return _profile_out(db, user, _profile(db, user))


@router.put("/profile", response_model=BuddyProfileOut)
def upsert_profile(body: BuddyProfileIn, user: User = Depends(SUPPLIER), db: Session = Depends(get_db)) -> BuddyProfileOut:
    """BD-03 등록·수정. 처음 만들면 status=pending(운영팀 승인 전). 성향·스타일·도움은 코드값만."""
    data = body.model_dump(exclude_unset=True)
    for k, allowed in CODE_SETS.items():
        if data.get(k) is not None and any(v not in allowed for v in data[k]):
            raise api_error(422, "VALIDATION", f"{k}는 {', '.join(allowed)} 중에서")
    prof = db.scalar(select(BuddyProfile).where(BuddyProfile.user_id == user.id))
    if not prof:
        if not user.university_id:
            raise api_error(422, "VALIDATION", "자격 확인을 먼저 해 주세요 (학교 메일 인증 또는 성북구 거주 확인)")
        prof = BuddyProfile(user_id=user.id, university_id=user.university_id, status="pending", hourly_fee=15000)
        db.add(prof)
    for k, v in data.items():
        setattr(prof, k, v)
    db.commit()
    db.refresh(prof)
    return _profile_out(db, user, prof)


# ---------- BD-04 가능 일정
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
    prof.active_on = get_settings().today()  # 휴면 계산용 활동
    db.commit()
    return AvailabilityOut(dates=[d.isoformat() for d in sorted(set(body.dates))])


# ---------- BD-05·06 요청함·일정
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


# ---------- BD-07 활동 내역·정산
@router.get("/earnings", response_model=EarningsOut)
def earnings(month: str = MONTH, user: User = Depends(SUPPLIER), db: Session = Depends(get_db)) -> EarningsOut:
    """BD-07: 활동 내역 (금액은 (활동비 + 앨범) × 정산율인 버디 몫 net, 식사 보증금 제외). 지난달 이전 확정분은 paid, 이번 달은 pending (목업)"""
    rows: list[EarningItem] = []
    for it in _my_items(db, user, ["approved", "confirmed"]):
        booking = db.get(Booking, it.booking_id)
        trav = booking.traveler or {}
        title, _ = describe(db, it)
        status = "paid" if it.date_from.isoformat()[:7] < month else "pending"
        rows.append(EarningItem(booking_item_id=it.id, date=it.date_from.isoformat(), tourist=f"{trav.get('name', '')} · {trav.get('nationality', '')}",
                                activity=title, amount=meals.gross_fee_net(db, it)[2], status=status))
    rows.sort(key=lambda r: r.date, reverse=True)
    this_month = [r for r in rows if r.date[:7] == month]
    paid = sum(r.amount for r in rows if r.status == "paid")
    pending = sum(r.amount for r in rows if r.status == "pending")
    return EarningsOut(month=month, period=month, activities=len(this_month), total_fee=sum(r.amount for r in this_month), paid=paid, pending=pending, items=rows)


@router.get("/settlement", response_model=BuddySettlementOut)
def settlement(month: str = MONTH, user: User = Depends(SUPPLIER), db: Session = Depends(get_db)) -> BuddySettlementOut:
    """월 정산: 확정 동행의 (활동비 + 앨범) × 항목별 고정 정산율 + 승인된 식비. 다음 달 말일 지급.
    v3.6: 앨범(사진 기록)도 버디 몫이 있다. 식사 보증금은 통과 금액."""
    if not meals.MONTH_RE.match(month):
        raise api_error(422, "VALIDATION", "month는 YYYY-MM")
    prof = _profile(db, user)
    start, end = meals.month_range(month)
    rows: list[SettlementItem] = []
    for it in _my_items(db, user, ["confirmed"]):
        if not start <= it.date_from <= end:
            continue
        gross, fee, net, rate = meals.gross_fee_net(db, it)
        claims = meals.claims_for_item(db, it.id)
        approved = sum(c.amount for c in claims if c.status == "approved")
        pending = sum(c.amount for c in claims if c.status == "requested")
        rows.append(SettlementItem(item_id=it.id, date=it.date_from.isoformat(), tourist=meals.traveler_name(db, db.get(Booking, it.booking_id)),
                                   gross=gross, album=album_fee(it), payout_rate=float(rate), fee=fee, meal_approved=approved, meal_pending=pending, net=net,
                                   status="meal_pending" if pending else "confirmed"))
    net_sum, meals_ok = sum(r.net for r in rows), sum(r.meal_approved for r in rows)
    return BuddySettlementOut(
        month=month, pay_date=meals.pay_date(month).isoformat(), account=meals.mask_account(prof.bank_account),
        grade=prof.grade, payout_rate=float(prof.payout_rate), walks=len(rows),
        gross=sum(r.gross for r in rows), album=sum(r.album for r in rows), fee=sum(r.fee for r in rows), net=net_sum, meals_approved=meals_ok,
        meals_pending=sum(r.meal_pending for r in rows), payout=net_sum + meals_ok, items=rows,
    )


# ---------- 등급·정산율·휴면 (v3.2, v3.7 매달 평가)
def _need(g) -> GradeNeed:
    return GradeNeed(walks=g.walks, reviews=g.reviews, rating=float(g.rating))


def grade_out(db: Session, prof: BuddyProfile) -> GradeOut:
    """저장된 등급(매달 1일 평가) + 지난달·이번 달 동행, 누적 후기·평점, 한 단계 위·지금 등급 유지 기준"""
    today = get_settings().today()
    st = grades.stats_now(db, prof, today)
    nxt = grades.next_grade(prof.grade)
    cur = rules.GRADE_BY_CODE.get(prof.grade)
    return GradeOut(
        grade=prof.grade, payout_rate=float(prof.payout_rate),
        evaluated_for=prof.grade_evaluated_for.strftime("%Y-%m") if prof.grade_evaluated_for else None,
        next_eval_on=grades.next_month(today),
        stats=GradeStats(month=st["month"].strftime("%Y-%m"), last_month_walks=st["last_month_walks"],
                         this_month_walks=st["this_month_walks"], reviews=st["reviews"], rating=st["rating"]),
        next=GradeNext(grade=nxt.code, payout_rate=float(nxt.rate), need=_need(nxt)) if nxt else None,
        keep=_need(cur) if cur and cur.code != "basic" else None,
        first_month=grades.first_month(prof, grades.month_start(today)), note=rules.GRADE_NOTE,
        needs_recheck=prof.needs_recheck, dormant_since=prof.dormant_since, updated_at=prof.grade_updated_at,
    )


@router.get("/grade", response_model=GradeOut)
def my_grade(user: User = Depends(SUPPLIER), db: Session = Depends(get_db)) -> GradeOut:
    """내 등급·정산율, 지난달 동행(평가 기준)·이번 달 동행·누적 후기·평점, 다음 등급 기준. 매달 1일 다시 정한다"""
    return grade_out(db, _profile(db, user))


@router.post("/confirm-active", response_model=GradeOut)
def confirm_active(user: User = Depends(SUPPLIER), db: Session = Depends(get_db)) -> GradeOut:
    """휴면 복귀 '계속 활동할게요': 요청 받기를 다시 켠다. 등급은 휴면과 상관없이 매달 1일 평가"""
    prof = _profile(db, user)
    grades.confirm_active(prof, get_settings().today())
    db.commit()
    return grade_out(db, prof)


# ---------- 식비 청구
@router.post("/meal-claims", response_model=MealClaimOut, status_code=201)
def create_meal_claim(body: MealClaimIn, user: User = Depends(SUPPLIER), db: Session = Depends(get_db)) -> MealClaimOut:
    """식비 청구: 본인 확정 항목, meal_count > 0, 청구 수(반려 제외) < meal_count. 한도 초과도 접수(운영자가 확인)."""
    it = _my_item(db, user, body.item_id)
    if it.status != "confirmed":
        raise api_error(409, "CONFLICT", "확정된 동행만 식비를 청구할 수 있어요")
    live = [c for c in meals.claims_for_item(db, it.id) if c.status != "rejected"]
    if not it.meal_count or len(live) >= it.meal_count:
        raise api_error(409, "MEAL_LIMIT", f"이 동행의 식사 횟수({it.meal_count or 0}회)만큼 이미 청구했어요")
    if body.receipt_url:
        _check_photos([body.receipt_url])
    c = MealClaim(booking_item_id=it.id, buddy_id=it.ref_id, date=it.date_from, place=body.place, items=body.items,
                  amount=body.amount, receipt_url=body.receipt_url, status="requested")
    db.add(c)
    db.commit()
    db.refresh(c)
    return meals.claim_out(db, c)


@router.get("/meal-claims", response_model=ListResponse[MealClaimOut])
def my_meal_claims(user: User = Depends(SUPPLIER), db: Session = Depends(get_db)) -> ListResponse[MealClaimOut]:
    prof = _profile(db, user)
    rows = db.scalars(select(MealClaim).where(MealClaim.buddy_id == prof.id).order_by(MealClaim.id.desc())).all()
    return ListResponse(items=[meals.claim_out(db, c) for c in rows])


# ---------- 활동 기록
def _check_photos(urls: list[str]) -> None:
    """v3.6: 새로 받는 사진은 POST /uploads가 돌려준 /media 주소만 (외부 URL·파일 이름 거절)"""
    if any(not storage.is_media_url(u) for u in urls):
        raise api_error(422, "PHOTO_URL", "사진은 앱에서 올린 것만 쓸 수 있어요 (POST /uploads)")


def _activity_out(db: Session, a: BuddyActivity) -> ActivityOut:
    it = db.get(BookingItem, a.booking_item_id) if a.booking_item_id else None
    b = db.get(Booking, it.booking_id) if it else None
    return ActivityOut(id=a.id, item_id=a.booking_item_id, booking_code=b.code if b else None,
                       tourist=meals.traveler_name(db, b) if b else None, date=a.date, places=a.places or [],
                       foods=a.foods, note=a.note, photos=a.photos or [], created_at=a.created_at)


@router.post("/activities", response_model=ActivityOut, status_code=201)
def create_activity(body: ActivityIn, user: User = Depends(SUPPLIER), db: Session = Depends(get_db)) -> ActivityOut:
    """활동 기록: 간 곳·먹은 것·메모·사진. 앨범 옵션 동행이면 사진이 여행자 앨범에 보인다."""
    prof = _profile(db, user)
    if body.item_id is not None:
        _my_item(db, user, body.item_id)
    _check_photos(body.photos)
    a = BuddyActivity(buddy_id=prof.id, booking_item_id=body.item_id, date=body.date, places=body.places, foods=body.foods,
                      note=body.note, photos=body.photos)
    db.add(a)
    db.commit()
    db.refresh(a)
    return _activity_out(db, a)


@router.get("/activities", response_model=ListResponse[ActivityOut])
def my_activities(user: User = Depends(SUPPLIER), db: Session = Depends(get_db)) -> ListResponse[ActivityOut]:
    prof = _profile(db, user)
    rows = db.scalars(select(BuddyActivity).where(BuddyActivity.buddy_id == prof.id)
                      .order_by(BuddyActivity.date.desc(), BuddyActivity.id.desc())).all()
    return ListResponse(items=[_activity_out(db, a) for a in rows])


# ---------- 지원 6단계 (v3.7: 자격 → 약속 → 교육 영상 → 퀴즈 → 프로필 → 승인)
def _university_for(db: Session, email: str) -> University:
    domain = email.rsplit("@", 1)[-1].strip().lower() if "@" in email else ""
    for uni in db.scalars(select(University).order_by(University.id)).all():
        if domain and domain in [d.lower() for d in uni.email_domains or []]:
            return uni
    raise api_error(422, "NOT_SEONGBUK_SCHOOL", "성북구 대학 메일이 아니에요")


def _need_profile(db: Session, user: User) -> BuddyProfile:
    prof = db.scalar(select(BuddyProfile).where(BuddyProfile.user_id == user.id))
    if not eligibility.eligible(prof):
        raise api_error(409, "CONFLICT", "자격 확인(학교 메일 인증 또는 성북구 거주 확인)을 먼저 해 주세요")
    return prof


def _check_person(body) -> None:
    """국적·나이 (두 경로 공통)"""
    if not body.korean_national:
        raise api_error(422, "NOT_KOREAN_NATIONAL", "한국 국적 학생만 버디로 활동할 수 있어요")
    if rules.age_on(body.birth_date, get_settings().today()) < rules.BUDDY_MIN_AGE:
        raise api_error(422, "TOO_YOUNG", f"만 {rules.BUDDY_MIN_AGE}세 이상만 버디로 활동할 수 있어요")


def _new_profile(db: Session, user: User, university_id: int | None) -> BuddyProfile:
    prof = db.scalar(select(BuddyProfile).where(BuddyProfile.user_id == user.id))
    if not prof:
        prof = BuddyProfile(user_id=user.id, university_id=university_id, status="pending", hourly_fee=15000)
        db.add(prof)
    return prof


@router.get("/apply", response_model=ApplyStatusOut)
def apply_status(user: User = Depends(SUPPLIER), db: Session = Depends(get_db)) -> ApplyStatusOut:
    """지원 진행 상황"""
    prof = db.scalar(select(BuddyProfile).where(BuddyProfile.user_id == user.id))
    uni = db.get(University, user.university_id) if not prof and user.university_id else None
    seen = eligibility.watched(prof)
    return ApplyStatusOut(
        email_verified=bool(prof and prof.school_email_verified_at), school_email=prof.school_email if prof else None,
        university=eligibility.university_name(db, prof) if prof else (uni.name if uni else None), age_ok=eligibility.age_ok(user),
        code_agreed=bool(prof and prof.code_agreed_at),
        quiz_score=prof.quiz_score if prof else None, quiz_passed=bool(prof and (prof.quiz_score or 0) >= rules.QUIZ_PASS),
        profile_done=bool(prof and prof.major and prof.intro and prof.languages),
        korean_national=bool(prof and prof.korean_national_confirmed_at), status=prof.status if prof else "none",
        eligibility=prof.eligibility if prof else None, eligible=eligibility.eligible(prof),
        school_name=prof.school_name if prof else None,
        residence_proof_url=prof.residence_proof_url if prof else None, enrollment_proof_url=prof.enrollment_proof_url if prof else None,
        videos_watched=seen, videos_total=len(rules.EDUCATION_IDS), education_done=eligibility.education_done(prof),
    )


@router.post("/apply/email")
def apply_email(body: ApplyEmailIn, user: User = Depends(SUPPLIER), db: Session = Depends(get_db)) -> dict:
    """1단계(대학 메일 경로): 학교 메일 도메인 확인 후 인증번호 발송 (데모는 발송 없이 고정값)"""
    uni = _university_for(db, body.email)
    s = get_settings()
    return {"sent": True, "university": uni.name, "dev_code": s.buddy_otp_code if s.debug else None}


@router.post("/apply/verify", response_model=ApplyStatusOut)
def apply_verify(body: ApplyVerifyIn, user: User = Depends(SUPPLIER), db: Session = Depends(get_db)) -> ApplyStatusOut:
    """1단계(대학 메일 경로): 인증번호 + 생년월일(만 19세 이상) + 한국 국적 확인. 대학·생년월일 저장, 프로필이 없으면 pending으로 만든다.
    외국인 유학생은 시간제 취업 허가 문제로 버디(유급 활동)를 할 수 없다."""
    uni = _university_for(db, body.email)
    if body.code.strip() != get_settings().buddy_otp_code:
        raise api_error(422, "BAD_CODE", "인증번호가 맞지 않아요")
    _check_person(body)
    user.university_id, user.birth_date = uni.id, body.birth_date
    prof = _new_profile(db, user, uni.id)
    prof.university_id, prof.eligibility, prof.school_name = uni.id, "school_email", None
    prof.school_email, prof.school_email_verified_at = body.email.strip().lower(), datetime.now(UTC)
    prof.korean_national_confirmed_at = prof.korean_national_confirmed_at or datetime.now(UTC)
    db.commit()
    return apply_status(user, db)


@router.post("/apply/residence", response_model=ApplyStatusOut)
def apply_residence(body: ApplyResidenceIn, user: User = Depends(SUPPLIER), db: Session = Depends(get_db)) -> ApplyStatusOut:
    """1단계(성북구 거주 경로): 어느 대학이든 성북구에 사는 대학생. 주소 증빙 + 재학 증명 사진(POST /uploads의 /media 주소)을 낸다.
    운영자가 승인(AD-04) 때 두 사진을 보고 확인한다. 학교 이름이 성북구 대학과 같으면 그 대학으로(같은 학교 숙소 우선 매칭)."""
    _check_photos([body.residence_proof_url, body.enrollment_proof_url])
    _check_person(body)
    name = body.school_name.strip()
    uni = db.scalar(select(University).where(University.name == name))
    user.birth_date = body.birth_date
    if uni:
        user.university_id = uni.id
    prof = _new_profile(db, user, uni.id if uni else None)
    if prof.school_email_verified_at and prof.eligibility == "school_email":
        raise api_error(409, "CONFLICT", "이미 학교 메일로 자격을 확인했어요")
    prof.university_id, prof.eligibility, prof.school_name = (uni.id if uni else None), "residence", name
    prof.residence_proof_url, prof.enrollment_proof_url = body.residence_proof_url, body.enrollment_proof_url
    prof.residence_submitted_at = datetime.now(UTC)
    prof.korean_national_confirmed_at = prof.korean_national_confirmed_at or datetime.now(UTC)
    db.commit()
    return apply_status(user, db)


@router.post("/apply/agree", response_model=ApplyStatusOut)
def apply_agree(user: User = Depends(SUPPLIER), db: Session = Depends(get_db)) -> ApplyStatusOut:
    """2단계: 버디 약속 동의"""
    prof = _need_profile(db, user)
    prof.code_agreed_at = prof.code_agreed_at or datetime.now(UTC)
    db.commit()
    return apply_status(user, db)


def _education_out(prof: BuddyProfile | None) -> EducationOut:
    seen = set(eligibility.watched(prof))
    videos = [EducationVideo(id=i, title=t, topics=topics, duration_sec=sec, watched=i in seen) for i, t, topics, sec in rules.EDUCATION_VIDEOS]
    return EducationOut(videos=videos, watched=len(seen), total=len(videos), done=len(seen) == len(videos))


@router.get("/apply/education", response_model=EducationOut)
def apply_education(user: User = Depends(SUPPLIER), db: Session = Depends(get_db)) -> EducationOut:
    """3단계: 사전 교육 영상 5개 (성북구 한눈에 · 길 안내와 교통 · 안전과 응급 · 역사 기본 상식 · 버디 약속). 데모는 영상 파일 없음"""
    return _education_out(db.scalar(select(BuddyProfile).where(BuddyProfile.user_id == user.id)))


@router.post("/apply/education/{video_id}", response_model=EducationOut)
def watch_video(video_id: str, user: User = Depends(SUPPLIER), db: Session = Depends(get_db)) -> EducationOut:
    """'다 봤어요': 본 영상으로 표시. 다 보면 퀴즈가 열린다"""
    if video_id not in rules.EDUCATION_IDS:
        raise api_error(404, "NOT_FOUND", "없는 교육 영상이에요")
    prof = _need_profile(db, user)
    seen = set(prof.education_watched or []) | {video_id}
    prof.education_watched = [v for v in rules.EDUCATION_IDS if v in seen]
    db.commit()
    return _education_out(prof)


def _need_education(db: Session, user: User) -> BuddyProfile:
    prof = _need_profile(db, user)
    if not eligibility.education_done(prof):
        raise api_error(409, "EDUCATION_NOT_DONE", "교육 영상을 모두 본 뒤에 퀴즈를 풀 수 있어요")
    return prof


@router.get("/apply/quiz", response_model=QuizOut)
def apply_quiz(user: User = Depends(SUPPLIER), db: Session = Depends(get_db)) -> QuizOut:
    """4단계: 교육 퀴즈 10문제 (정답 미포함). 교육 영상을 다 봐야 열린다"""
    _need_education(db, user)
    return QuizOut(questions=[QuizQuestion(**q) for q in buddy_quiz.public(user.id)])


@router.post("/apply/quiz", response_model=QuizResultOut)
def submit_quiz(body: QuizAnswersIn, user: User = Depends(SUPPLIER), db: Session = Depends(get_db)) -> QuizResultOut:
    """채점: 낸 10문제 중 8개 이상 통과. 가장 높은 점수를 저장한다."""
    prof = _need_education(db, user)
    score = buddy_quiz.grade(body.answers, user.id)
    prof.quiz_score = max(prof.quiz_score or 0, score)
    db.commit()
    return QuizResultOut(score=score, total=rules.QUIZ_TOTAL, passed=score >= rules.QUIZ_PASS, best_score=prof.quiz_score)
