"""공급 측: 대학·객실·코스(tours)·장소·버디. guides 표는 v3에서 쓰지 않는다(빈 표)."""
from datetime import date, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.base import TimestampMixin


class University(Base):
    __tablename__ = "universities"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    name_en: Mapped[str] = mapped_column(String(100))
    address: Mapped[str | None] = mapped_column(String(255))
    lat: Mapped[float | None] = mapped_column(Numeric(9, 6))
    lng: Mapped[float | None] = mapped_column(Numeric(9, 6))
    open_from: Mapped[date | None] = mapped_column(Date)  # 방학 개방 시작
    open_to: Mapped[date | None] = mapped_column(Date)
    checkin_guide: Mapped[dict | None] = mapped_column(JSON)  # 위치·절차·비상연락처
    email_domains: Mapped[list | None] = mapped_column(JSON)  # 버디 학교 메일 도메인 ["korea.ac.kr"]


class DormRoom(Base):
    __tablename__ = "dorm_rooms"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    university_id: Mapped[int] = mapped_column(ForeignKey("universities.id"), index=True)
    building: Mapped[str] = mapped_column(String(100))
    room_type: Mapped[str] = mapped_column(String(20))  # single | double | twin
    price_per_night: Mapped[int] = mapped_column(Integer)  # KRW
    total_rooms: Mapped[int] = mapped_column(Integer)
    open_from: Mapped[date | None] = mapped_column(Date)
    open_to: Mapped[date | None] = mapped_column(Date)
    rules: Mapped[list | None] = mapped_column(JSON)
    photos: Mapped[list | None] = mapped_column(JSON)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Guide(Base):
    """v3에서 쓰지 않음 (표만 남김)"""
    __tablename__ = "guides"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    license: Mapped[str | None] = mapped_column(String(100))
    languages: Mapped[list | None] = mapped_column(JSON)
    intro: Mapped[str | None] = mapped_column(Text)


class Tour(Base):
    """v3: 무료 AI 산책 코스 (예약 항목 아님)"""
    __tablename__ = "tours"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    guide_id: Mapped[int | None] = mapped_column(ForeignKey("guides.id"))
    title: Mapped[str] = mapped_column(String(100))
    title_en: Mapped[str] = mapped_column(String(100))
    theme: Mapped[str] = mapped_column(String(30))  # literature | independence | royal | hanok | food | craft
    duration_min: Mapped[int] = mapped_column(Integer)
    price: Mapped[int] = mapped_column(Integer)
    operating_days: Mapped[list | None] = mapped_column(JSON)  # ["sat","sun"]
    languages: Mapped[list | None] = mapped_column(JSON)
    meeting_point: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)


class Place(Base):
    __tablename__ = "places"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    name_en: Mapped[str] = mapped_column(String(100))
    lat: Mapped[float] = mapped_column(Numeric(9, 6))
    lng: Mapped[float] = mapped_column(Numeric(9, 6))
    address: Mapped[str | None] = mapped_column(String(255))
    hours: Mapped[str | None] = mapped_column(String(100))
    closed_days: Mapped[list | None] = mapped_column(JSON)
    fee: Mapped[int] = mapped_column(Integer, default=0)
    need_reservation: Mapped[bool] = mapped_column(Boolean, default=False)
    stay_min: Mapped[int] = mapped_column(Integer, default=20)
    tags: Mapped[list | None] = mapped_column(JSON)
    story_doc: Mapped[str | None] = mapped_column(Text)  # RAG 원문
    sources: Mapped[list | None] = mapped_column(JSON)  # RAG 출처


class TourPlace(Base):
    __tablename__ = "tour_places"
    tour_id: Mapped[int] = mapped_column(ForeignKey("tours.id"), primary_key=True)
    place_id: Mapped[int] = mapped_column(ForeignKey("places.id"), primary_key=True)
    seq: Mapped[int] = mapped_column(SmallInteger)  # 코스 내 순서 ("order"는 예약어)
    stay_min: Mapped[int | None] = mapped_column(Integer)


class BuddyProfile(Base):
    __tablename__ = "buddy_profiles"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    university_id: Mapped[int] = mapped_column(ForeignKey("universities.id"), index=True)
    major: Mapped[str | None] = mapped_column(String(50))
    year: Mapped[int | None] = mapped_column(SmallInteger)
    languages: Mapped[list | None] = mapped_column(JSON)
    interests: Mapped[list | None] = mapped_column(JSON)
    intro: Mapped[str | None] = mapped_column(Text)
    avatar: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | approved | suspended
    hourly_fee: Mapped[int] = mapped_column(Integer, default=0)
    personality: Mapped[list | None] = mapped_column(JSON)
    style: Mapped[list | None] = mapped_column(JSON)
    can_help: Mapped[list | None] = mapped_column(JSON)
    school_email: Mapped[str | None] = mapped_column(String(255))
    school_email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    code_agreed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    quiz_score: Mapped[int | None] = mapped_column(SmallInteger)
    bank_account: Mapped[str | None] = mapped_column(String(100))
    can_drive: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")  # 표시만 (유상 운송 금지)


class BuddyAvailability(Base):
    __tablename__ = "buddy_availability"
    __table_args__ = (UniqueConstraint("buddy_id", "date"),)
    buddy_id: Mapped[int] = mapped_column(ForeignKey("buddy_profiles.id"), primary_key=True)
    date: Mapped[date] = mapped_column(Date, primary_key=True, index=True)


class BuddyActivity(Base, TimestampMixin):
    """버디 활동 기록 (장소·먹은 것·사진). 앨범 옵션 사진도 여기서 나온다."""
    __tablename__ = "buddy_activities"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    buddy_id: Mapped[int] = mapped_column(ForeignKey("buddy_profiles.id"), index=True)
    booking_item_id: Mapped[int | None] = mapped_column(ForeignKey("booking_items.id"))
    date: Mapped[date] = mapped_column(Date)
    places: Mapped[list | None] = mapped_column(JSON)
    foods: Mapped[str | None] = mapped_column(Text)
    note: Mapped[str | None] = mapped_column(Text)
    photos: Mapped[list | None] = mapped_column(JSON)
