from datetime import date
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """환경변수 설정. .env.example 참고. 키 값은 절대 커밋하지 않는다."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "dev"
    database_url: str = "postgresql+psycopg://sbstay:sbstay@localhost:5432/sbstay"
    jwt_secret: str = "change-me"
    jwt_expire_minutes: int = 60 * 24 * 7
    cors_origins: str = "http://localhost:3000,http://localhost:3100"

    # 구글 OAuth (로그인 + 캘린더 증분 인증)
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:3000/auth/callback"
    token_encryption_key: str = ""  # Fernet key, refresh token 암호화용

    # LLM / RAG
    llm_api_key: str = ""
    llm_model: str = ""  # 멘토 지원 LLM API의 모델명 (.env에서 지정)
    llm_base_url: str = ""  # OpenAI 호환 API 주소. 비우면 OpenAI. 모델명이 claude- 로 시작하면 Anthropic
    llm_timeout_seconds: int = 20

    # 토스페이먼츠 결제위젯 시크릿 키 (test_gsk_... / live_gsk_...). 비우면 결제는 목업(즉시 완료)
    toss_secret_key: str = ""
    toss_api_base: str = "https://api.tosspayments.com"

    # PayPal (외국인 결제, USD). 비우면 PayPal 버튼 숨김. 운영은 https://api-m.paypal.com
    paypal_client_id: str = ""
    paypal_client_secret: str = ""
    paypal_api_base: str = "https://api-m.sandbox.paypal.com"
    usd_krw_rate: float = 1400.0  # 원화 → 달러 고정 환율 (해커톤용)

    # 테스트 결제 자동 환불: 결제 후 N시간이 지나면 전액 환불 (0 = 끔). 테스트 키(test_gsk · sandbox)일 때만 동작
    auto_refund_after_hours: int = 0
    auto_refund_check_minutes: int = 10

    # 숙박 수수료 (퍼센트 정수). 돈 계산은 정수만 쓴다: rules.pct(금액, 퍼센트)
    platform_fee_percent: int = 10

    # v3 버디: 학교 메일 인증번호(데모는 메일 발송 없이 고정값), debug면 응답에 dev_code 포함
    buddy_otp_code: str = "123456"
    debug: bool = False
    # 데모용 '오늘' (후기 가능 여부·식비 환불 확정). 비우면 실제 오늘
    demo_today: date | None = None
    # v3.6 사진 저장 폴더 (POST /uploads → <폴더>/<yyyy>/<mm>/<uuid>.<ext>, /media/... 로 보임). 기본 backend/uploads (깃 제외)
    upload_dir: str = str(Path(__file__).resolve().parents[2] / "uploads")

    def today(self) -> date:
        return self.demo_today or date.today()

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
