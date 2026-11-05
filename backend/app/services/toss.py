"""토스페이먼츠 API (결제 승인 · 취소). 시크릿 키는 서버에만 둔다."""
import base64
import uuid
from dataclasses import dataclass

import httpx

from app.core.config import get_settings


@dataclass
class TossError(Exception):
    status: int
    code: str
    message: str


def enabled() -> bool:
    return bool(get_settings().toss_secret_key)


def _headers(idempotency_key: str | None = None) -> dict[str, str]:
    # Basic base64("시크릿키:") — 끝의 콜론 필수
    token = base64.b64encode(f"{get_settings().toss_secret_key}:".encode()).decode()
    h = {"Authorization": f"Basic {token}", "Content-Type": "application/json"}
    if idempotency_key:
        h["Idempotency-Key"] = idempotency_key
    return h


def _post(path: str, body: dict, idempotency_key: str | None = None) -> dict:
    url = f"{get_settings().toss_api_base}{path}"
    try:
        r = httpx.post(url, json=body, headers=_headers(idempotency_key), timeout=20)
    except httpx.HTTPError as e:
        raise TossError(502, "PG_UNAVAILABLE", f"결제사 연결 실패: {e}") from e
    data = r.json() if r.content else {}
    if r.status_code >= 400:
        raise TossError(r.status_code, str(data.get("code", "PG_ERROR")), str(data.get("message", "결제사 오류")))
    return data


def confirm(payment_key: str, order_id: str, amount: int) -> dict:
    """POST /v1/payments/confirm"""
    return _post("/v1/payments/confirm", {"paymentKey": payment_key, "orderId": order_id, "amount": amount})


def cancel(payment_key: str, reason: str, amount: int | None = None) -> dict:
    """POST /v1/payments/{paymentKey}/cancel. amount 없으면 전액 취소"""
    body: dict = {"cancelReason": reason[:200]}
    if amount is not None:
        body["cancelAmount"] = amount
    return _post(f"/v1/payments/{payment_key}/cancel", body, idempotency_key=str(uuid.uuid4()))
