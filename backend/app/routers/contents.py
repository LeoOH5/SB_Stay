"""HM-01 추천 패키지 · CM-01 정적 콘텐츠 (A 담당) — 구현 전까지 501."""
from fastapi import APIRouter

from app.core.errors import api_error

router = APIRouter(tags=["contents"])


@router.get("/packages")
def list_packages() -> dict:
    """HM-01"""
    raise api_error(501, "NOT_IMPLEMENTED", "docs/api-detail/HM-01.md 대로 구현 예정")


@router.get("/contents/{key}")
def get_content(key: str) -> dict:
    """CM-01"""
    raise api_error(501, "NOT_IMPLEMENTED", "docs/api-detail/CM-01.md 대로 구현 예정")
