import os
import tempfile

os.environ["DATABASE_URL"] = "postgresql+psycopg://sbstay:sbstay@localhost:5432/sbstay_test"
os.environ["JWT_SECRET"] = "test-secret"
# 로컬 .env 의 결제 키가 테스트에 섞이지 않게 비운다 (필요한 테스트에서만 켬)
for _k in ("TOSS_SECRET_KEY", "PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "RESEND_API_KEY"):
    os.environ[_k] = ""
os.environ["AUTO_REFUND_AFTER_HOURS"] = "0"
# v3 데모 '오늘' (지난 여행 후기·식비 정산 시나리오), 버디 지원 인증번호
os.environ["DEMO_TODAY"] = "2027-01-14"
os.environ["BUDDY_OTP_CODE"] = "123456"
os.environ["DEBUG"] = "false"
# v3.6 올린 사진은 임시 폴더에 (저장소의 backend/uploads를 더럽히지 않게)
os.environ["UPLOAD_DIR"] = tempfile.mkdtemp(prefix="sbstay-uploads-")
os.environ["TOKEN_ENCRYPTION_KEY"] = "u6wXK7hv2iQ0pZ3bYcNq9e1rT4sF8gL5mA2dH7jK0oI="

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import close_all_sessions

from app.core.db import Base, SessionLocal, engine
from app.main import app
from app.seeds.__main__ import main as seed_main


@pytest.fixture(scope="session", autouse=True)
def _schema():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    seed_main()
    yield


@pytest.fixture
def db():
    with SessionLocal() as s:
        yield s


@pytest.fixture
def client():
    return TestClient(app)


def login(client: TestClient, email: str) -> dict:
    r = client.post("/api/v1/auth/login", json={"email": email, "password": "demo1234"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# 1×1 투명 PNG (v3.6 사진 올리기 테스트용)
TINY_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082"
)


def upload_png(client: TestClient, headers: dict) -> str:
    r = client.post("/api/v1/uploads", files={"file": ("a.png", TINY_PNG, "image/png")}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()["url"]


@pytest.fixture
def tourist(client):
    return login(client, "emma@example.com")


@pytest.fixture
def buddy(client):
    return login(client, "jiwoo@a-univ.ac.kr")


@pytest.fixture
def univ_admin(client):
    return login(client, "admin@a-univ.ac.kr")


@pytest.fixture
def operator(client):
    return login(client, "operator@sbstay.app")


@pytest.fixture
def reset_db():
    """상태를 바꾸는 테스트 뒤 시드 재적재. 테스트가 중간에 실패해 db 세션이 잠금을 쥔 채 남아도 멈추지 않게 먼저 닫는다"""
    yield
    close_all_sessions()
    seed_main()


__all__ = ["text"]
