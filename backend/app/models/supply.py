"""공급 측: 대학·객실·코스(tours)·장소·버디. guides 표는 v3에서 쓰지 않는다(빈 표)."""
from datetime import date, datetime
from decimal import Decimal

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
    # v3.5: duration_min 칸 삭제 — 코스 시간은 장소 좌표·머무는 시간으로 계산한다 (services/courses.py)
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
    photo_url: Mapped[str | None] = mapped_column(String(500))  # 대표 사진 (TourAPI firstimage)
    photo_credit: Mapped[str | None] = mapped_column(String(200))  # 사진 출처·공공누리 유형


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
    # 성북구 대학이면 그 대학. v3.7 성북구 거주 경로로 다른 대학에 다니면 NULL (school_name에 학교 이름)
    university_id: Mapped[int | None] = mapped_column(ForeignKey("universities.id"), index=True)
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
    korean_national_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # 한국 국적 확인
    # v3.2 등급·정산율 (매월 services/grades.recompute_all), 휴면
    grade: Mapped[str] = mapped_column(String(10), default="basic", server_default="basic")  # basic | growth | top
    payout_rate: Mapped[Decimal] = mapped_column(Numeric(4, 3), default=Decimal("0.700"), server_default="0.700")
    grade_updated_at: Mapped[date | None] = mapped_column(Date)
    needs_recheck: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")  # 휴면: 목록·AI 추천에서 빠짐
    dormant_since: Mapped[date | None] = mapped_column(Date)  # 휴면 시작일 (복귀 후 첫 동행까지 남김)
    active_on: Mapped[date | None] = mapped_column(Date)  # 마지막 요청 수락·가능 날짜 수정·활동 확인
    # v3.7 매달 평가: 승인일(첫 달은 기본), 지금 등급을 정한 평가 달(그 달 1일)
    approved_on: Mapped[date | None] = mapped_column(Date)
    grade_evaluated_for: Mapped[date | None] = mapped_column(Date)
    # v3.7 자격 경로: school_email(성북구 대학 메일) | residence(성북구 거주 + 재학 증명, 운영자가 승인 때 확인)
    eligibility: Mapped[str | None] = mapped_column(String(20))
    school_name: Mapped[str | None] = mapped_column(String(100))  # 다니는 대학 이름 (거주 경로)
    residence_proof_url: Mapped[str | None] = mapped_column(String(500))  # 주소 증빙 사진 (/media/...)
    enrollment_proof_url: Mapped[str | None] = mapped_column(String(500))  # 재학 증명 사진 (/media/...)
    residence_submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    education_watched: Mapped[list | None] = mapped_column(JSON)  # 다 본 사전 교육 영상 id (rules.EDUCATION_IDS)


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
