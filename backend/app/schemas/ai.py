import datetime as dt
from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints


class PlanIn(BaseModel):
    """AI-01 요청"""
    check_in: date
    check_out: date
    budget: int | None = Field(default=None, ge=0)  # 0 또는 없음 = 제한 없음
    interests: list[str] = []
    with_buddy: bool = True
    language: str = "ko"  # ko | en
    note: str | None = Field(default=None, max_length=500)


class PlanItem(BaseModel):
    time: str | None = None
    type: str  # dorm | tour | buddy | free
    ref_id: int | None = None
    title: str
    price: int = 0
    meta: str | None = None  # 화면 보조 문구 (프론트 PlanItem.meta)


class PlanDay(BaseModel):
    date: date
    items: list[PlanItem] = []


class PlanOut(BaseModel):
    plan_id: str
    reason: str
    total_price: int
    days: list[PlanDay]
    ai: bool = False  # LLM이 고른 결과면 true, 규칙 기반 폴백이면 false


# ---------- AI-02 역사 스토리 ----------
class StoryIn(BaseModel):
    place_id: int
    question: str | None = Field(default=None, max_length=300)  # 없으면 장소 소개 이야기
    language: Literal["ko", "en"] = "ko"


class Source(BaseModel):
    title: str
    url: str | None = None


class StoryOut(BaseModel):
    answer: str
    sources: list[Source]
    grounded: bool  # false면 화면은 "자료에 없다" 안내
    ai: bool = False  # LLM이 쓴 답이면 true, 규칙 기반 검색이면 false


# ---------- AI-03 버디 매칭 ----------
class MatchIn(BaseModel):
    language: Literal["ko", "en", "ja", "zh"] | None = None  # 버디가 쓸 줄 알아야 하는 언어
    date: dt.date | None = None  # 이름이 타입과 같아 dt.date로 적는다
    interests: list[Annotated[str, StringConstraints(pattern=r"^[a-z_]{2,20}$")]] = Field(default=[], max_length=10)


class MatchItem(BaseModel):
    buddy_id: int
    score: float  # 0~1, 코드가 계산 (관심사 겹침·언어)
    reason: str


class MatchOut(BaseModel):
    reason: str
    matches: list[MatchItem]  # 최대 3명, 후보가 적으면 있는 만큼
    ai: bool = False
