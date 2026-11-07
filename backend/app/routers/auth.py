"""인증 — AU-01 구글 로그인 · AU-02 회원가입 · AU-03 내 정보 · AU-04 설정 · AU-05 데모 로그인 · AU-06 역할 · AU-07/08 캘린더 · AU-09 이용 방식"""
import json
from pathlib import Path

from fastapi import APIRouter, Depends
from sqlalchemy import delete, exists, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.crypto import encrypt
from app.core.db import get_db
from app.core.deps import get_current_user
from app.core.errors import api_error
from app.core.security import create_access_token, hash_password, verify_password
from app.models.booking import MealClaim, Report
from app.models.content import Package
from app.models.supply import BuddyActivity, BuddyAvailability, BuddyProfile
from app.models.user import User
from app.schemas.auth import (
    DemoLoginIn,
    GoogleLoginIn,
    MeUpdateIn,
    PlanOut,
    RoleIn,
    SignupIn,
    TokenOut,
    UserOut,
)
from app.services import free_tier, google_oauth

router = APIRouter(prefix="/auth", tags=["auth"])


def _token_out(user: User, needs_role_setup: bool = False) -> TokenOut:
    token = create_access_token(user.id, user.role, user.university_id)
    return TokenOut(access_token=token, user=UserOut.model_validate(user), needs_role_setup=needs_role_setup)


@router.post("/google", response_model=TokenOut)
def google_login(body: GoogleLoginIn, db: Session = Depends(get_db)) -> TokenOut:
    """AU-01: 구글 code 또는 id_token → 프로필 → users upsert → JWT. 첫 로그인이면 needs_role_setup=true"""
    try:
        if body.id_token:
            profile = google_oauth.profile_from_id_token(body.id_token)
        elif body.code:
            tokens = google_oauth.exchange_code(body.code, body.redirect_uri)
            profile = google_oauth.fetch_profile(tokens.access_token)
        else:
            raise api_error(422, "VALIDATION", "code 또는 id_token이 필요합니다")
    except google_oauth.GoogleOAuthError as e:
        raise api_error(401, "UNAUTHORIZED", f"구글 인증 실패: {e}") from e

    user = db.scalar(select(User).where(User.google_sub == profile.sub))
    first_login = False
    if not user:
        user = db.scalar(select(User).where(User.email == profile.email))  # 데모 계정과 이메일이 같으면 연결
        if user:
            user.google_sub = profile.sub
        else:
            user = User(email=profile.email, name=profile.name, role="tourist", google_sub=profile.sub, language="en")
            db.add(user)
            first_login = True
    user.avatar_url = profile.picture or user.avatar_url
    db.commit()
    db.refresh(user)
    return _token_out(user, needs_role_setup=first_login)


@router.post("/signup", response_model=TokenOut, status_code=201)
def signup(body: SignupIn, db: Session = Depends(get_db)) -> TokenOut:
    """AU-02: 이메일 회원가입 (해커톤 단순화: 이메일 인증 없음, 역할은 tourist)"""
    if body.language not in ("ko", "en"):
        raise api_error(422, "VALIDATION", "language는 ko 또는 en")
    if len(body.password) < 8:
        raise api_error(422, "VALIDATION", "비밀번호는 8자 이상")
    if db.scalar(select(User).where(User.email == body.email)):
        raise api_error(409, "CONFLICT", "이미 가입된 이메일입니다")
    user = User(email=body.email, name=body.name, password_hash=hash_password(body.password), role="tourist", language=body.language)
    db.add(user)
    db.commit()
    db.refresh(user)
    return _token_out(user)


@router.post("/login", response_model=TokenOut)
def demo_login(body: DemoLoginIn, db: Session = Depends(get_db)) -> TokenOut:
    """AU-05: 데모 계정 전용 이메일 로그인"""
    user = db.scalar(select(User).where(User.email == body.email))
    if not user or not verify_password(body.password, user.password_hash):
        raise api_error(401, "UNAUTHORIZED", "이메일 또는 비밀번호가 맞지 않습니다")
    return _token_out(user)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    """AU-03"""
    return user


@router.get("/me/plan", response_model=PlanOut)
def my_plan(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    """AU-09 (v3.4): 무료(free) / 버디와 함께(buddy), 오늘 남은 AI 질문 수"""
    return free_tier.status(db, user)


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


# 시드 데모 계정 — 심사 중 누가 버디 지원을 눌러도 데모 시나리오(Emma 예약 등)가 깨지지 않게 역할 변경을 막는다
DEMO_EMAILS = frozenset(u["email"] for u in json.loads((Path(__file__).resolve().parents[1] / "seeds" / "data" / "users.json").read_text()))


def drop_pending_application(db: Session, user: User) -> None:
    """버디 → 여행자로 돌아가면, 아직 승인 전이고 활동 기록이 없는 지원서는 지운다 (운영자 승인 대기 목록에 남지 않게)"""
    prof = db.scalar(select(BuddyProfile).where(BuddyProfile.user_id == user.id))
    if not prof or prof.status != "pending":
        return
    used = any(db.scalar(select(exists().where(col == prof.id))) for col in
               (MealClaim.buddy_id, Report.buddy_id, BuddyActivity.buddy_id, Package.buddy_profile_id))
    if used:
        return
    db.execute(delete(BuddyAvailability).where(BuddyAvailability.buddy_id == prof.id))
    db.delete(prof)
    user.university_id = None


@router.patch("/me/role", response_model=UserOut)
def set_role(body: RoleIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
    """AU-06: 첫 로그인 후 역할 선택 (tourist | buddy). buddy의 대학은 university_id로 주거나 지원 단계(학교 메일 인증)에서 정해진다.
    univ_admin·operator는 시드 계정만"""
    if body.role not in ("tourist", "buddy"):
        raise api_error(422, "VALIDATION", "role은 tourist | buddy")
    if user.role in ("univ_admin", "operator"):
        raise api_error(409, "CONFLICT", "관리자 계정은 역할을 바꿀 수 없습니다")
    if user.email in DEMO_EMAILS and body.role != user.role:
        raise api_error(409, "DEMO_LOCKED", "데모 계정은 역할을 바꿀 수 없어요. 새 계정을 만들어 버디 지원을 해 보세요")
    if body.role == "tourist" and user.role == "buddy":
        drop_pending_application(db, user)
    if body.role == "buddy" and body.university_id:
        user.university_id = body.university_id
    user.role = body.role
    db.commit()
    db.refresh(user)
    return user


@router.post("/google/calendar")
def connect_calendar(body: GoogleLoginIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    """AU-07: calendar.events 범위 증분 인증 code → refresh token 암호화 저장"""
    if user.role != "buddy":
        raise api_error(403, "FORBIDDEN", "버디만 캘린더를 연동할 수 있습니다")
    if not body.code:
        raise api_error(422, "VALIDATION", "code가 필요합니다")
    if not get_settings().token_encryption_key:
        raise api_error(501, "NOT_IMPLEMENTED", "TOKEN_ENCRYPTION_KEY 미설정")
    try:
        tokens = google_oauth.exchange_code(body.code, body.redirect_uri)
    except google_oauth.GoogleOAuthError as e:
        raise api_error(401, "UNAUTHORIZED", f"구글 인증 실패: {e}") from e
    if not tokens.refresh_token:
        raise api_error(409, "CONFLICT", "refresh_token이 없습니다. access_type=offline&prompt=consent로 다시 요청하세요")
    if "calendar" not in tokens.scope:
        raise api_error(422, "VALIDATION", "calendar.events 범위 동의가 없습니다")
    user.google_refresh_token = encrypt(tokens.refresh_token)
    user.calendar_connected = True
    db.commit()
    return {"calendar_connected": True}


@router.delete("/google/calendar")
def disconnect_calendar(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    """AU-08: 연동 해제 (멱등)"""
    user.google_refresh_token = None
    user.calendar_connected = False
    db.commit()
    return {"calendar_connected": False}
