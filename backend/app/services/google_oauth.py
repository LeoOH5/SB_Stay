"""구글 OAuth (AU-01 로그인, AU-07 캘린더 증분 인증).

- 로그인: authorization code → 토큰 교환 → userinfo (sub, email, name, picture)
- 캘린더: scope=calendar.events 로 받은 code → refresh_token 확보 (access_type=offline, prompt=consent 필요)
구글 콘솔은 테스트 모드, 데모 계정을 테스트 사용자로 등록해야 동의 화면을 통과한다.
"""
from dataclasses import dataclass

import httpx

from app.core.config import get_settings

TOKEN_URL = "https://oauth2.googleapis.com/token"
USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"


@dataclass
class GoogleProfile:
    sub: str
    email: str
    name: str
    picture: str | None = None


@dataclass
class GoogleTokens:
    access_token: str
    refresh_token: str | None
    scope: str


class GoogleOAuthError(Exception):
    pass


def exchange_code(code: str, redirect_uri: str | None = None) -> GoogleTokens:
    s = get_settings()
    if not s.google_client_id or not s.google_client_secret:
        raise GoogleOAuthError("GOOGLE_CLIENT_ID/SECRET 미설정")
    data = {
        "code": code,
        "client_id": s.google_client_id,
        "client_secret": s.google_client_secret,
        "redirect_uri": redirect_uri or s.google_redirect_uri,
        "grant_type": "authorization_code",
    }
    r = httpx.post(TOKEN_URL, data=data, timeout=10)
    if r.status_code != 200:
        raise GoogleOAuthError(f"token exchange failed: {r.text[:200]}")
    j = r.json()
    return GoogleTokens(access_token=j["access_token"], refresh_token=j.get("refresh_token"), scope=j.get("scope", ""))


def fetch_profile(access_token: str) -> GoogleProfile:
    r = httpx.get(USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"}, timeout=10)
    if r.status_code != 200:
        raise GoogleOAuthError("userinfo failed")
    j = r.json()
    return GoogleProfile(sub=j["sub"], email=j["email"], name=j.get("name") or j["email"].split("@")[0], picture=j.get("picture"))


def profile_from_id_token(id_token: str) -> GoogleProfile:
    """프론트가 Google Identity Services로 받은 id_token을 쓰는 경우. tokeninfo로 검증한다."""
    r = httpx.get(TOKENINFO_URL, params={"id_token": id_token}, timeout=10)
    if r.status_code != 200:
        raise GoogleOAuthError("id_token 검증 실패")
    j = r.json()
    if j.get("aud") != get_settings().google_client_id:
        raise GoogleOAuthError("id_token aud 불일치")
    return GoogleProfile(sub=j["sub"], email=j["email"], name=j.get("name") or j["email"].split("@")[0], picture=j.get("picture"))


def refresh_access_token(refresh_token: str) -> str:
    s = get_settings()
    r = httpx.post(TOKEN_URL, data={"client_id": s.google_client_id, "client_secret": s.google_client_secret, "refresh_token": refresh_token, "grant_type": "refresh_token"}, timeout=10)
    if r.status_code != 200:
        raise GoogleOAuthError("refresh failed")
    return r.json()["access_token"]
