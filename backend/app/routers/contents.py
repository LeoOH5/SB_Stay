"""HM-01 추천 패키지 · CM-01 정적 콘텐츠 (A 담당) — 경로·응답 형식은 docs/api-detail/HM-01.md, CM-01.md 기준.

공개 조회. 가격은 DB 값 그대로이고, 콘텐츠는 시드(contents.json)에 넣어 둔 고정 글이다.
"""
from fastapi import APIRouter, Depends, Header
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.errors import api_error
from app.models import BuddyProfile, Content, DormRoom, Package, Tour, University, User
from app.schemas.common import ListResponse
from app.schemas.contents import ContentOut, PackageItem, PackageOut

router = APIRouter(tags=["contents"])

CONTENT_KEYS = {"terms", "refund", "support", "intro", "privacy"}


def _items(db: Session, p: Package) -> list[PackageItem]:
    items = []
    if p.dorm_room_id and (room := db.get(DormRoom, p.dorm_room_id)):
        uni = db.get(University, room.university_id)
        items.append(PackageItem(type="dorm", ref_id=room.id, title=f"{uni.name if uni else ''} {room.building}".strip()))
    if p.tour_id and (tour := db.get(Tour, p.tour_id)):
        items.append(PackageItem(type="course", ref_id=tour.id, title=tour.title))  # 무료 추천 코스 (예약 항목 아님)
    if p.buddy_profile_id and (buddy := db.get(BuddyProfile, p.buddy_profile_id)):
        user = db.get(User, buddy.user_id)
        items.append(PackageItem(type="buddy", ref_id=buddy.id, title=f"버디 {user.name if user else ''}와 캠퍼스·동네 걷기"))
    return items


@router.get("/packages", response_model=ListResponse[PackageOut])
def list_packages(cursor: str | None = None, db: Session = Depends(get_db)) -> ListResponse[PackageOut]:
    """HM-01: 홈 화면 추천 패키지. 활성 패키지만 sort_order 순으로. 개수가 적어 cursor는 받기만 한다."""
    rows = db.scalars(select(Package).where(Package.active.is_(True)).order_by(Package.sort_order, Package.id)).all()
    return ListResponse(items=[
        PackageOut(
            id=p.id, title=p.title, title_en=p.title_en, summary=p.description, price_from=p.total_price,
            days=p.nights + 1, items=_items(db, p), cover=p.cover_image,
            description=p.description, nights=p.nights, total_price=p.total_price, cover_image=p.cover_image,
            dorm_room_id=p.dorm_room_id, tour_id=p.tour_id, buddy_profile_id=p.buddy_profile_id,
        )
        for p in rows
    ])


@router.get("/contents/{key}", response_model=ContentOut)
def get_content(
    key: str, lang: str | None = None, accept_language: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> ContentOut:
    """CM-01: 약관·환불·고객센터·성북 소개. 언어는 ?lang → Accept-Language → ko 순으로 정하고, 그 언어 글이 없으면 ko."""
    if key not in CONTENT_KEYS:
        raise api_error(404, "NOT_FOUND", "정의되지 않은 콘텐츠입니다")
    language = (lang or (accept_language or "ko")[:2]).lower()
    c = db.get(Content, (key, language)) or db.get(Content, (key, "ko"))
    if not c:
        raise api_error(404, "NOT_FOUND", "콘텐츠를 찾을 수 없습니다")
    return ContentOut(key=c.key, language=c.language, title=c.title, body=c.body, updated_at=c.updated_at)
