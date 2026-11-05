"""PayPal Orders API v2 (주문 생성 · 승인 후 캡처 · 환불). 외국인 결제용, USD 청구. 키는 서버에만."""
import time
from dataclasses import dataclass
from decimal import ROUND_UP, Decimal

import httpx

from app.core.config import get_settings


@dataclass
class PayPalError(Exception):
    status: int
    code: str
    message: str


_token: dict = {"value": "", "exp": 0.0}


def enabled() -> bool:
    s = get_settings()
    return bool(s.paypal_client_id and s.paypal_client_secret)


def usd_for(krw: int) -> str:
    """원화 금액을 고정 환율로 달러 문자열로 (센트 단위 올림). 예: 125000 → "89.29" """
    usd = (Decimal(krw) / Decimal(str(get_settings().usd_krw_rate))).quantize(Decimal("0.01"), rounding=ROUND_UP)
    return f"{usd:.2f}"


def _access_token() -> str:
    if _token["value"] and _token["exp"] > time.time() + 60:
        return _token["value"]
    s = get_settings()
    try:
        r = httpx.post(f"{s.paypal_api_base}/v1/oauth2/token", data={"grant_type": "client_credentials"},
                       auth=(s.paypal_client_id, s.paypal_client_secret), timeout=20)
    except httpx.HTTPError as e:
        raise PayPalError(502, "PG_UNAVAILABLE", f"PayPal 연결 실패: {e}") from e
    if r.status_code >= 400:
        raise PayPalError(r.status_code, "PAYPAL_AUTH", "PayPal 키 인증에 실패했습니다")
    data = r.json()
    _token.update(value=data["access_token"], exp=time.time() + int(data.get("expires_in", 300)))
    return _token["value"]


def _post(path: str, body: dict | None = None) -> dict:
    s = get_settings()
    headers = {"Authorization": f"Bearer {_access_token()}", "Content-Type": "application/json"}
    try:
        r = httpx.post(f"{s.paypal_api_base}{path}", json=body or {}, headers=headers, timeout=30)
    except httpx.HTTPError as e:
        raise PayPalError(502, "PG_UNAVAILABLE", f"PayPal 연결 실패: {e}") from e
    data = r.json() if r.content else {}
    if r.status_code >= 400:
        detail = (data.get("details") or [{}])[0]
        raise PayPalError(r.status_code, str(detail.get("issue") or data.get("name") or "PAYPAL_ERROR"),
                          str(detail.get("description") or data.get("message") or "PayPal 오류"))
    return data


def create_order(order_id: str, usd: str, description: str) -> dict:
    """POST /v2/checkout/orders (intent=CAPTURE)"""
    return _post("/v2/checkout/orders", {
        "intent": "CAPTURE",
        "purchase_units": [{"reference_id": order_id, "custom_id": order_id, "description": description[:127],
                            "amount": {"currency_code": "USD", "value": usd}}],
    })


def capture(paypal_order_id: str) -> dict:
    """POST /v2/checkout/orders/{id}/capture — 구매자가 승인한 뒤"""
    return _post(f"/v2/checkout/orders/{paypal_order_id}/capture")


def refund(capture_id: str, usd: str | None = None) -> dict:
    """POST /v2/payments/captures/{id}/refund. usd 없으면 전액"""
    body = {"amount": {"currency_code": "USD", "value": usd}} if usd else {}
    return _post(f"/v2/payments/captures/{capture_id}/refund", body)
