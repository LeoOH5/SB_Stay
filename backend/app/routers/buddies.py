"""BD-01~02 버디 목록·상세 (A 담당) — 경로·응답 형식은 docs/api-detail/BD-*.md 기준.

공개 조회라 로그인 없이 호출된다. 승인(approved)된 버디만 보여 주고(신고 누적으로 정지되면 자동으로 빠짐),
연락처 등 개인정보는 내보내지 않는다. 버디 본인용 API(BD-03~07)는 B 담당 buddy_me.py에 있다.
"""
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import rules
from app.core.config import get_settings
from app.core.db import get_db
from app.core.errors import api_error
from app.models import BookingItem, BuddyActivity, BuddyAvailability, BuddyProfile, University, User
from app.schemas.buddies import ActivityPublic, BuddyDetailOut, BuddyOut, BuddyVerified
from app.schemas.common import ListResponse
from app.schemas.tours import ReviewListOut
from app.services.reviews import average, item_reviews, sub_score_average, top_tags

router = APIRouter(prefix="/buddies", tags=["buddies"])


def _dates(db: Session, buddy_id: int) -> list[date]:
    return list(db.scalars(
        select(BuddyAvailability.date).where(BuddyAvailability.buddy_id == buddy_id).order_by(BuddyAvailability.date)
    ).all())


def walk_count(db: Session, buddy_id: int) -> int:
    """끝난 동행 수 (확정 + 날짜가 오늘 이전)"""
    return db.scalar(select(func.count()).select_from(BookingItem).where(
        BookingItem.type == "buddy", BookingItem.ref_id == buddy_id, BookingItem.status == "confirmed",
        BookingItem.date_from <= get_settings().today())) or 0


def verified(b: BuddyProfile) -> BuddyVerified:
    return BuddyVerified(school_email=b.school_email_verified_at is not None,
                         trained=b.code_agreed_at is not None and (b.quiz_score or 0) >= rules.QUIZ_PASS)


def activities(db: Session, buddy_id: int, limit: int) -> list[ActivityPublic]:
    rows = db.scalars(select(BuddyActivity).where(BuddyActivity.buddy_id == buddy_id)
                      .order_by(BuddyActivity.date.desc(), BuddyActivity.id.desc()).limit(limit)).all()
    return [ActivityPublic(date=a.date, places=a.places or [], foods=a.foods) for a in rows]


def to_out(db: Session, b: BuddyProfile, detail: bool = False) -> BuddyOut | BuddyDetailOut:
    user = db.get(User, b.user_id)
    uni = db.get(University, b.university_id)
    reviews, _ = item_reviews(db, "buddy", b.id)
    out = BuddyOut(
        id=b.id, name=user.name if user else "", university=uni.name if uni else "", university_id=b.university_id,
        major=b.major, year=b.year, languages=b.languages or [], interests=b.interests or [], intro=b.intro, avatar=b.avatar,
        hourly_fee=b.hourly_fee, available_dates=_dates(db, b.id), rating=average(reviews) or 0, review_count=len(reviews),
        personality=b.personality or [], style=b.style or [], can_help=b.can_help or [], can_drive=bool(b.can_drive),
        sub_scores=sub_score_average(reviews), tags_top=top_tags(reviews), walk_count=walk_count(db, b.id), verified=verified(b),
    )
    if not detail:
        return out
    return BuddyDetailOut(**out.model_dump(), reviews=reviews[:3], recent_activities=activities(db, b.id, 3))


def _approved(db: Session, buddy_id: int) -> BuddyProfile:
    b = db.get(BuddyProfile, buddy_id)
    if not b or b.status != "approved":
        raise api_error(404, "NOT_FOUND", "버디를 찾을 수 없습니다")
    return b


@router.get("", response_model=ListResponse[BuddyOut])
def list_buddies(
    language: str | None = None, date: date | None = None, interest: str | None = None, major: str | None = None,
    personality: str | None = None, style: str | None = None, can_help: str | None = None, university_id: int | None = None,
    cursor: str | None = None, db: Session = Depends(get_db),
) -> ListResponse[BuddyOut]:
    """BD-01: 승인된 버디만. 언어·가능 날짜·관심사·전공·성향·스타일·도움·대학으로 거른다. cursor는 받기만 한다."""
    q = select(BuddyProfile).where(BuddyProfile.status == "approved").order_by(BuddyProfile.id)
    if date:
        q = q.where(BuddyProfile.id.in_(select(BuddyAvailability.buddy_id).where(BuddyAvailability.date == date)))
    if major:
        q = q.where(BuddyProfile.major.contains(major))
    if university_id:
        q = q.where(BuddyProfile.university_id == university_id)
    items = []
    for b in db.scalars(q).all():
        wants = [(language, b.languages), (interest, b.interests), (personality, b.personality), (style, b.style),
                 (can_help, b.can_help)]
        if any(v and v not in (have or []) for v, have in wants):
            continue
        items.append(to_out(db, b))
    return ListResponse(items=items)


@router.get("/{buddy_id}", response_model=BuddyDetailOut)
def get_buddy(buddy_id: int, db: Session = Depends(get_db)) -> BuddyDetailOut:
    """BD-02: 상세 + 리뷰 샘플(최대 3개) + 최근 활동 3개. 승인 전·정지된 버디는 404."""
    return to_out(db, _approved(db, buddy_id), detail=True)


@router.get("/{buddy_id}/reviews", response_model=ReviewListOut)
def buddy_reviews(buddy_id: int, cursor: str | None = None, db: Session = Depends(get_db)) -> ReviewListOut:
    """버디 리뷰 목록. 실제 리뷰가 없으면 고정 샘플."""
    _approved(db, buddy_id)
    items, _ = item_reviews(db, "buddy", buddy_id)
    return ReviewListOut(items=items, average_rating=average(items))


@router.get("/{buddy_id}/activities", response_model=ListResponse[ActivityPublic])
def buddy_activities(buddy_id: int, db: Session = Depends(get_db)) -> ListResponse[ActivityPublic]:
    """공개 활동 기록 최대 10개 (날짜·장소·먹은 것만, 여행자 정보 없음)"""
    _approved(db, buddy_id)
    return ListResponse(items=activities(db, buddy_id, 10))
