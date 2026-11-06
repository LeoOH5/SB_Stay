from datetime import date

from pydantic import BaseModel

from app.schemas.tours import ReviewOut


class BuddyOut(BaseModel):
    """BD-01 목록 항목 (프론트 Buddy 타입과 같은 모양). 연락처 등 개인정보는 넣지 않는다."""
    id: int
    name: str
    university: str
    major: str | None = None
    year: int | None = None
    languages: list[str] = []
    interests: list[str] = []
    intro: str | None = None
    avatar: str | None = None
    hourly_fee: int = 0
    available_dates: list[date] = []
    rating: float = 0
    review_count: int = 0


class BuddyDetailOut(BuddyOut):
    """BD-02: 목록 항목 + 리뷰 샘플"""
    reviews: list[ReviewOut] = []
