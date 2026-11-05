"""구글 캘린더 단방향 푸시 (AU-07 연동 후). 승인 시 이벤트 생성, 취소 시 삭제.

refresh token은 Fernet으로 암호화돼 있다. 실패는 호출부(booking_state)가 로그만 남긴다.
"""
from datetime import date, datetime, timedelta

import httpx

from app.core.crypto import decrypt
from app.services.google_oauth import refresh_access_token

EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
TZ = "Asia/Seoul"


def _access_token(refresh_token_enc: str) -> str:
    return refresh_access_token(decrypt(refresh_token_enc))


def push_event(*, refresh_token_enc: str, summary: str, date_: date, time_: str | None, duration_min: int, description: str = "") -> str:
    token = _access_token(refresh_token_enc)
    hh, mm = (time_ or "10:00").split(":")
    start = datetime(date_.year, date_.month, date_.day, int(hh), int(mm))
    end = start + timedelta(minutes=duration_min)
    body = {
        "summary": summary,
        "description": description,
        "start": {"dateTime": start.isoformat(), "timeZone": TZ},
        "end": {"dateTime": end.isoformat(), "timeZone": TZ},
    }
    r = httpx.post(EVENTS_URL, json=body, headers={"Authorization": f"Bearer {token}"}, timeout=10)
    r.raise_for_status()
    return r.json()["id"]


def delete_event(*, refresh_token_enc: str, event_id: str) -> None:
    token = _access_token(refresh_token_enc)
    r = httpx.delete(f"{EVENTS_URL}/{event_id}", headers={"Authorization": f"Bearer {token}"}, timeout=10)
    if r.status_code not in (204, 404, 410):
        r.raise_for_status()
