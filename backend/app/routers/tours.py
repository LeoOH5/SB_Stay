"""TR-01~04 투어·장소 (A 담당) — 경로·응답 형식은 docs/api-detail/*.md 기준. 구현 전까지 501."""
from fastapi import APIRouter

from app.core.errors import api_error

router = APIRouter(prefix="/tours", tags=["tours"])


@router.get("/_todo")
def todo() -> dict:
    raise api_error(501, "NOT_IMPLEMENTED", "docs/api-detail 명세대로 구현 예정")
