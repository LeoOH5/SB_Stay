"""LLM 호출은 전부 여기로 (A 담당). 타임아웃 20초, 실패 시 폴백은 호출부에서.

원칙: 운영시간·가격·좌표 같은 사실은 DB 값만, LLM은 선택·순서·설명만. 응답은 JSON → Pydantic 검증.
"""
from app.core.config import get_settings


async def complete_json(system: str, user: str) -> dict:
    """TODO(A): LLM API 호출. settings.llm_api_key / llm_model 사용. 실패 시 예외를 올려 호출부가 폴백."""
    settings = get_settings()
    if not settings.llm_api_key:
        raise RuntimeError("LLM_API_KEY 미설정")
    raise NotImplementedError
