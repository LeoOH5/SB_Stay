from datetime import datetime

from pydantic import BaseModel


class PackageItem(BaseModel):
    type: str  # dorm | tour | buddy
    ref_id: int
    title: str


class PackageOut(BaseModel):
    """HM-01. 명세 필드(summary·price_from·days·items·cover)와
    프론트 Package 타입 필드(description·nights·total_price·*_id·cover_image)를 둘 다 담는다."""
    id: int
    title: str
    title_en: str
    summary: str | None = None
    price_from: int
    days: int
    items: list[PackageItem] = []
    cover: str | None = None
    # 프론트 Package 타입
    description: str | None = None
    nights: int
    total_price: int
    cover_image: str | None = None
    dorm_room_id: int | None = None
    tour_id: int | None = None
    buddy_profile_id: int | None = None


class ContentOut(BaseModel):
    key: str
    language: str
    title: str
    body: str
    updated_at: datetime | None = None
