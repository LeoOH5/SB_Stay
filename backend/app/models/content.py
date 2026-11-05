"""콘텐츠·AI: packages, contents, ai_plans"""
from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
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


class AiPlan(Base, TimestampMixin):
    __tablename__ = "ai_plans"
    id: Mapped[str] = mapped_column(String(20), primary_key=True)  # pl_8f2
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    request: Mapped[dict] = mapped_column(JSON)
    result: Mapped[dict] = mapped_column(JSON)
