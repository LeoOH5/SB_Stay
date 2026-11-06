"""사진 저장 (v3.6) — 버디 활동 사진 · 식비 영수증 · 신고 사진.

- 지금은 서버 폴더(settings.upload_dir) 아래 `<yyyy>/<mm>/<uuid4 hex>.<ext>`에 저장하고 `/media/...` 주소로 보여 준다.
- 이름은 추측할 수 없는 무작위 값이라 주소를 아는 사람만 볼 수 있다(목록 보기 없음). 데모용이다.
  운영에서는 비공개 객체 저장소 + 서명 URL + 보관 기간으로 바꾼다 → 이 파일의 save()·path_for()·exists()만 바꾸면 된다.
- 파일 종류는 확장자가 아니라 앞 몇 바이트(매직 바이트)로 확인한다: JPEG · PNG · WebP만.
"""
import re
import uuid
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from app.core.config import get_settings

MAX_BYTES = 10 * 1024 * 1024  # 10 MB
MEDIA_PREFIX = "/media/"
MEDIA_RE = re.compile(r"^/media/(\d{4})/(\d{2})/([0-9a-f]{32})\.(jpg|png|webp)$")
CONTENT_TYPES = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp"}


@dataclass
class Stored:
    url: str  # /media/2027/01/<hex>.jpg (백엔드 주소 기준 상대 경로)
    content_type: str
    size: int


def sniff(data: bytes) -> str | None:
    """매직 바이트로 확장자를 정한다. 모르는 형식이면 None"""
    if data[:3] == b"\xff\xd8\xff":
        return "jpg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def root() -> Path:
    return Path(get_settings().upload_dir).resolve()


def save(data: bytes, ext: str, today: date | None = None) -> Stored:
    """검사를 마친 바이트를 저장하고 주소를 돌려준다"""
    d = today or date.today()
    rel = f"{d.year:04d}/{d.month:02d}/{uuid.uuid4().hex}.{ext}"
    path = root() / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return Stored(url=MEDIA_PREFIX + rel, content_type=CONTENT_TYPES[ext], size=len(data))


def path_for(url: str) -> Path | None:
    """우리가 만든 /media 주소면 실제 파일 경로, 아니면 None (경로 조작 불가: 정규식으로만 조립)"""
    m = MEDIA_RE.match(url or "")
    if not m:
        return None
    y, mo, name, ext = m.groups()
    return root() / y / mo / f"{name}.{ext}"


def exists(url: str) -> bool:
    p = path_for(url)
    return bool(p and p.is_file())


def is_media_url(value: str | None) -> bool:
    """새로 받는 사진 값은 우리 /uploads가 만든, 실제로 있는 /media 주소여야 한다 (외부 URL·임의 문자열 거절)"""
    return bool(value) and exists(value)
