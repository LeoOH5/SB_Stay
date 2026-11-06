"""AI-01~05 (A 담당) — 경로·응답 형식은 docs/api-detail/AI-*.md 기준.

LLM은 services/llm.py로만 부른다. 키가 없거나 실패하면 규칙 기반 폴백으로 같은 모양의 응답을 돌려준다.
"""
import secrets

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user, require_role
from app.core.errors import api_error
from app.models import AiPlan, Place, User
from app.schemas.ai import PlanIn, PlanOut, Source, StoryIn, StoryOut
from app.services import llm, planner, story

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


# 장소를 누를 때마다 같은 소개를 다시 만들지 않도록 AI가 쓴 소개만 서버 메모리에 둔다 (서버 재시작 시 비워짐)
_intro_cache: dict[tuple[int, str], tuple[str, bool]] = {}


@router.post("/story", response_model=StoryOut)
async def place_story(body: StoryIn, _: User = Depends(get_current_user), db: Session = Depends(get_db)) -> StoryOut:
    """AI-02 역사 스토리. 근거는 places.story_doc뿐. 문서 밖 질문이면 grounded=false. 출처는 항상 DB 값."""
    place = db.get(Place, body.place_id)
    if not place:
        raise api_error(404, "NOT_FOUND", "장소를 찾을 수 없습니다")
    sources = [Source(**s) for s in (place.sources or []) if s.get("title")]
    question = (body.question or "").strip() or None
    doc, _lang = story.pick_doc(story.parse(place.story_doc), body.language)
    if doc.empty():
        return StoryOut(answer=story.NO_STORY[body.language], sources=sources, grounded=False)

    key = (place.id, body.language)
    if question is None and key in _intro_cache:
        answer, grounded = _intro_cache[key]
        return StoryOut(answer=answer, sources=sources, grounded=grounded, ai=True)
    try:
        system, prompt = story.llm_prompt(place, story.clean_doc(place.story_doc), question, body.language)
        answer, grounded = story.validate_llm(await llm.complete_json(system, prompt), place.story_doc or "")
        if question is None:
            _intro_cache[key] = (answer, grounded)
        return StoryOut(answer=answer, sources=sources, grounded=grounded, ai=True)
    except (llm.LLMUnavailable, ValueError):
        answer, grounded = story.fallback_answer(doc, question, body.language)
        return StoryOut(answer=answer, sources=sources, grounded=grounded)
