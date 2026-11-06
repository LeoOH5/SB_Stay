"""BD-01~02 버디 목록·상세 (A 담당) — 경로·응답 형식은 docs/api-detail/BD-*.md 기준.

공개 조회라 로그인 없이 호출된다. 승인(approved)된 버디만 보여 주고, 연락처 등 개인정보는 내보내지 않는다.
버디 본인용 API(BD-03~07)는 B 담당 buddy_me.py에 있다.
"""
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.errors import api_error
from app.models import BuddyAvailability, BuddyProfile, University, User
from app.schemas.buddies import BuddyDetailOut, BuddyOut
from app.schemas.common import ListResponse
from app.schemas.tours import ReviewListOut
from app.services.reviews import average, item_reviews

router = APIRouter(prefix="/buddies", tags=["buddies"])


def _dates(db: Session, buddy_id: int) -> list[date]:
    return list(db.scalars(
        select(BuddyAvailability.date).where(BuddyAvailability.buddy_id == buddy_id).order_by(BuddyAvailability.date)
    ).all())


def to_out(db: Session, b: BuddyProfile, detail: bool = False) -> BuddyOut | BuddyDetailOut:
    user = db.get(User, b.user_id)
    uni = db.get(University, b.university_id)
    reviews, _ = item_reviews(db, "buddy", b.id)
    out = BuddyOut(
        id=b.id, name=user.name if user else "", university=uni.name if uni else "", major=b.major, year=b.year,
        languages=b.languages or [], interests=b.interests or [], intro=b.intro, avatar=b.avatar,
        hourly_fee=b.hourly_fee, available_dates=_dates(db, b.id),
        rating=average(reviews) or 0, review_count=len(reviews),
    )
    return BuddyDetailOut(**out.model_dump(), reviews=reviews[:3]) if detail else out


def _approved(db: Session, buddy_id: int) -> BuddyProfile:
    b = db.get(BuddyProfile, buddy_id)
    if not b or b.status != "approved":
        raise api_error(404, "NOT_FOUND", "버디를 찾을 수 없습니다")
    return b


@router.get("", response_model=ListResponse[BuddyOut])
def list_buddies(
    language: str | None = None, date: date | None = None, interest: str | None = None,
    major: str | None = None, cursor: str | None = None, db: Session = Depends(get_db),
) -> ListResponse[BuddyOut]:
    """BD-01: 승인된 버디만. 언어·가능 날짜·관심사·전공으로 거른다. 인원이 적어 cursor는 받기만 한다."""
    q = select(BuddyProfile).where(BuddyProfile.status == "approved").order_by(BuddyProfile.id)
    if date:
        q = q.where(BuddyProfile.id.in_(select(BuddyAvailability.buddy_id).where(BuddyAvailability.date == date)))
    if major:
        q = q.where(BuddyProfile.major.contains(major))
    items = []
    for b in db.scalars(q).all():
        if language and language not in (b.languages or []):
            continue
        if interest and interest not in (b.interests or []):
            continue
        items.append(to_out(db, b))
    return ListResponse(items=items)


@router.get("/{buddy_id}", response_model=BuddyDetailOut)
def get_buddy(buddy_id: int, db: Session = Depends(get_db)) -> BuddyDetailOut:
    """BD-02: 상세 + 리뷰 샘플(최대 3개). 승인 전·정지된 버디는 404."""
    return to_out(db, _approved(db, buddy_id), detail=True)


@router.get("/{buddy_id}/reviews", response_model=ReviewListOut)
def buddy_reviews(buddy_id: int, cursor: str | None = None, db: Session = Depends(get_db)) -> ReviewListOut:
    """버디 리뷰 목록 (목업). 프론트 T4c가 호출한다. 실제 리뷰가 없으면 고정 샘플."""
    _approved(db, buddy_id)
    items, _ = item_reviews(db, "buddy", buddy_id)
    return ReviewListOut(items=items, average_rating=average(items))
