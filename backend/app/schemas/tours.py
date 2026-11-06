from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


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
    lat: float | None = None  # 좌표가 없으면 null (그 구간 걷는 시간은 빠진다)
    lng: float | None = None
    stay_min: int | None = None  # 이 코스에서 머무는 시간 (코스별 값 → 없으면 장소 기본값)
    photo_url: str | None = None  # v3.5 장소 대표 사진 (TourAPI, 없으면 null → 화면은 색 블록)
    photo_credit: str | None = None


class CourseLegOut(BaseModel):
    """v3.5 장소 → 다음 장소 걷는 구간. 좌표가 없으면 walk_m·walk_min·source null.
    v3.8 실제 도보 경로(OpenStreetMap)가 저장돼 있으면 그 거리 + path, 없으면 직선 × 1.3 추정. 속도는 둘 다 4 km/h"""
    from_place_id: int
    to_place_id: int
    walk_m: int | None = None  # 10 m 단위
    walk_min: int | None = None  # 분, 올림
    source: Literal["route", "estimate"] | None = None  # v3.8 route = 실제 경로 · estimate = 직선 × 1.3
    path: list[list[float]] | None = None  # v3.8 route일 때 [[위도, 경도], ...] (from → to). 지도 선, 표시할 때 '경로 © OpenStreetMap'


class TourOut(BaseModel):
    """TR-01 목록 항목 · TR-02 상세 = 무료 AI 산책 코스 (price 0, 예약 항목 아님). 목록에도 places 포함"""
    id: int
    title: str
    title_en: str
    theme: str
    guide: GuideBrief | None = None  # v3: 해설사 없음 → 항상 null
    duration_min: int  # v3.5 계산값 = stay_min_total + walk_min_total 을 10분 단위로 올림 (services/courses.py)
    stay_min_total: int = 0  # Σ places[].stay_min
    walk_m_total: int = 0  # Σ legs[].walk_m (좌표 없는 구간 제외)
    walk_min_total: int = 0  # Σ legs[].walk_min
    walk_complete: bool = True  # false = 좌표 없는 장소가 있어 걷는 시간 일부 빠짐
    route_source: Literal["route", "estimate", "mixed"] = "estimate"  # v3.8 legs 전부 실제 경로 / 전부 추정 / 섞임
    price: int
    operating_days: list[str] = []
    languages: list[str] = []
    meeting_point: str | None = None
    description: str | None = None
    places: list[TourPlaceOut] = []
    legs: list[CourseLegOut] = []  # v3.5 places 순서대로 n−1개 (목록·상세 모두)


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
    photo_url: str | None = None
    photo_credit: str | None = None

    model_config = {"from_attributes": True}


class ReviewOut(BaseModel):
    id: int
    rating: int
    text: str | None = None
    author: str = ""  # 프론트 Review 타입: 작성자 이름(성 제외)
    sub_scores: dict[str, int] | None = None  # {kind, talk, punctual, local}
    tags: list[str] = []
    created_at: date


class ReviewListOut(BaseModel):
    items: list[ReviewOut]
    average_rating: float | None = None
    next_cursor: str | None = None


class SurveyIn(BaseModel):
    """TR-05 v3.4 무료 코스 완료 설문"""
    satisfaction: int = Field(ge=1, le=5)
    pain: str  # rules.SURVEY_PAIN 코드 (ads · question_limit · route_fit · no_help · none)
    want_buddy: bool


class SurveyOut(BaseModel):
    id: int
    tour_id: int
    satisfaction: int
    pain: str
    want_buddy: bool
    plan: str  # 낸 때의 이용 방식 free | buddy
    created_at: datetime

    model_config = {"from_attributes": True}
