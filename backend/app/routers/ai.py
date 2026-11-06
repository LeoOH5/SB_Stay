"""AI-01~05 (A 담당) — 경로·응답 형식은 docs/api-detail/AI-*.md 기준.

LLM은 services/llm.py로만 부른다. 키가 없거나 실패하면 규칙 기반 폴백으로 같은 모양의 응답을 돌려준다.
"""
import secrets

from fastapi import APIRouter, Depends, Header
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import rules
from app.core.db import get_db
from app.core.deps import get_current_user, require_role
from app.core.errors import api_error
from app.models import AiPlan, BookingItem, BuddyProfile, Place, User
from app.schemas.ai import (
    BriefIn,
    BriefOut,
    BriefPlace,
    BriefRouteStop,
    MatchIn,
    MatchItem,
    MatchOut,
    NoticeIn,
    NoticeOut,
    PlanIn,
    PlanOut,
    Source,
    StoryIn,
    StoryOut,
)
from app.services import brief, courses, free_tier, llm, matcher, notice, planner, story

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/plan", response_model=PlanOut)
async def plan(body: PlanIn, user: User = Depends(require_role("tourist")), db: Session = Depends(get_db)) -> PlanOut:
    """AI-01 여행 설계. 후보는 DB에서 거르고(날짜·가격·운영일), LLM은 고르기·설명만. 예약은 BK-01에서 따로.
    숙소가 있으면 버디(숙박 기간 안)를 반드시 넣고, 코스는 무료로 버디 항목의 course_id에 붙인다."""
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
        choice = planner.validate_choice(cands, await llm.complete_json(system, prompt), body.budget)
        used_ai = True
    except llm.LLMUnavailable:
        choice = planner.fallback_choice(cands, body.budget)

    # v3.8 자유 장소 순서는 코드가 정한다 (고른 장소 사이 저장한 실제 도보 경로를 한 번에 읽음)
    routes = courses.load_routes(db, choice.free_place_ids)
    days, total, reason, warnings = planner.assemble(cands, choice, body, routes)
    out = PlanOut(plan_id="pl_" + secrets.token_hex(3), reason=reason, total_price=total, days=days, ai=used_ai,
                  warnings=warnings)
    db.add(AiPlan(id=out.plan_id, user_id=user.id, request=body.model_dump(mode="json"), result=out.model_dump(mode="json")))
    db.commit()
    return out


# 장소를 누를 때마다 같은 소개를 다시 만들지 않도록 AI가 쓴 소개만 서버 메모리에 둔다 (서버 재시작 시 비워짐)
_intro_cache: dict[tuple[int, str], tuple[str, bool]] = {}


@router.post("/story", response_model=StoryOut)
async def place_story(body: StoryIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> StoryOut:
    """AI-02 역사 스토리. 근거는 places.story_doc뿐. 문서 밖 질문이면 grounded=false. 출처는 항상 DB 값.
    v3.4: 무료 이용자(free)는 질문을 하루 3번까지 (넘으면 429 AI_LIMIT). 장소 소개(질문 없음)는 세지 않는다."""
    place = db.get(Place, body.place_id)
    if not place:
        raise api_error(404, "NOT_FOUND", "장소를 찾을 수 없습니다")
    sources = [Source(**s) for s in (place.sources or []) if s.get("title")]
    question = (body.question or "").strip() or None
    doc, _lang = story.pick_doc(story.parse(place.story_doc), body.language)
    if doc.empty():
        return StoryOut(answer=story.NO_STORY[body.language], sources=sources, grounded=False)

    left = None
    if question is not None:
        left = free_tier.use_question(db, user)
        if left == -1:
            raise api_error(429, "AI_LIMIT", AI_LIMIT_MESSAGE)
    key = (place.id, body.language)
    if question is None and key in _intro_cache:
        answer, grounded = _intro_cache[key]
        return StoryOut(answer=answer, sources=sources, grounded=grounded, ai=True)
    try:
        system, prompt = story.llm_prompt(place, story.clean_doc(place.story_doc), question, body.language)
        answer, grounded = story.validate_llm(await llm.complete_json(system, prompt), place.story_doc or "")
        if question is None:
            _intro_cache[key] = (answer, grounded)
        return StoryOut(answer=answer, sources=sources, grounded=grounded, ai=True, questions_left=left)
    except (llm.LLMUnavailable, ValueError):
        answer, grounded = story.fallback_answer(doc, question, body.language)
        return StoryOut(answer=answer, sources=sources, grounded=grounded, questions_left=left)


AI_LIMIT_MESSAGE = f"무료 코스에서는 AI에게 하루 {rules.FREE_AI_QUESTIONS}번까지 물어볼 수 있어요. 내일 다시 물어보거나, 버디와 함께 걸으면 제한 없이 물어볼 수 있어요"


def ui_lang(accept_language: str | None) -> str:
    """응답 문장 언어: Accept-Language가 en으로 시작하면 영어, 그 밖에는 한국어"""
    return "en" if (accept_language or "").lower().startswith("en") else "ko"


@router.post("/buddy-match", response_model=MatchOut)
async def buddy_match(
    body: MatchIn, _: User = Depends(require_role("tourist")), db: Session = Depends(get_db),
    accept_language: str | None = Header(default=None),
) -> MatchOut:
    """AI-03 버디 매칭. DB가 승인·가능 날짜·언어로 거르고 점수(관심사·언어·성향·도움·같은 대학)를 매긴 뒤,
    LLM은 3명을 고르고 이유만 쓴다."""
    ui = ui_lang(accept_language)
    cands = matcher.candidates(db, body)
    if not cands:
        return MatchOut(reason=matcher.overall_reason([], body.language, body.interests, ui), matches=[])
    try:
        system, prompt = matcher.llm_prompt(cands, body.language, body.date, body.interests, ui)
        picked, overall = matcher.validate(await llm.complete_json(system, prompt), cands)
        used_ai = True
    except (llm.LLMUnavailable, ValueError):
        picked, overall, used_ai = [], "", False
    # LLM이 3명보다 적게 골랐거나 실패했으면 점수 순으로 채운다
    for c in cands:
        if len(picked) >= matcher.TOP_N:
            break
        if c not in [p for p, _ in picked]:
            picked.append((c, matcher.buddy_reason(c, body.language, ui)))
    if not overall:
        overall = matcher.overall_reason([p for p, _ in picked], body.language, body.interests, ui)
    return MatchOut(
        reason=overall, ai=used_ai,
        matches=[MatchItem(buddy_id=c.profile.id, score=c.score, reason=r) for c, r in picked],
    )


@router.post("/buddy-brief", response_model=BriefOut)
async def buddy_brief(body: BriefIn, user: User = Depends(require_role("buddy")),
                      db: Session = Depends(get_db)) -> BriefOut:
    """AI-04 동행 준비 자료. 버디 본인에게 온 버디 항목만. 요청(식단·알레르기·속도)을 첫 문장에 넣는다."""
    item = db.get(BookingItem, body.booking_item_id)
    if not item:
        raise api_error(404, "NOT_FOUND", "예약 항목을 찾을 수 없습니다")
    profile = db.scalar(select(BuddyProfile).where(BuddyProfile.user_id == user.id))
    if not (item.type == "buddy" and profile is not None and item.ref_id == profile.id):
        raise api_error(403, "FORBIDDEN", "본인에게 배정된 항목이 아닙니다")

    m = brief.gather(db, item, profile)
    try:
        system, prompt = brief.llm_prompt(m)
        text, phrases = brief.validate_llm(await llm.complete_json(system, prompt), m)
        used_ai = True
    except (llm.LLMUnavailable, ValueError):
        text, phrases, used_ai = brief.fallback_brief(m), brief.fallback_phrases(m), False
    ct = m.route_time
    legs = {(x.from_place_id, x.to_place_id): x for x in (ct.legs if ct else [])}
    route = []
    for i, p in enumerate(m.route):
        lg = legs.get((m.route[i - 1].id, p.id)) if i else None
        route.append(BriefRouteStop(
            place_id=p.id, name=p.name, name_en=p.name_en, lat=float(p.lat) if p.lat else None,
            lng=float(p.lng) if p.lng else None, from_course=p.id in m.course_place_ids,
            walk_m_from_prev=lg.walk_m if lg else None, walk_min_from_prev=lg.walk_min if lg else None,
            source=lg.source if lg else None, path=lg.path if lg else None))
    return BriefOut(
        booking_item_id=item.id, brief=text, phrases=phrases, ai=used_ai,
        places=[BriefPlace(name=p.name, name_en=p.name_en, summary=brief.summary(p), tips=brief.place_tips(p))
                for p in m.places],
        route=route, route_walk_m=ct.walk_m_total if ct else 0, route_walk_min=ct.walk_min_total if ct else 0,
        route_source=ct.route_source if ct else "estimate",
    )


@router.post("/translate-notice", response_model=NoticeOut)
async def translate_notice(body: NoticeIn, _: User = Depends(require_role("operator"))) -> NoticeOut:
    """AI-05 다국어 안내문 초안. 초안만 만들고 저장·게시는 운영자가 따로. 키가 없으면 원문 그대로 + ai=false."""
    targets = list(dict.fromkeys(body.target_languages))
    try:
        system, prompt = notice.llm_prompt(body.text, targets)
        raw = await llm.complete_json(system, prompt)
        drafts = {t: str(raw[t]).strip() for t in targets if isinstance(raw.get(t), str) and raw[t].strip()}
        if len(drafts) != len(targets):
            raise ValueError("언어 누락")
        return NoticeOut(drafts=drafts, warnings=notice.check(body.text, drafts), ai=True)
    except (llm.LLMUnavailable, ValueError):
        return NoticeOut(drafts={t: body.text for t in targets},
                         warnings=["AI 키가 없어 번역하지 못했어요. 원문을 그대로 넣었어요."])
