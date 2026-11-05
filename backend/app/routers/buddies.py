"""BD-01~07 버디 (목록·상세 A, 프로필·일정·요청함 B) — 경로·응답 형식은 docs/api-detail/*.md 기준. 구현 전까지 501."""
from fastapi import APIRouter

from app.core.errors import api_error

router = APIRouter(prefix="/buddies", tags=["buddies"])


@router.get("/_todo")
def todo() -> dict:
    raise api_error(501, "NOT_IMPLEMENTED", "docs/api-detail 명세대로 구현 예정")
