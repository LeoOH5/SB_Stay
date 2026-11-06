"""콘텐츠·AI: packages, contents, ai_plans, ai_usage, course_surveys"""
from datetime import date, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.base import TimestampMixin


class Package(Base):
    __tablename__ = "packages"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(100))
    title_en: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text)
    dorm_room_id: Mapped[int | None] = mapped_column(ForeignKey("dorm_rooms.id"))
    tour_id: Mapped[int | None] = mapped_column(ForeignKey("tours.id"))
    buddy_profile_id: Mapped[int | None] = mapped_column(ForeignKey("buddy_profiles.id"))
    nights: Mapped[int] = mapped_column(SmallInteger, default=2)
    total_price: Mapped[int] = mapped_column(Integer, default=0)
    cover_image: Mapped[str | None] = mapped_column(String(255))
    sort_order: Mapped[int] = mapped_column(SmallInteger, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Content(Base):
    __tablename__ = "contents"
    key: Mapped[str] = mapped_column(String(30), primary_key=True)  # terms | refund | support | intro
    language: Mapped[str] = mapped_column(String(5), primary_key=True)
    title: Mapped[str] = mapped_column(String(100))
    body: Mapped[str] = mapped_column(Text)  # markdown
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class AiUsage(Base):
    """v3.4 무료 이용자의 AI-02 질문 수 (사용자 × 하루 1행). 하루 = 설정의 today() (DEMO_TODAY)"""
    __tablename__ = "ai_usage"
    __table_args__ = (UniqueConstraint("user_id", "day", name="uq_ai_usage_user_day"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    day: Mapped[date] = mapped_column(Date)
    questions: Mapped[int] = mapped_column(SmallInteger, default=0, server_default="0")


class CourseSurvey(Base, TimestampMixin):
    """v3.4 무료 코스를 다 걸은 뒤 설문 (만족도 1~5, 가장 불편했던 점, 다음엔 버디와 걸을지)"""
    __tablename__ = "course_surveys"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    tour_id: Mapped[int] = mapped_column(ForeignKey("tours.id"), index=True)
    satisfaction: Mapped[int] = mapped_column(SmallInteger)
    pain: Mapped[str] = mapped_column(String(20))  # rules.SURVEY_PAIN 코드
    want_buddy: Mapped[bool] = mapped_column(Boolean)
    plan: Mapped[str] = mapped_column(String(10))  # 낸 때의 이용 방식 free | buddy


class AiPlan(Base, TimestampMixin):
    __tablename__ = "ai_plans"
    id: Mapped[str] = mapped_column(String(20), primary_key=True)  # pl_8f2
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    request: Mapped[dict] = mapped_column(JSON)
    result: Mapped[dict] = mapped_column(JSON)
