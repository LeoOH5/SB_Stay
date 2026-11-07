"""메일 발송 (Resend). RESEND_API_KEY가 없으면 enabled() = False → 호출부가 데모 동작(고정 인증번호)으로 간다."""
import logging

import httpx

from app.core.config import get_settings

log = logging.getLogger(__name__)


class MailError(RuntimeError):
    """발송 실패"""


def enabled() -> bool:
    return bool(get_settings().resend_api_key)


def send(to: str, subject: str, html: str, text: str) -> None:
    s = get_settings()
    try:
        r = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {s.resend_api_key}"},
            json={"from": s.mail_from, "to": [to], "subject": subject, "html": html, "text": text},
            timeout=15,
        )
    except httpx.HTTPError as e:
        raise MailError(str(e)) from e
    if r.status_code >= 400:
        log.warning("메일 발송 실패 %s: %s", r.status_code, r.text[:300])
        raise MailError(f"{r.status_code}")
