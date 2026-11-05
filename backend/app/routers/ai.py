"""AI-01~05 (A 담당) — 경로·응답 형식은 docs/api-detail/AI-*.md 기준.

LLM은 services/llm.py로만 부른다. 키가 없거나 실패하면 규칙 기반 폴백으로 같은 모양의 응답을 돌려준다.
"""
import secrets

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import require_role
from app.core.errors import api_error
from app.models import AiPlan, User
from app.schemas.ai import PlanIn, PlanOut
from app.services import llm, planner

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/plan", response_model=PlanOut)
async def plan(body: PlanIn, user: User = Depends(require_role("tourist")), db: Session = Depends(get_db)) -> PlanOut:
    """AI-01 여행 설계. 후보는 DB에서 거르고(날짜·가격·운영일), LLM은 고르기·설명만. 예약은 BK-01에서 따로."""
    if body.check_out <= body.check_in:
        raise api_error(422, "VALIDATION", "check_out은 check_in 뒤여야 합니다")
    if (body.check_out - body.check_in).days > 14:
        raise api_error(422, "VALIDATION", "최대 14박까지 설계할 수 있습니다")
    if body.language not in ("ko", "en"):
        body.language = "en"

    cands = planner.build_candidates(db, body)
    used_ai = False
    try:
        system, prompt = planner.llm_prompt(cands, body)
        choice = planner.validate_choice(cands, await llm.complete_json(system, prompt))
        used_ai = True
    except llm.LLMUnavailable:
        choice = planner.fallback_choice(cands)

    days, total, reason = planner.assemble(cands, choice, body)
    out = PlanOut(plan_id="pl_" + secrets.token_hex(3), reason=reason, total_price=total, days=days, ai=used_ai)
    db.add(AiPlan(id=out.plan_id, user_id=user.id, request=body.model_dump(mode="json"), result=out.model_dump(mode="json")))
    db.commit()
    return out
