"""캘린더 단방향 푸시: 버디 수락 시 이벤트 생성, 취소 시 삭제. 구글 API는 monkeypatch."""
from app.services import google_calendar, google_oauth
from tests.conftest import login


def _connect(client, buddy, monkeypatch):
    monkeypatch.setattr(google_oauth, "exchange_code", lambda code, redirect_uri=None: google_oauth.GoogleTokens("at", "rt", "https://www.googleapis.com/auth/calendar.events"))
    assert client.post("/api/v1/auth/google/calendar", json={"code": "c"}, headers=buddy).json()["calendar_connected"] is True


def test_push_on_accept_and_delete_on_cancel(client, buddy, tourist, monkeypatch, reset_db):
    _connect(client, buddy, monkeypatch)
    calls: list[tuple] = []
    monkeypatch.setattr(google_calendar, "push_event", lambda **kw: (calls.append(("push", kw)), "evt_123")[1])
    monkeypatch.setattr(google_calendar, "delete_event", lambda **kw: calls.append(("delete", kw)))
    r = client.patch("/api/v1/bookings/502/items/5", json={"action": "approve"}, headers=buddy)  # Yuki → 지우 요청
    assert r.status_code == 200 and r.json()["google_event_id"] == "evt_123"
    assert calls[0][0] == "push" and calls[0][1]["summary"].startswith("[SB Stay]") and calls[0][1]["duration_min"] == 120
    client.post("/api/v1/bookings/502/cancel", headers=login(client, "yuki@example.com"))
    assert calls[-1] == ("delete", {"refresh_token_enc": calls[0][1]["refresh_token_enc"], "event_id": "evt_123"})


def test_push_failure_does_not_block_approval(client, buddy, monkeypatch, reset_db):
    _connect(client, buddy, monkeypatch)

    def boom(**kw):
        raise RuntimeError("google down")
    monkeypatch.setattr(google_calendar, "push_event", boom)
    r = client.patch("/api/v1/bookings/502/items/5", json={"action": "approve"}, headers=buddy)
    assert r.status_code == 200 and r.json()["status"] == "confirmed" and r.json()["google_event_id"] is None


def test_no_push_when_not_connected(client, buddy, monkeypatch, reset_db):
    called = []
    monkeypatch.setattr(google_calendar, "push_event", lambda **kw: called.append(1) or "x")
    r = client.patch("/api/v1/bookings/502/items/5", json={"action": "approve"}, headers=buddy)
    assert r.status_code == 200 and called == []


def test_event_body_shape(monkeypatch):
    """실제 HTTP 대신 httpx.post를 가로채 본문 형식 확인"""
    from datetime import date

    import httpx

    captured = {}

    class R:
        status_code = 200
        def raise_for_status(self): pass
        def json(self): return {"id": "evt_1"}
    monkeypatch.setattr(google_calendar, "_access_token", lambda enc: "tok")
    monkeypatch.setattr(httpx, "post", lambda url, json, headers, timeout: captured.update(url=url, body=json, headers=headers) or R())
    eid = google_calendar.push_event(refresh_token_enc="enc", summary="[SB Stay] 지우와 동네 걷기", date_=date(2027, 1, 13), time_="14:00", duration_min=120)
    assert eid == "evt_1" and captured["body"]["start"]["dateTime"] == "2027-01-13T14:00:00" and captured["body"]["end"]["dateTime"] == "2027-01-13T16:00:00"
    assert captured["body"]["start"]["timeZone"] == "Asia/Seoul" and captured["headers"]["Authorization"] == "Bearer tok"
