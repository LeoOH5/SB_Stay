from datetime import date

from pydantic import BaseModel, Field


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
