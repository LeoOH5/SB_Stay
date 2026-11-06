"""v3.4 이용 방식 — 무료 AI 산책 코스(free) vs 버디와 함께(buddy).

- buddy: 결제했고 취소되지 않은 예약에 살아 있는 버디 항목(requested·approved·confirmed)이 하나라도 있는 관광객.
  날짜가 지난 여행도 그대로 buddy (단순 규칙).
- free: 그 밖의 관광객. AI-02 질문은 하루 FREE_AI_QUESTIONS(3)번, 장소 소개(질문 없음)는 제한 없음.
- 관광객이 아닌 역할(버디·대학 담당자·운영자)은 제한하지 않는다 → buddy로 본다.
하루는 설정의 today() (DEMO_TODAY) 기준. 질문 수는 ai_usage 표에 남겨 서버를 다시 켜도 이어진다.
"""
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core import rules
from app.core.config import get_settings
from app.models import AiUsage, Booking, BookingItem, User

LIVE_ITEM = ("requested", "approved", "confirmed")


def plan_of(db: Session, user: User) -> str:
    if user.role != "tourist":
        return "buddy"
    paid_buddy = db.scalar(
        select(BookingItem.id).join(Booking, Booking.id == BookingItem.booking_id)
        .where(Booking.tourist_id == user.id, Booking.paid_at.is_not(None), Booking.status != "cancelled",
               BookingItem.type == "buddy", BookingItem.status.in_(LIVE_ITEM))
        .limit(1)
    )
    return "buddy" if paid_buddy else "free"


def used_today(db: Session, user: User) -> int:
    day = get_settings().today()
    return db.scalar(select(AiUsage.questions).where(AiUsage.user_id == user.id, AiUsage.day == day)) or 0


def status(db: Session, user: User) -> dict:
    """AU-09 응답. buddy면 질문 수가 없다(null)."""
    plan = plan_of(db, user)
    if plan == "buddy":
        return {"plan": plan, "ai_question_limit": None, "ai_questions_left_today": None, "ai_questions_used_today": 0}
    used = used_today(db, user)
    return {"plan": plan, "ai_question_limit": rules.FREE_AI_QUESTIONS,
            "ai_questions_left_today": max(rules.FREE_AI_QUESTIONS - used, 0), "ai_questions_used_today": used}


def use_question(db: Session, user: User) -> int | None:
    """질문 1번을 센다. 남은 횟수를 돌려주고, 한도를 넘었으면 -1. 제한 없는 사용자는 None.
    한 문장(INSERT … ON CONFLICT … WHERE questions < 한도)으로 세서 동시에 눌러도 한도를 넘지 않는다."""
    if plan_of(db, user) == "buddy":
        return None
    limit = rules.FREE_AI_QUESTIONS
    stmt = insert(AiUsage).values(user_id=user.id, day=get_settings().today(), questions=1)
    stmt = stmt.on_conflict_do_update(
        constraint="uq_ai_usage_user_day", set_={"questions": AiUsage.questions + 1},
        where=AiUsage.questions < limit,
    ).returning(AiUsage.questions)
    used = db.execute(stmt).scalar()
    db.commit()
    return -1 if used is None else limit - used
