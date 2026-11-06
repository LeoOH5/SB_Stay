from datetime import date

from pydantic import BaseModel


class GuideBrief(BaseModel):
    id: int
    name: str
    license: str | None = None
    languages: list[str] = []


class TourPlaceOut(BaseModel):
    order: int
    id: int
    name: str
    name_en: str
    lat: float
    lng: float
    stay_min: int | None = None


class TourOut(BaseModel):
    """TR-01 목록 항목 · TR-02 상세 (프론트 Tour 타입과 같은 모양: 목록에도 places 포함)"""
    id: int
    title: str
    title_en: str
    theme: str
    guide: GuideBrief
    duration_min: int
    price: int
    operating_days: list[str] = []
    languages: list[str] = []
    meeting_point: str | None = None
    description: str | None = None
    places: list[TourPlaceOut] = []


class PlaceOut(BaseModel):
    """TR-03. story_doc(RAG 원문)은 AI-02 전용이라 내보내지 않는다."""
    id: int
    name: str
    name_en: str
    lat: float
    lng: float
    address: str | None = None
    hours: str | None = None
    closed_days: list[str] = []
    fee: int = 0
    need_reservation: bool = False
    stay_min: int = 20
    tags: list[str] = []

    model_config = {"from_attributes": True}


class ReviewOut(BaseModel):
    id: int
    rating: int
    text: str | None = None
    author: str = ""  # 프론트 Review 타입: 작성자 이름(성 제외)
    created_at: date


class ReviewListOut(BaseModel):
    items: list[ReviewOut]
    average_rating: float | None = None
    next_cursor: str | None = None
