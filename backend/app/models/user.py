from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.base import TimestampMixin

ROLES = ("tourist", "buddy", "guide", "univ_admin", "operator")


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255))  # 데모 계정만 사용
    name: Mapped[str] = mapped_column(String(100))
    role: Mapped[str] = mapped_column(String(20), default="tourist")  # ROLES
    university_id: Mapped[int | None] = mapped_column(ForeignKey("universities.id"))
    language: Mapped[str] = mapped_column(String(5), default="ko")
    # 구글 OAuth
    google_sub: Mapped[str | None] = mapped_column(String(64), unique=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    google_refresh_token: Mapped[str | None] = mapped_column(Text)  # Fernet 암호화 저장
    calendar_connected: Mapped[bool] = mapped_column(Boolean, default=False)
