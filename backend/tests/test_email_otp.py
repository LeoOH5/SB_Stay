"""버디 지원 학교 메일 인증 — 메일 키가 있으면 무작위 번호를 메일로 보내고, 만료·시도 횟수·재발송 간격을 지킨다"""
import re
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import update

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.models.email_otp import EmailOtp
from app.services import mail
from tests.test_buddy_me import _new_buddy

B = "/api/v1/buddy"
EMAIL = "otp@korea.ac.kr"
PERSON = {"birth_date": "2003-01-01", "korean_national": True}


@pytest.fixture
def sent(monkeypatch):
    """메일 키를 넣고 실제 발송 대신 보낸 메일을 모은다"""
    monkeypatch.setattr(get_settings(), "resend_api_key", "re_test")
    box: list[dict] = []
    monkeypatch.setattr(mail, "send", lambda to, subject, html, text: box.append({"to": to, "subject": subject, "text": text}))
    return box


def _code(box) -> str:
    return re.search(r"\b(\d{6})\b", box[-1]["text"]).group(1)


def _verify(client, h, code, email=EMAIL):
    return client.post(f"{B}/apply/verify", json={"email": email, "code": code, **PERSON}, headers=h)


def test_real_code_sent_and_verified(client, sent, reset_db):
    h = _new_buddy(client, "otp1@example.com")
    r = client.post(f"{B}/apply/email", json={"email": EMAIL}, headers=h).json()
    assert r == {"sent": True, "university": "고려대학교", "dev_code": None}
    assert len(sent) == 1 and sent[0]["to"] == EMAIL and "인증번호" in sent[0]["subject"]
    code = _code(sent)
    # 데모 고정값은 메일 키가 있으면 통하지 않는다
    if code != get_settings().buddy_otp_code:
        assert _verify(client, h, get_settings().buddy_otp_code).json()["error"]["code"] == "BAD_CODE"
    ok = _verify(client, h, code)
    assert ok.status_code == 200 and ok.json()["email_verified"] is True
    # 한 번 쓴 번호는 다시 못 쓴다
    assert _verify(client, h, code).json()["error"]["code"] == "CODE_EXPIRED"


def test_cooldown_attempts_and_expiry(client, sent, reset_db):
    h = _new_buddy(client, "otp2@example.com")
    assert client.post(f"{B}/apply/email", json={"email": EMAIL}, headers=h).status_code == 200
    again = client.post(f"{B}/apply/email", json={"email": EMAIL}, headers=h)
    assert again.status_code == 429 and again.json()["error"]["code"] == "TOO_SOON" and len(sent) == 1
    code = _code(sent)
    wrong = "000000" if code != "000000" else "111111"
    for _ in range(5):
        assert _verify(client, h, wrong).json()["error"]["code"] == "BAD_CODE"
    assert _verify(client, h, code).json()["error"]["code"] == "TOO_MANY_ATTEMPTS"
    # 만료: 새 번호를 받은 뒤 시간을 지나게 한다
    with SessionLocal() as db:
        db.execute(update(EmailOtp).values(created_at=datetime.now(UTC) - timedelta(minutes=2)))
        db.commit()
    assert client.post(f"{B}/apply/email", json={"email": EMAIL}, headers=h).status_code == 200
    code = _code(sent)
    with SessionLocal() as db:
        db.execute(update(EmailOtp).where(EmailOtp.used_at.is_(None)).values(expires_at=datetime.now(UTC) - timedelta(seconds=1)))
        db.commit()
    assert _verify(client, h, code).json()["error"]["code"] == "CODE_EXPIRED"


def test_mail_failure_is_reported(client, monkeypatch, reset_db):
    monkeypatch.setattr(get_settings(), "resend_api_key", "re_test")

    def boom(*_a, **_k):
        raise mail.MailError("500")
    monkeypatch.setattr(mail, "send", boom)
    h = _new_buddy(client, "otp3@example.com")
    r = client.post(f"{B}/apply/email", json={"email": EMAIL}, headers=h)
    assert r.status_code == 502 and r.json()["error"]["code"] == "MAIL_FAILED"


def test_check_button_does_not_consume(client, sent, reset_db):
    """'인증하기' 버튼: 맞으면 verified, 틀리면 시도 횟수에 들어가고, 확인만 해서 다음 단계에서 같은 번호를 쓴다"""
    h = _new_buddy(client, "otp4@example.com")
    client.post(f"{B}/apply/email", json={"email": EMAIL}, headers=h)
    code = _code(sent)
    wrong = "000000" if code != "000000" else "111111"
    bad = client.post(f"{B}/apply/email/check", json={"email": EMAIL, "code": wrong}, headers=h)
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "BAD_CODE"
    ok = client.post(f"{B}/apply/email/check", json={"email": EMAIL, "code": code}, headers=h)
    assert ok.status_code == 200 and ok.json() == {"verified": True}
    assert _verify(client, h, code).status_code == 200  # 확인만 했으니 그대로 쓸 수 있다


def test_check_button_demo_code(client, reset_db):
    """메일 키가 없으면(데모) 고정 인증번호로 확인"""
    h = _new_buddy(client, "otp5@example.com")
    r = client.post(f"{B}/apply/email/check", json={"email": EMAIL, "code": get_settings().buddy_otp_code}, headers=h)
    assert r.json() == {"verified": True}
    assert client.post(f"{B}/apply/email/check", json={"email": EMAIL, "code": "000000"}, headers=h).status_code == 422
    assert client.post(f"{B}/apply/email/check", json={"email": "me@gmail.com", "code": "123456"}, headers=h).json()["error"]["code"] == "NOT_SEONGBUK_SCHOOL"
