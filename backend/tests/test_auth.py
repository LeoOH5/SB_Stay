from app.services import google_oauth


def test_health(client):
    assert client.get("/health").json()["ok"] is True


def test_demo_login_and_me(client, tourist):
    r = client.get("/api/v1/auth/me", headers=tourist)
    assert r.status_code == 200
    assert r.json()["role"] == "tourist"


def test_login_wrong_password(client):
    r = client.post("/api/v1/auth/login", json={"email": "emma@example.com", "password": "nope"})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "UNAUTHORIZED"


def test_me_without_token(client):
    assert client.get("/api/v1/auth/me").status_code == 401


def test_signup_and_role(client, reset_db):
    r = client.post("/api/v1/auth/signup", json={"name": "New", "email": "new@example.com", "password": "password1", "language": "en"})
    assert r.status_code == 201
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    assert client.post("/api/v1/auth/signup", json={"name": "New", "email": "new@example.com", "password": "password1"}).status_code == 409
    assert client.patch("/api/v1/auth/me/role", json={"role": "guide", "university_id": 1}, headers=h).status_code == 422  # v3: 해설사 없음
    r = client.patch("/api/v1/auth/me/role", json={"role": "buddy"}, headers=h)  # 대학은 학교 메일 인증에서 정해짐
    assert r.status_code == 200 and r.json()["role"] == "buddy" and r.json()["university_id"] is None
    r = client.patch("/api/v1/auth/me/role", json={"role": "buddy", "university_id": 1}, headers=h)
    assert r.status_code == 200 and r.json()["university_id"] == 1


def test_admin_cannot_change_role(client, univ_admin):
    assert client.patch("/api/v1/auth/me/role", json={"role": "tourist"}, headers=univ_admin).status_code == 409


def test_update_language(client, tourist, reset_db):
    r = client.patch("/api/v1/auth/me", json={"language": "ko"}, headers=tourist)
    assert r.json()["language"] == "ko"
    assert client.patch("/api/v1/auth/me", json={"language": "fr"}, headers=tourist).status_code == 422


def test_google_login_first_time(client, monkeypatch, reset_db):
    monkeypatch.setattr(google_oauth, "exchange_code", lambda code, redirect_uri=None: google_oauth.GoogleTokens("at", None, "openid email"))
    monkeypatch.setattr(google_oauth, "fetch_profile", lambda at: google_oauth.GoogleProfile(sub="g-1", email="g1@gmail.com", name="G One", picture="p"))
    r = client.post("/api/v1/auth/google", json={"code": "abc"})
    assert r.status_code == 200
    assert r.json()["needs_role_setup"] is True and r.json()["user"]["role"] == "tourist"
    # 두 번째 로그인은 역할 설정 불필요
    r = client.post("/api/v1/auth/google", json={"code": "abc"})
    assert r.json()["needs_role_setup"] is False


def test_google_login_links_demo_account(client, monkeypatch, reset_db):
    monkeypatch.setattr(google_oauth, "profile_from_id_token", lambda t: google_oauth.GoogleProfile(sub="g-jiwoo", email="jiwoo@a-univ.ac.kr", name="지우"))
    r = client.post("/api/v1/auth/google", json={"id_token": "x"})
    assert r.status_code == 200 and r.json()["user"]["role"] == "buddy" and r.json()["needs_role_setup"] is False


def test_google_login_failure(client, monkeypatch):
    def boom(code, redirect_uri=None):
        raise google_oauth.GoogleOAuthError("bad code")
    monkeypatch.setattr(google_oauth, "exchange_code", boom)
    assert client.post("/api/v1/auth/google", json={"code": "bad"}).status_code == 401


def test_calendar_connect_and_disconnect(client, buddy, tourist, monkeypatch, reset_db):
    monkeypatch.setattr(google_oauth, "exchange_code", lambda code, redirect_uri=None: google_oauth.GoogleTokens("at", "rt-secret", "https://www.googleapis.com/auth/calendar.events"))
    assert client.post("/api/v1/auth/google/calendar", json={"code": "c"}, headers=tourist).status_code == 403
    r = client.post("/api/v1/auth/google/calendar", json={"code": "c"}, headers=buddy)
    assert r.status_code == 200 and r.json()["calendar_connected"] is True
    assert client.get("/api/v1/auth/me", headers=buddy).json()["calendar_connected"] is True
    r = client.delete("/api/v1/auth/google/calendar", headers=buddy)
    assert r.json()["calendar_connected"] is False


def test_demo_accounts_cannot_change_role(client, tourist):
    """심사 중 데모 계정(Emma 등)이 버디로 바뀌어 데모 시나리오가 깨지지 않게 막는다"""
    r = client.patch("/api/v1/auth/me/role", json={"role": "buddy"}, headers=tourist)
    assert r.status_code == 409 and r.json()["error"]["code"] == "DEMO_LOCKED"
    assert client.get("/api/v1/auth/me", headers=tourist).json()["role"] == "tourist"


def test_back_to_tourist_drops_pending_application(client, reset_db):
    """버디로 바꿔 지원(승인 대기)하다 여행자로 돌아가면 지원서가 지워져 운영자 승인 대기 목록에 남지 않는다"""
    from tests.conftest import login
    r = client.post("/api/v1/auth/signup", json={"name": "Back", "email": "back@example.org", "password": "password1"})
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    client.patch("/api/v1/auth/me/role", json={"role": "buddy"}, headers=h)
    v = client.post("/api/v1/buddy/apply/verify", json={"email": "back@korea.ac.kr", "code": "123456", "birth_date": "2003-01-01", "korean_national": True}, headers=h)
    assert v.status_code == 200 and v.json()["status"] == "pending"
    op = login(client, "operator@sbstay.app")
    names = lambda: [b["name"] for b in client.get("/api/v1/admin/buddies", params={"status": "pending"}, headers=op).json()["items"]]
    assert "Back" in names()
    r = client.patch("/api/v1/auth/me/role", json={"role": "tourist"}, headers=h)
    assert r.status_code == 200 and r.json()["role"] == "tourist" and r.json()["university_id"] is None
    assert "Back" not in names()
