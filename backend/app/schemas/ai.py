import datetime as dt
from datetime import date
from typing import Annotated, Literal

from pydantic import AliasChoices, BaseModel, Field, StringConstraints


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
    type: str  # dorm | buddy | course | free  (course는 무료, 예약 항목 아님)
    ref_id: int | None = None
    title: str
    price: int = 0
    meta: str | None = None  # 화면 보조 문구 (프론트 PlanItem.meta)
    course_id: int | None = None  # buddy 항목: 같이 걸을 코스 (BK-01 버디 항목의 course_id로 그대로 보냄)


class PlanDay(BaseModel):
    date: date
    items: list[PlanItem] = []


class PlanOut(BaseModel):
    plan_id: str
    reason: str
    total_price: int
    days: list[PlanDay]
    ai: bool = False  # LLM이 고른 결과면 true, 규칙 기반 폴백이면 false
    warnings: list[str] = []  # NO_BUDDY (숙박 기간에 가능한 버디 없음) · OVER_BUDGET (버디를 넣으니 예산 초과)


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
Code = Annotated[str, StringConstraints(pattern=r"^[a-z_]{2,20}$")]


class MatchIn(BaseModel):
    language: Literal["ko", "en", "ja", "zh"] | None = None  # 버디가 쓸 줄 알아야 하는 언어
    date: dt.date | None = None  # 이름이 타입과 같아 dt.date로 적는다
    interests: list[Code] = Field(default=[], max_length=10)
    personality: list[Code] = Field(default=[], max_length=4)  # 원하는 버디 성향 (calm·lively·listener·humor)
    style: list[Code] = Field(default=[], max_length=4)  # 원하는 걷기 스타일
    needs: list[Code] = Field(default=[], max_length=5)  # 필요한 도움 (can_help 코드)
    university_id: int | None = None  # 숙소 대학 → 같은 대학 버디 가산점


class MatchItem(BaseModel):
    buddy_id: int
    score: float  # 0~1, 코드가 계산 (관심사·언어·성향·도움·같은 대학)
    reason: str


class MatchOut(BaseModel):
    reason: str
    matches: list[MatchItem]  # 최대 3명, 후보가 적으면 있는 만큼
    ai: bool = False


# ---------- AI-04 동행 준비 자료 ----------
class BriefIn(BaseModel):
    # 명세는 booking_item_id, 프론트 버디 화면은 item_id로 보낸다 → 둘 다 받는다
    booking_item_id: int = Field(validation_alias=AliasChoices("booking_item_id", "item_id"))


class BriefPlace(BaseModel):
    name: str
    name_en: str
    summary: str
    tips: str


class BriefOut(BaseModel):
    booking_item_id: int
    places: list[BriefPlace]
    phrases: list[str]  # 관광객에게 쓸 영어 문장
    brief: str  # 버디 요청 카드에 보이는 2~3문장 안내 (프론트 BuddyBrief.brief)
    ai: bool = False


# ---------- AI-05 다국어 안내문 초안 ----------
class NoticeIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    target_languages: list[Literal["en", "ja", "zh", "ko"]] = Field(min_length=1, max_length=4)


class NoticeOut(BaseModel):
    drafts: dict[str, str]
    warnings: list[str] = []  # 원문 숫자(시간·금액)가 빠진 초안
    ai: bool = False  # false면 번역하지 못하고 원문을 그대로 넣은 것
