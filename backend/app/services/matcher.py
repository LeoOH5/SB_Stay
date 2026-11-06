"""AI-03 버디 매칭 (A 담당).

1. DB에서 먼저 거른다: 승인(approved)·휴면 아님 + 그 날짜에 가능 + 요청 언어를 쓰는 버디.
2. 점수는 코드가 매긴다: 관심사 겹침 + 쓸 수 있는 언어 수 + 성향·스타일 일치 + 필요한 도움 + 같은 대학.
   (점수는 화면에 '92%'처럼 보일 수 있어 LLM에 맡기지 않는다)
3. LLM은 후보 안에서 3명을 고르고 한 줄 이유를 쓴다. 키가 없거나 실패하면 점수 순 3명 + 템플릿 이유.
"""
from dataclasses import dataclass
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import rules
from app.models import BuddyAvailability, BuddyProfile, User
from app.schemas.ai import MatchIn
from app.services import eligibility

TOP_N = 3

INTEREST = {
    "ko": {"literature": "문학", "walking": "산책", "cafe": "카페", "independence": "독립운동", "photo": "사진",
           "food": "로컬 음식", "hanok": "한옥", "architecture": "건축", "craft": "공예", "sports": "스포츠",
           "history": "역사", "music": "음악"},
    "en": {"literature": "literature", "walking": "walking", "cafe": "cafés", "independence": "independence history",
           "photo": "photography", "food": "local food", "hanok": "hanok", "architecture": "architecture",
           "craft": "crafts", "sports": "sports", "history": "history", "music": "music"},
}
LANGUAGE = {
    "ko": {"ko": "한국어", "en": "영어", "ja": "일본어", "zh": "중국어"},
    "en": {"ko": "Korean", "en": "English", "ja": "Japanese", "zh": "Chinese"},
}
HELP_EN = {"vegan_food": "can show vegan restaurants", "halal_food": "can show halal restaurants", "photo": "takes photos for you",
           "subway": "can explain the subway", "shopping": "can help with shopping"}
MAJOR_EN = {"국어국문": "Korean Literature", "사학과": "History", "관광학": "Tourism", "경영": "Business",
            "영문학": "English Literature", "건축학": "Architecture"}


@dataclass
class BuddyCand:
    profile: BuddyProfile
    name: str
    university: str
    shared: list[str]  # 요청 관심사와 겹치는 것
    score: float
    traits: int = 0  # 원하는 성향·스타일과 일치한 수
    helps: list[str] | None = None  # 필요한 도움을 모두 도우면 그 목록, 아니면 None
    same_uni: bool = False


def score(shared: int, languages: int, traits: int = 0, needs_ok: bool = False, same_uni: bool = False) -> float:
    """0.60 기본 + 겹치는 관심사 1개당 0.15(최대 2개) + 한국어 외 언어 1개당 0.05(최대 2개)
    + 성향·스타일 일치 1개당 0.05(최대 2개) + 필요한 도움을 모두 도우면 0.10 + 같은 대학 0.10, 최대 0.99"""
    s = (0.60 + 0.15 * min(shared, 2) + 0.05 * min(max(languages - 1, 0), 2) + 0.05 * min(traits, 2)
         + (0.10 if needs_ok else 0) + (0.10 if same_uni else 0))
    return round(min(s, 0.99), 2)


def candidates(db: Session, req: MatchIn) -> list[BuddyCand]:
    q = select(BuddyProfile).where(BuddyProfile.status == "approved", BuddyProfile.needs_recheck.is_(False))
    if req.date:
        q = q.where(BuddyProfile.id.in_(select(BuddyAvailability.buddy_id).where(BuddyAvailability.date == req.date)))
    out = []
    for b in db.scalars(q.order_by(BuddyProfile.id)).all():
        langs = b.languages or []
        if req.language and req.language not in langs:
            continue
        user = db.get(User, b.user_id)
        shared = [i for i in req.interests if i in (b.interests or [])]
        traits = len(set(req.personality) & set(b.personality or [])) + len(set(req.style) & set(b.style or []))
        needs_ok = bool(req.needs) and set(req.needs) <= set(b.can_help or [])
        same_uni = req.university_id is not None and b.university_id == req.university_id
        out.append(BuddyCand(b, (user.name if user else ""), eligibility.university_name(db, b), shared,
                             score(len(shared), len(langs), traits, needs_ok, same_uni), traits,
                             list(req.needs) if needs_ok else None, same_uni))
    return sorted(out, key=lambda c: (-c.score, c.profile.id))


def buddy_reason(c: BuddyCand, language: str | None, ui: str) -> str:
    """템플릿 이유: 전공·학년 · 같은 관심사 · 요청 언어"""
    b = c.profile
    if ui == "en":
        parts = [f"{MAJOR_EN.get(b.major or '', b.major or '')}, year {b.year}".strip(", ")]
        if c.shared:
            parts.append("also into " + ", ".join(INTEREST["en"].get(i, i) for i in c.shared))
        if language and language != "ko":
            parts.append(f"speaks {LANGUAGE['en'].get(language, language)}")
        parts += [HELP_EN.get(h, h) for h in c.helps or []]
        if c.same_uni:
            parts.append("same university as your stay")
    else:
        parts = [f"{b.major or ''} {b.year}학년".strip()]
        if c.shared:
            parts.append(", ".join(INTEREST["ko"].get(i, i) for i in c.shared) + " 관심이 같아요")
        if language and language != "ko":
            parts.append(f"{LANGUAGE['ko'].get(language, language)} 가능")
        parts += [f"{rules.CAN_HELP.get(h, h)} 가능" for h in c.helps or []]
        if c.same_uni:
            parts.append("같은 대학 숙소")
    return " · ".join(p for p in parts if p)


def overall_reason(picked: list[BuddyCand], language: str | None, interests: list[str], ui: str) -> str:
    if not picked:
        return ("No buddy fits that date and language. Try another date or language." if ui == "en"
                else "그 날짜·언어에 맞는 버디가 없어요. 날짜나 언어를 바꿔 보세요.")
    topic = [INTEREST[ui].get(i, i) for i in interests[:2]]
    lang = LANGUAGE[ui].get(language or "", "") if language and language != "ko" else ""
    if ui == "en":
        keys = " and ".join(x for x in [", ".join(topic) + " interest" if topic else "", lang] if x)
        return f"Sorted by {keys}." if keys else "Sorted by shared interests and languages."
    keys = "·".join(x for x in [", ".join(topic) + " 관심" if topic else "", f"{lang} 가능" if lang else ""] if x)
    return f"{keys}한 순으로 골랐어요." if keys else "관심사와 언어가 잘 맞는 순으로 골랐어요."


def llm_prompt(cands: list[BuddyCand], language: str | None, day: date | None, interests: list[str],
               ui: str) -> tuple[str, str]:
    lang_name = "Korean" if ui == "ko" else "English"
    system = (
        "You match a traveler with local university student buddies in Seongbuk, Seoul.\n"
        "Rules:\n"
        f"- Pick up to {TOP_N} buddies ONLY from the candidate list, best first. Never invent ids.\n"
        "- For each, write one short reason (under 15 words) based only on the listed major, interests, languages, "
        "personality, style, what they can help with, university and intro.\n"
        f"- Also write one overall reason sentence. Write all text in {lang_name}.\n"
        '- Reply with JSON only: {"matches": [{"buddy_id": 31, "reason": "..."}], "reason": "..."}'
    )
    lines = [
        f"- id {c.profile.id}: {c.university}, {c.profile.major} year {c.profile.year}; languages "
        f"{','.join(c.profile.languages or [])}; interests {','.join(c.profile.interests or [])}; "
        f"personality {','.join(c.profile.personality or [])}; style {','.join(c.profile.style or [])}; "
        f"can help {','.join(c.profile.can_help or [])}; same university as stay: {'yes' if c.same_uni else 'no'}; "
        f"intro: {c.profile.intro or ''}"
        for c in cands[:8]
    ]
    user = (
        f"Traveler: wants a buddy who speaks {language or 'any language'}"
        + (f" on {day.isoformat()}" if day else "")
        + f"; interests {', '.join(interests) or 'none given'}.\n\nCandidates:\n" + "\n".join(lines)
    )
    return system, user


def validate(raw: dict, cands: list[BuddyCand]) -> tuple[list[tuple[BuddyCand, str]], str]:
    """LLM 답에서 후보에 있는 id만, 중복 없이 최대 3명. 하나도 없으면 ValueError → 폴백"""
    by_id = {c.profile.id: c for c in cands}
    picked: list[tuple[BuddyCand, str]] = []
    for m in raw.get("matches") or []:
        if not isinstance(m, dict):
            continue
        c = by_id.get(m.get("buddy_id"))  # type: ignore[arg-type]
        reason = m.get("reason")
        if c and isinstance(reason, str) and reason.strip() and c not in [p for p, _ in picked]:
            picked.append((c, reason.strip()[:200]))
        if len(picked) == TOP_N:
            break
    overall = raw.get("reason")
    if not picked or not isinstance(overall, str) or not overall.strip():
        raise ValueError("matches/reason 형식 오류")
    return picked, overall.strip()[:300]
