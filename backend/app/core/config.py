from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """환경변수 설정. .env.example 참고. 키 값은 절대 커밋하지 않는다."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "dev"
    database_url: str = "postgresql+psycopg://sbstay:sbstay@localhost:5432/sbstay"
    jwt_secret: str = "change-me"
    jwt_expire_minutes: int = 60 * 24 * 7
    cors_origins: str = "http://localhost:3000"

    # 구글 OAuth (로그인 + 캘린더 증분 인증)
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:3000/auth/callback"
    token_encryption_key: str = ""  # Fernet key, refresh token 암호화용

    # LLM / RAG
    llm_api_key: str = ""
    llm_model: str = ""  # 멘토 지원 LLM API의 모델명 (.env에서 지정)
    llm_timeout_seconds: int = 20

    # 수수료율 (해커톤은 상수)
    platform_fee_rate: float = 0.10

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
