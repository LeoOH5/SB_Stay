"""LLM 호출은 전부 여기로 (A 담당). 타임아웃 20초, 재시도 1회, 실패하면 예외 → 호출부가 폴백.

원칙: 운영시간·가격·좌표 같은 사실은 DB 값만, LLM은 선택·순서·설명만. 응답은 JSON → 호출부에서 검증.

지원 API
- 모델명이 claude- 로 시작: Anthropic Messages API
- 그 외: OpenAI 호환 Chat Completions (LLM_BASE_URL, 비우면 OpenAI). Gemini·Upstage 등 OpenAI 호환 주소도 그대로 쓴다.
"""
import json
import logging
import re

import httpx

from app.core.config import get_settings

log = logging.getLogger(__name__)


class LLMUnavailable(RuntimeError):
    """키·모델이 없거나 호출이 실패해 폴백해야 할 때"""


def enabled() -> bool:
    s = get_settings()
    return bool(s.llm_api_key and s.llm_model)


def _extract_json(text: str) -> dict:
    """```json 펜스나 앞뒤 설명이 섞여 와도 첫 { 부터 마지막 } 까지를 JSON으로 읽는다."""
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("JSON 객체가 없습니다")
    return json.loads(text[start : end + 1])


async def _call(client: httpx.AsyncClient, system: str, user: str) -> str:
    s = get_settings()
    if s.llm_model.startswith("claude"):
        r = await client.post(
            (s.llm_base_url or "https://api.anthropic.com").rstrip("/") + "/v1/messages",
            headers={"x-api-key": s.llm_api_key, "anthropic-version": "2023-06-01"},
            json={"model": s.llm_model, "max_tokens": 1200, "system": system,
                  "messages": [{"role": "user", "content": user}]},
        )
        r.raise_for_status()
        return "".join(b.get("text", "") for b in r.json().get("content", []))
    r = await client.post(
        (s.llm_base_url or "https://api.openai.com/v1").rstrip("/") + "/chat/completions",
        headers={"Authorization": f"Bearer {s.llm_api_key}"},
        json={"model": s.llm_model, "temperature": 0.3,
              "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]},
    )
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


async def complete_json(system: str, user: str) -> dict:
    """LLM에게 JSON 하나를 받아 dict로 돌려준다. 키가 없거나 2번 다 실패하면 LLMUnavailable."""
    if not enabled():
        raise LLMUnavailable("LLM_API_KEY / LLM_MODEL 미설정")
    s = get_settings()
    last: Exception | None = None
    async with httpx.AsyncClient(timeout=s.llm_timeout_seconds) as client:
        for _ in range(2):  # 첫 시도 + 재시도 1회
            try:
                return _extract_json(await _call(client, system, user))
            except Exception as e:  # noqa: BLE001 — 어떤 실패든 폴백으로 넘긴다
                last = e
                log.warning("LLM 호출 실패: %s", e)
    raise LLMUnavailable(str(last))
