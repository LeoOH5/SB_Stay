import os

os.environ["DATABASE_URL"] = "postgresql+psycopg://sbstay:sbstay@localhost:5432/sbstay_test"
os.environ["JWT_SECRET"] = "test-secret"
os.environ["TOKEN_ENCRYPTION_KEY"] = "u6wXK7hv2iQ0pZ3bYcNq9e1rT4sF8gL5mA2dH7jK0oI="

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

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


@pytest.fixture
def tourist(client):
    return login(client, "emma@example.com")


@pytest.fixture
def buddy(client):
    return login(client, "jiwoo@a-univ.ac.kr")


@pytest.fixture
def guide(client):
    return login(client, "guide.park@example.com")


@pytest.fixture
def univ_admin(client):
    return login(client, "admin@a-univ.ac.kr")


@pytest.fixture
def operator(client):
    return login(client, "operator@sbstay.app")


@pytest.fixture
def reset_db():
    """상태를 바꾸는 테스트 뒤 시드 재적재"""
    yield
    seed_main()


__all__ = ["text"]
