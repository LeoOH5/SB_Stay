from pydantic import BaseModel, EmailStr


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
    role: str  # tourist | buddy | guide
    university_id: int | None = None  # buddy·guide는 소속 대학


class SignupIn(BaseModel):
    name: str
    email: EmailStr
    password: str
    language: str = "en"


class MeUpdateIn(BaseModel):
    language: str | None = None
    name: str | None = None
