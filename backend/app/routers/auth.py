"""AU-01 구글 로그인 · AU-03 내 정보 · AU-04 설정 · AU-05 데모 로그인 · AU-06 역할 · AU-07/08 캘린더 (B 담당)"""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.core.errors import api_error
from app.core.security import create_access_token, verify_password
from app.models.user import User
from app.schemas.auth import DemoLoginIn, GoogleLoginIn, MeUpdateIn, RoleIn, TokenOut, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/google", response_model=TokenOut)
def google_login(body: GoogleLoginIn, db: Session = Depends(get_db)) -> TokenOut:
    """AU-01: 구글 authorization code → 프로필 조회 → users upsert → JWT. TODO(B): services/google_oauth.py"""
    raise api_error(501, "NOT_IMPLEMENTED", "구글 로그인은 B 담당이 구현합니다 (services/google_oauth.py)")


@router.post("/login", response_model=TokenOut)
def demo_login(body: DemoLoginIn, db: Session = Depends(get_db)) -> TokenOut:
    """AU-05: 데모 계정 전용 이메일 로그인"""
    user = db.scalar(select(User).where(User.email == body.email))
    if not user or not verify_password(body.password, user.password_hash):
        raise api_error(401, "UNAUTHORIZED", "이메일 또는 비밀번호가 맞지 않습니다")
    token = create_access_token(user.id, user.role, user.university_id)
    return TokenOut(access_token=token, user=UserOut.model_validate(user), needs_role_setup=False)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    """AU-03"""
    return user


@router.patch("/me", response_model=UserOut)
def update_me(body: MeUpdateIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
    """AU-04: 언어(한/영)·프로필 수정"""
    if body.language:
        if body.language not in ("ko", "en"):
            raise api_error(422, "VALIDATION", "language는 ko 또는 en")
        user.language = body.language
    if body.name:
        user.name = body.name
    db.commit()
    db.refresh(user)
    return user


@router.patch("/me/role", response_model=UserOut)
def set_role(body: RoleIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
    """AU-06: 첫 로그인 후 역할 선택 (univ_admin·operator는 시드 계정만)"""
    if body.role not in ("tourist", "buddy", "guide"):
        raise api_error(422, "VALIDATION", "role은 tourist | buddy | guide")
    if user.role in ("univ_admin", "operator"):
        raise api_error(409, "CONFLICT", "관리자 계정은 역할을 바꿀 수 없습니다")
    user.role = body.role
    db.commit()
    db.refresh(user)
    return user


@router.post("/google/calendar")
def connect_calendar(user: User = Depends(get_current_user)) -> dict:
    """AU-07: 캘린더 범위 증분 인증 → refresh token 저장. TODO(B)"""
    raise api_error(501, "NOT_IMPLEMENTED", "캘린더 연동은 B 담당이 구현합니다 (services/google_calendar.py)")


@router.delete("/google/calendar")
def disconnect_calendar(user: User = Depends(get_current_user)) -> dict:
    """AU-08"""
    raise api_error(501, "NOT_IMPLEMENTED", "캘린더 연동 해제는 B 담당이 구현합니다")
