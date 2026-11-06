"""v3.6 사진 올리기 (POST /uploads) · 보기 (/media) · 사진 값 검사"""
import re

from app.services import storage
from tests.conftest import TINY_PNG, login, upload_png

URL = "/api/v1/uploads"


def _up(client, headers, data, name="a.png", ctype="image/png"):
    return client.post(URL, files={"file": (name, data, ctype)}, headers=headers)


def test_upload_png_and_serve(client, buddy):
    r = _up(client, buddy, TINY_PNG)
    assert r.status_code == 201, r.text
    j = r.json()
    assert re.fullmatch(r"/media/\d{4}/\d{2}/[0-9a-f]{32}\.png", j["url"]) and j["content_type"] == "image/png" and j["size"] == len(TINY_PNG)
    got = client.get(j["url"])  # 백엔드 주소 기준, 로그인 없이 (주소가 곧 열쇠)
    assert got.status_code == 200 and got.content == TINY_PNG and got.headers["content-type"] == "image/png"
    assert got.headers["x-content-type-options"] == "nosniff"
    assert _up(client, buddy, TINY_PNG).json()["url"] != j["url"]  # 같은 파일도 매번 새 이름


def test_upload_detects_type_by_bytes(client, tourist):
    jpg = b"\xff\xd8\xff\xe0" + b"\x00" * 20
    webp = b"RIFF\x10\x00\x00\x00WEBPVP8 " + b"\x00" * 8
    assert _up(client, tourist, jpg, "x.png", "image/png").json()["url"].endswith(".jpg")  # 확장자보다 내용
    assert _up(client, tourist, webp, "x.webp", "image/webp").json()["url"].endswith(".webp")


def test_upload_rejects_text_renamed_png(client, buddy):
    r = _up(client, buddy, b"hello, I am not a picture", "evil.png", "image/png")
    assert r.status_code == 415 and r.json()["error"]["code"] == "UNSUPPORTED_TYPE"
    gif = b"GIF89a" + b"\x00" * 10
    assert _up(client, buddy, gif, "a.gif", "image/gif").status_code == 415
    assert _up(client, buddy, b"", "a.png").status_code == 422


def test_upload_rejects_over_10mb(client, buddy):
    big = TINY_PNG + b"\x00" * (storage.MAX_BYTES - len(TINY_PNG) + 1)
    r = _up(client, buddy, big)
    assert r.status_code == 413 and r.json()["error"]["code"] == "FILE_TOO_LARGE"
    assert _up(client, buddy, TINY_PNG + b"\x00" * (storage.MAX_BYTES - len(TINY_PNG))).status_code == 201  # 딱 10MB는 됨


def test_upload_requires_login(client):
    assert _up(client, {}, TINY_PNG).status_code == 401


def test_media_only_our_names(client):
    assert client.get("/media/2027/01/" + "0" * 32 + ".png").status_code == 404  # 없는 파일
    assert client.get("/media/2027/01/../../etc/passwd").status_code == 404
    assert client.get("/media/2027/01/").status_code == 404  # 목록 보기 없음
    assert client.get("/media/2027/01/notes.txt").status_code == 404


def test_new_photos_must_be_our_media_urls(client, buddy, tourist, reset_db):
    """활동 기록·식비 영수증·신고 사진: 외부 URL·파일 이름은 거절, /uploads 주소만"""
    body = {"item_id": 3, "date": "2027-01-13", "places": ["심우장"]}
    for bad in ("https://evil.example.com/a.jpg", "photo1.jpg", "/media/2027/01/" + "a" * 32 + ".jpg", "/media/../secret.png"):
        r = client.post("/api/v1/buddy/activities", json=body | {"photos": [bad]}, headers=buddy)
        assert r.status_code == 422 and r.json()["error"]["code"] == "PHOTO_URL", bad
    ok = upload_png(client, buddy)
    assert client.post("/api/v1/buddy/activities", json=body | {"photos": [ok]}, headers=buddy).status_code == 201
    claim = {"item_id": 3, "place": "식당", "amount": 10000}
    assert client.post("/api/v1/buddy/meal-claims", json=claim | {"receipt_url": "https://x.io/r.png"}, headers=buddy).status_code == 422
    r = client.post("/api/v1/buddy/meal-claims", json=claim | {"receipt_url": ok}, headers=buddy)
    assert r.status_code == 201 and r.json()["receipt_url"] == ok
    rep = {"booking_item_id": 3, "category": "other", "text": "확인 부탁해요"}
    assert client.post("/api/v1/reports", json=rep | {"photo_url": "http://x.io/a.png"}, headers=tourist).status_code == 422
    mine = upload_png(client, login(client, "emma@example.com"))
    r = client.post("/api/v1/reports", json=rep | {"photo_url": mine}, headers=tourist)
    assert r.status_code == 201 and r.json()["photo_url"] == mine


def test_old_seed_names_still_listed(client, tourist):
    """시드의 예전 값(파일 이름)은 그대로 보인다 — 화면은 /media가 아니면 자리 표시 타일"""
    photos = client.get("/api/v1/bookings/501/album", headers=tourist).json()["items"][0]["photos"]
    assert photos and not any(p.startswith("/media/") for p in photos)
