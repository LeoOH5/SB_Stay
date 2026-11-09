from pydantic import BaseModel, EmailStr, computed_field

from app.core.demo import is_demo_email


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    university_id: int | None = None
    language: str = "ko"
    avatar_url: str | None = None
    calendar_connected: bool = False

    model_config = {"from_attributes": True}

    @computed_field  # 심사용 시드 데모 계정 — 프론트가 버디 신청 버튼을 누르면 안내만 띄운다
    @property
    def is_demo(self) -> bool:
        return is_demo_email(self.email)


class TokenOut(BaseModel):
    access_token: str
    user: UserOut
    needs_role_setup: bool = False


class GoogleLoginIn(BaseModel):
    code: str | None = None
    id_token: str | None = None
    redirect_uri: str | None = None


class DemoLoginIn(BaseModel):
    email: EmailStr
    password: str


class RoleIn(BaseModel):
    role: str  # tourist | buddy
    university_id: int | None = None  # buddy 소속 대학 (없으면 학교 메일 인증 때 정해짐)


class SignupIn(BaseModel):
    name: str
    email: EmailStr
    password: str
    language: str = "en"


class MeUpdateIn(BaseModel):
    language: str | None = None
    name: str | None = None


class PlanOut(BaseModel):
    """AU-09 v3.4 이용 방식. free = 무료 AI 산책 코스(질문 하루 3번), buddy = 결제한 버디 예약이 있음(제한 없음)"""
    plan: str  # free | buddy
    ai_question_limit: int | None = None  # free: 3, buddy: null(제한 없음)
    ai_questions_left_today: int | None = None
    ai_questions_used_today: int = 0
