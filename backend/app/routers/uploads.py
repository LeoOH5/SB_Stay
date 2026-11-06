"""사진 올리기 UP-01 (v3.6) · 사진 보기 /media.

POST /api/v1/uploads (로그인한 사용자, multipart `file`) → 201 {url, content_type, size}
- JPEG · PNG · WebP만, 10 MB까지. 종류는 매직 바이트로 확인(확장자를 바꾼 다른 파일 거절).
- 저장은 services/storage (나중에 객체 저장소로 바꿀 자리).
GET /media/<yyyy>/<mm>/<uuid hex>.<ext> — 저장한 사진. 이름 규칙에 맞는 파일만, 폴더 목록 없음.
"""
from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.core.deps import get_current_user
from app.core.errors import api_error
from app.models.user import User
from app.services import storage

router = APIRouter(prefix="/uploads", tags=["uploads"])
media = APIRouter(tags=["uploads"])


class UploadOut(BaseModel):
    url: str  # /media/... (백엔드 주소 기준)
    content_type: str
    size: int


@router.post("", response_model=UploadOut, status_code=201)
async def upload(file: UploadFile = File(...), user: User = Depends(get_current_user)) -> UploadOut:
    """사진 한 장 올리기. 활동 기록·식비 영수증·신고에는 여기서 받은 url을 넣는다."""
    data = await file.read(storage.MAX_BYTES + 1)
    if len(data) > storage.MAX_BYTES:
        raise api_error(413, "FILE_TOO_LARGE", "사진은 10MB까지 올릴 수 있어요")
    if not data:
        raise api_error(422, "EMPTY_FILE", "빈 파일이에요")
    ext = storage.sniff(data)
    if not ext:
        raise api_error(415, "UNSUPPORTED_TYPE", "JPG · PNG · WebP 사진만 올릴 수 있어요")
    s = storage.save(data, ext)
    return UploadOut(url=s.url, content_type=s.content_type, size=s.size)


@media.get("/media/{year}/{month}/{name}", include_in_schema=False)
def serve(year: str, month: str, name: str) -> FileResponse:
    path = storage.path_for(f"/media/{year}/{month}/{name}")
    if not path or not path.is_file():
        raise api_error(404, "NOT_FOUND", "사진이 없어요")
    ext = path.suffix[1:]
    return FileResponse(path, media_type=storage.CONTENT_TYPES[ext],
                        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=86400"})
