"""결제 (PM-01~03, BK-06 목업, BK-05 환불). 토스 API는 가짜 응답으로 대신한다."""
from datetime import date

import pytest

from app.core.config import get_settings
from app.services import payments as ps
from app.services import toss

TRAVELER = {"name": "Emma Clark", "nationality": "US", "email": "emma@example.com", "guests": 1}
ITEMS = [
    {"type": "dorm", "ref_id": 10, "date_from": "2027-01-12", "date_to": "2027-01-15", "guests": 1},
    {"type": "buddy", "ref_id": 31, "date": "2027-01-13", "time": "14:00", "duration_min": 60, "album": True},
]
TOTAL = 105000 + 15000 + 5000  # 숙박 + 버디 1시간 + 앨범


@pytest.fixture
def booking(client, tourist, reset_db):
    r = client.post("/api/v1/bookings", json={"traveler": TRAVELER, "items": ITEMS}, headers=tourist)
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture
def toss_on(monkeypatch):
    """시크릿 키를 넣고 토스 API 호출을 기록하는 가짜로 바꾼다"""
    monkeypatch.setattr(get_settings(), "toss_secret_key", "test_gsk_dummy")
    calls: dict[str, list] = {"confirm": [], "cancel": []}

    def fake_confirm(payment_key, order_id, amount):
        calls["confirm"].append((payment_key, order_id, amount))
        if payment_key == "pk_fail":
            raise toss.TossError(400, "REJECT_CARD_COMPANY", "카드사에서 거절했습니다")
        return {"paymentKey": payment_key, "orderId": order_id, "status": "DONE", "method": "카드", "totalAmount": amount,
                "approvedAt": "2026-11-06T10:00:00+09:00", "receipt": {"url": "https://dashboard.tosspayments.com/receipt/x"}}

    def fake_cancel(payment_key, reason, amount=None):
        calls["cancel"].append((payment_key, reason, amount))
        return {"paymentKey": payment_key, "status": "CANCELED" if amount is None else "PARTIAL_CANCELED"}

    monkeypatch.setattr(toss, "confirm", fake_confirm)
    monkeypatch.setattr(toss, "cancel", fake_cancel)
    return calls


def test_mock_pay_without_key(client, tourist, booking):
    r = client.post(f"/api/v1/bookings/{booking['id']}/pay", headers=tourist)
    assert r.status_code == 200 and r.json()["payment"] == {"method": "mock", "amount": TOTAL}
    b = client.get(f"/api/v1/bookings/{booking['id']}", headers=tourist).json()
    assert b["paid_at"] and b["payment"]["status"] == "DONE" and b["payment"]["provider"] == "mock"
    # 이미 결제된 예약은 주문을 다시 만들 수 없다
    assert client.post("/api/v1/payments/prepare", json={"booking_id": booking["id"]}, headers=tourist).status_code == 409


def test_toss_prepare_confirm(client, tourist, booking, toss_on):
    bid = booking["id"]
    assert client.post(f"/api/v1/bookings/{bid}/pay", headers=tourist).json()["error"]["code"] == "USE_PAYMENT_WIDGET"

    r = client.post("/api/v1/payments/prepare", json={"booking_id": bid}, headers=tourist)
    assert r.status_code == 200, r.text
    order = r.json()
    assert order["enabled"] is True and order["amount"] == TOTAL and 6 <= len(order["order_id"]) <= 64
    assert order["customer_email"] == "emma@example.com" and 22 <= len(order["customer_key"]) <= 50
    # 다시 prepare 하면 같은 주문을 재사용
    assert client.post("/api/v1/payments/prepare", json={"booking_id": bid}, headers=tourist).json()["order_id"] == order["order_id"]

    # 금액을 바꾸면 토스에 승인 요청조차 하지 않는다
    bad = client.post("/api/v1/payments/confirm", json={"payment_key": "pk_1", "order_id": order["order_id"], "amount": 100}, headers=tourist)
    assert bad.status_code == 400 and bad.json()["error"]["code"] == "AMOUNT_MISMATCH" and toss_on["confirm"] == []

    ok = client.post("/api/v1/payments/confirm", json={"payment_key": "pk_1", "order_id": order["order_id"], "amount": TOTAL}, headers=tourist)
    assert ok.status_code == 200, ok.text
    assert ok.json()["payment"]["status"] == "DONE" and ok.json()["payment"]["method"] == "카드" and ok.json()["paid_at"]
    # 새로고침으로 한 번 더 와도 승인 요청은 1번
    again = client.post("/api/v1/payments/confirm", json={"payment_key": "pk_1", "order_id": order["order_id"], "amount": TOTAL}, headers=tourist)
    assert again.status_code == 200 and len(toss_on["confirm"]) == 1

    pay = client.get(f"/api/v1/payments/bookings/{bid}", headers=tourist).json()["payment"]
    assert pay["receipt_url"].startswith("https://") and pay["provider"] == "toss"


def test_toss_confirm_failure(client, tourist, booking, toss_on):
    order = client.post("/api/v1/payments/prepare", json={"booking_id": booking["id"]}, headers=tourist).json()
    r = client.post("/api/v1/payments/confirm", json={"payment_key": "pk_fail", "order_id": order["order_id"], "amount": TOTAL}, headers=tourist)
    assert r.status_code == 400 and r.json()["error"]["code"] == "REJECT_CARD_COMPANY"
    assert client.get(f"/api/v1/bookings/{booking['id']}", headers=tourist).json()["paid_at"] is None
    # 실패한 주문 뒤에는 새 주문으로 다시 결제할 수 있다
    order2 = client.post("/api/v1/payments/prepare", json={"booking_id": booking["id"]}, headers=tourist).json()
    assert order2["order_id"] != order["order_id"]


def test_cancel_refunds_toss_payment(client, tourist, booking, toss_on):
    bid = booking["id"]
    order = client.post("/api/v1/payments/prepare", json={"booking_id": bid}, headers=tourist).json()
    client.post("/api/v1/payments/confirm", json={"payment_key": "pk_2", "order_id": order["order_id"], "amount": TOTAL}, headers=tourist)
    r = client.post(f"/api/v1/bookings/{bid}/cancel", json={"reason": "일정 변경"}, headers=tourist)
    assert r.status_code == 200 and r.json()["status"] == "cancelled"
    # 첫 일정(2027-01-12)까지 7일 넘게 남아 전액 환불 → cancelAmount 없이 요청
    assert toss_on["cancel"] == [("pk_2", "일정 변경", None)]
    assert r.json()["payment"]["status"] == "CANCELED" and r.json()["payment"]["canceled_amount"] == TOTAL


def test_other_user_cannot_pay(client, booking, buddy):
    assert client.post("/api/v1/payments/prepare", json={"booking_id": booking["id"]}, headers=buddy).status_code == 403


def test_refund_rate_policy():
    class B:  # refund_rate는 날짜만 본다
        pass

    class I:
        def __init__(self, d):
            self.date_from = d

    items = [I(date(2027, 1, 12))]
    assert ps.refund_rate(B(), items, today=date(2027, 1, 5)) == 1.0
    assert ps.refund_rate(B(), items, today=date(2027, 1, 9)) == 0.5
    assert ps.refund_rate(B(), items, today=date(2027, 1, 10)) == 0.0


# ---------- PayPal (외국인 결제, USD)
@pytest.fixture
def paypal_on(monkeypatch):
    from app.services import paypal

    s = get_settings()
    monkeypatch.setattr(s, "paypal_client_id", "sb-client")
    monkeypatch.setattr(s, "paypal_client_secret", "sb-secret")
    monkeypatch.setattr(s, "usd_krw_rate", 1400.0)
    calls: dict[str, list] = {"create": [], "capture": [], "refund": []}

    def fake_create(order_id, usd, description):
        calls["create"].append((order_id, usd))
        return {"id": f"PP-{order_id}", "status": "CREATED"}

    def fake_capture(pp_id):
        calls["capture"].append(pp_id)
        usd = paypal.usd_for(TOTAL)
        value = "1.00" if pp_id.endswith("tamper") else usd
        return {"id": pp_id, "status": "COMPLETED", "purchase_units": [{"payments": {"captures": [
            {"id": f"CAP-{pp_id}", "status": "COMPLETED", "amount": {"currency_code": "USD", "value": value}, "create_time": "2026-11-06T01:00:00Z"}]}}]}

    def fake_refund(capture_id, usd=None):
        calls["refund"].append((capture_id, usd))
        return {"id": "RF-1", "status": "COMPLETED"}

    monkeypatch.setattr(paypal, "create_order", fake_create)
    monkeypatch.setattr(paypal, "capture", fake_capture)
    monkeypatch.setattr(paypal, "refund", fake_refund)
    return calls


def test_usd_conversion(monkeypatch):
    from app.services import paypal

    monkeypatch.setattr(get_settings(), "usd_krw_rate", 1400.0)
    assert paypal.usd_for(125000) == "89.29"  # 89.2857… 센트 올림
    assert paypal.usd_for(140000) == "100.00"


def test_paypal_order_capture_refund(client, tourist, booking, paypal_on):
    bid = booking["id"]
    m = client.get("/api/v1/payments/methods").json()
    assert m["paypal"] is True and m["toss"] is False
    assert client.post(f"/api/v1/bookings/{bid}/pay", headers=tourist).json()["error"]["code"] == "USE_PAYMENT_WIDGET"

    o = client.post("/api/v1/payments/paypal/orders", json={"booking_id": bid}, headers=tourist).json()
    assert o["currency"] == "USD" and o["usd_amount"] == "89.29" and o["amount"] == TOTAL and o["paypal_order_id"].startswith("PP-")

    c = client.post("/api/v1/payments/paypal/capture", json={"paypal_order_id": o["paypal_order_id"]}, headers=tourist)
    assert c.status_code == 200, c.text
    pay = c.json()["payment"]
    assert pay["status"] == "DONE" and pay["provider"] == "paypal" and pay["foreign_amount"] == "89.29" and c.json()["paid_at"]
    # 두 번 캡처해도 PayPal 호출은 1번
    client.post("/api/v1/payments/paypal/capture", json={"paypal_order_id": o["paypal_order_id"]}, headers=tourist)
    assert len(paypal_on["capture"]) == 1

    r = client.post(f"/api/v1/bookings/{bid}/cancel", json={"reason": "change of plans"}, headers=tourist)
    assert r.status_code == 200 and r.json()["payment"]["status"] == "CANCELED"
    assert paypal_on["refund"] == [(f"CAP-{o['paypal_order_id']}", None)]  # 7일 넘게 남아 전액


def test_paypal_capture_amount_mismatch(client, tourist, booking, paypal_on, monkeypatch):
    from app.services import paypal

    real_create = paypal.create_order
    monkeypatch.setattr(paypal, "create_order", lambda oid, usd, d: {**real_create(oid, usd, d), "id": f"PP-{oid}-tamper"})
    o = client.post("/api/v1/payments/paypal/orders", json={"booking_id": booking["id"]}, headers=tourist).json()
    c = client.post("/api/v1/payments/paypal/capture", json={"paypal_order_id": o["paypal_order_id"]}, headers=tourist)
    assert c.status_code == 400 and c.json()["error"]["code"] == "CAPTURE_MISMATCH"
    assert client.get(f"/api/v1/bookings/{booking['id']}", headers=tourist).json()["paid_at"] is None


def test_paypal_partial_refund(db, client, tourist, booking, paypal_on, monkeypatch):
    """첫 일정 3~6일 전 취소 → 달러로 50% 환불"""
    o = client.post("/api/v1/payments/paypal/orders", json={"booking_id": booking["id"]}, headers=tourist).json()
    client.post("/api/v1/payments/paypal/capture", json={"paypal_order_id": o["paypal_order_id"]}, headers=tourist)
    monkeypatch.setattr(ps, "refund_rate", lambda b, items, today=None: 0.5)
    r = client.post(f"/api/v1/bookings/{booking['id']}/cancel", json={}, headers=tourist)
    assert r.status_code == 200 and r.json()["payment"]["status"] == "PARTIAL_CANCELED"
    assert r.json()["payment"]["canceled_amount"] == TOTAL // 2
    assert paypal_on["refund"][-1][1] == "44.64"  # 89.29 × 0.5 내림


def test_auto_refund_after_a_day(db, client, tourist, booking, toss_on):
    """테스트 결제는 결제 후 24시간이 지나면 전액 자동 환불, 예약은 미결제로"""
    from datetime import UTC, datetime, timedelta

    order = client.post("/api/v1/payments/prepare", json={"booking_id": booking["id"]}, headers=tourist).json()
    client.post("/api/v1/payments/confirm", json={"payment_key": "pk_auto", "order_id": order["order_id"], "amount": TOTAL}, headers=tourist)
    approved = datetime.fromisoformat("2026-11-06T10:00:00+09:00")
    assert ps.auto_refund_due(db, 24, now=approved + timedelta(hours=23)) == []  # 아직 하루 안 됨
    ids = ps.auto_refund_due(db, 24, now=approved + timedelta(hours=25))
    assert len(ids) == 1 and toss_on["cancel"] == [("pk_auto", "테스트 결제 자동 환불", None)]
    b = client.get(f"/api/v1/bookings/{booking['id']}", headers=tourist).json()
    assert b["paid_at"] is None and b["status"] != "cancelled" and b["payment"]["status"] == "CANCELED"
    assert ps.auto_refund_due(db, 24, now=datetime.now(UTC) + timedelta(days=3)) == []  # 두 번 환불하지 않음


def test_auto_refund_skips_live_keys(db, client, tourist, booking, toss_on, monkeypatch):
    from datetime import UTC, datetime, timedelta

    order = client.post("/api/v1/payments/prepare", json={"booking_id": booking["id"]}, headers=tourist).json()
    client.post("/api/v1/payments/confirm", json={"payment_key": "pk_live", "order_id": order["order_id"], "amount": TOTAL}, headers=tourist)
    monkeypatch.setattr(get_settings(), "toss_secret_key", "live_gsk_dummy")
    assert ps.auto_refund_due(db, 24, now=datetime.now(UTC) + timedelta(days=30)) == [] and toss_on["cancel"] == []
