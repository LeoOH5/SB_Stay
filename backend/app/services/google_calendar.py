"""구글 캘린더 단방향 푸시 (B 담당).

- 버디/해설사 항목이 approved/confirmed로 바뀌고 users.calendar_connected면 이벤트 생성 → booking_items.google_event_id 저장
- 취소되면 이벤트 삭제
- 실패해도 승인 자체는 성공시키고 로그만 남긴다
- refresh token은 Fernet(TOKEN_ENCRYPTION_KEY)으로 암호화 저장
"""


def push_event(*, refresh_token_enc: str, summary: str, start_iso: str, end_iso: str, description: str = "") -> str:
    raise NotImplementedError("TODO(B)")


def delete_event(*, refresh_token_enc: str, event_id: str) -> None:
    raise NotImplementedError("TODO(B)")
