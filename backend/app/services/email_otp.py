"""메일 인증번호 발급·확인 (버디 지원 학교 메일).
- 6자리 무작위, 해시(sha256 + 메일 주소)로만 저장
- 5분 뒤 만료, 5번 틀리면 다시 받기, 같은 주소로 60초 안에 다시 보내지 않음"""
import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import api_error
from app.models.email_otp import EmailOtp
from app.models.user import User
from app.services import mail

TTL = timedelta(minutes=5)
COOLDOWN = timedelta(seconds=60)
MAX_ATTEMPTS = 5


def _hash(email: str, code: str) -> str:
    return hashlib.sha256(f"{email}:{code}".encode()).hexdigest()


def _latest(db: Session, user: User, email: str) -> EmailOtp | None:
    return db.scalar(select(EmailOtp).where(EmailOtp.user_id == user.id, EmailOtp.email == email, EmailOtp.used_at.is_(None))
                     .order_by(EmailOtp.id.desc()).limit(1))


def _body(code: str, university: str) -> tuple[str, str]:
    text = (f"성북스테이 버디 지원 인증번호는 {code} 입니다.\n"
            f"{university} 학교 메일 확인을 위해 5분 안에 입력해 주세요.\n"
            "직접 요청하지 않았다면 이 메일은 무시해 주세요.")
    html = f"""<div style="font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;max-width:440px;margin:0 auto;padding:28px 24px;color:#1F2937">
  <div style="font-size:18px;font-weight:700;color:#1E3A5F">성북스테이</div>
  <p style="margin:20px 0 8px;font-size:15px">{university} 학교 메일 확인을 위한 버디 지원 인증번호예요.</p>
  <div style="margin:16px 0;padding:18px 0;text-align:center;font-size:32px;font-weight:700;letter-spacing:8px;background:#F3F5F8;border-radius:12px;color:#1E3A5F">{code}</div>
  <p style="margin:0;font-size:13px;color:#6B7280">5분 안에 입력해 주세요. 직접 요청하지 않았다면 이 메일은 무시해 주세요.</p>
</div>"""
    return html, text


def issue(db: Session, user: User, email: str, university: str) -> None:
    email = email.strip().lower()
    now = datetime.now(UTC)
    last = _latest(db, user, email)
    if last and last.created_at and now - last.created_at < COOLDOWN:
        raise api_error(429, "TOO_SOON", "인증번호를 방금 보냈어요. 1분 뒤에 다시 받아 주세요")
    code = f"{secrets.randbelow(1_000_000):06d}"
    html, text = _body(code, university)
    try:
        mail.send(email, f"[성북스테이] 버디 지원 인증번호 {code}", html, text)
    except mail.MailError as e:
        raise api_error(502, "MAIL_FAILED", "메일을 보내지 못했어요. 주소를 확인하고 잠시 뒤 다시 시도해 주세요") from e
    db.add(EmailOtp(user_id=user.id, email=email, code_hash=_hash(email, code), expires_at=now + TTL, created_at=now))
    db.commit()


def peek(db: Session, user: User, email: str, code: str) -> EmailOtp:
    """번호만 확인한다(쓰지 않음). 틀리면 시도 횟수를 저장하고 오류 — 화면의 '인증하기' 버튼"""
    email = email.strip().lower()
    otp = _latest(db, user, email)
    if not otp or otp.expires_at <= datetime.now(UTC):
        raise api_error(422, "CODE_EXPIRED", "인증번호가 만료됐어요. 다시 받아 주세요")
    if otp.attempts >= MAX_ATTEMPTS:
        raise api_error(429, "TOO_MANY_ATTEMPTS", "5번 틀렸어요. 인증번호를 다시 받아 주세요")
    if not hmac.compare_digest(otp.code_hash, _hash(email, code.strip())):
        otp.attempts += 1
        db.commit()
        raise api_error(422, "BAD_CODE", "인증번호가 맞지 않아요")
    return otp


def check(db: Session, user: User, email: str, code: str) -> EmailOtp:
    """맞으면 used_at을 찍은 기록을 돌려준다 (커밋은 호출부가 나머지와 함께). 틀리면 시도 횟수를 저장하고 오류"""
    otp = peek(db, user, email, code)
    otp.used_at = datetime.now(UTC)
    return otp
