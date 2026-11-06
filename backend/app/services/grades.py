"""버디 등급·정산율·휴면 (v3.2, v3.7 매달 평가).

- 평가: 매달 1일. 평가 달 = 그 전 달(달력 기준). recompute_all(db, 어느 날)은 그날이 든 달의 1일에 한 평가를 한다.
  이미 그 달을 평가했으면 다시 하지 않는다(grade_evaluated_for) — 같은 달에 두 번 눌러도 한 단계씩만 오른다.
- 실적: 지난달 완료 동행 수(확정 + 그 달 날짜, 누적 아님) · 지난달 말까지 끝난 동행의 후기 개수·평균(누적).
- 등급(decide): 승인 후 첫 달(승인일이 평가 달 1일보다 늦음)은 기본.
  성장 = 지난달 동행 ≥ 4 · 후기 ≥ 3 · 평점 ≥ 4.3 (지금 등급과 상관없음).
  우수 = 지금 성장 또는 우수 + 지난달 동행 ≥ 7 · 후기 ≥ 5 · 평점 ≥ 4.5.
  올라갈 때는 한 단계씩(기본 → 성장 → 우수), 내려갈 때는 조건에 맞는 가장 높은 등급으로 바로(우수 → 기본도 된다).
  동행이 없는 달도 똑같이 평가한다(방학이 끝나면 대부분 기본).
- 정산율은 예약 확정 때 항목에 고정(lock_rate). 버디 몫 = round((활동비 + 앨범) × 정산율), 나머지는 플랫폼 (v3.6 앨범 포함).
- 휴면: 운영 기간 중 30일간 활동(완료 동행·요청 수락·가능 날짜 수정)이 없으면 needs_recheck → 목록·AI 추천에서 빠지고 새 예약 409.
  v3.7부터 등급은 멈추지 않는다(휴면이어도 매달 평가).
"""
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import rules
from app.models.booking import BookingItem, Review
from app.models.supply import BuddyProfile


@dataclass
class Eval:
    grade: rules.Grade  # 이 실적으로 정해지는 등급 (지금 등급 → decide)
    month: date  # 평가 달 1일
    walks: int  # 그 달 완료 동행
    reviews: int  # 그 달 말까지 누적 후기
    rating: float | None  # 누적 평균 (소수 둘째 자리)
    first_month: bool  # 승인 후 첫 달이라 기본


# ---------- 달
def month_start(d: date) -> date:
    return d.replace(day=1)


def prev_month(d: date) -> date:
    """d가 든 달의 바로 전 달 1일"""
    return (month_start(d) - timedelta(days=1)).replace(day=1)


def next_month(d: date) -> date:
    return (month_start(d) + timedelta(days=32)).replace(day=1)


def month_end(m: date) -> date:
    return next_month(m) - timedelta(days=1)


def eval_month(as_of: date) -> date:
    """as_of가 든 달 1일의 평가가 보는 달 = 지난달 1일"""
    return prev_month(as_of)


def in_vacation(d: date) -> bool:
    return any(start <= d <= end for _, start, end in rules.VACATIONS)


# ---------- 실적
def walks_in(db: Session, buddy_id: int, month: date) -> list[BookingItem]:
    """그 달 완료 동행 (확정 + 날짜가 그 달 안)"""
    return list(db.scalars(select(BookingItem).where(
        BookingItem.type == "buddy", BookingItem.ref_id == buddy_id, BookingItem.status == "confirmed",
        BookingItem.date_from >= month, BookingItem.date_from <= month_end(month))))


def reviews_until(db: Session, buddy_id: int, until: date) -> list[int]:
    """until까지 날짜인 이 버디 동행의 후기 평점 (누적)"""
    return list(db.scalars(select(Review.rating).join(BookingItem, Review.booking_item_id == BookingItem.id).where(
        BookingItem.type == "buddy", BookingItem.ref_id == buddy_id, BookingItem.date_from <= until)))


def _avg(ratings: list[int]) -> Decimal | None:
    return Decimal(sum(ratings)) / len(ratings) if ratings else None


def first_month(buddy: BuddyProfile, month: date) -> bool:
    """승인일이 평가 달 1일보다 늦거나 없으면 첫 달 (= 승인한 지 한 달이 안 됨) → 기본"""
    return buddy.approved_on is None or buddy.approved_on > month


def decide(current: str, first: bool, walks: int, reviews: int, rating: Decimal | None) -> rules.Grade:
    """지금 등급 + 지난달 실적 → 새 등급. 오를 때 한 단계씩, 내릴 때 바로."""
    top, growth, basic = rules.GRADE_BY_CODE["top"], rules.GRADE_BY_CODE["growth"], rules.GRADE_BY_CODE["basic"]
    if first:
        return basic

    def meets(g: rules.Grade) -> bool:
        return walks >= g.walks and reviews >= g.reviews and rating is not None and rating >= g.rating

    if current in ("growth", "top") and meets(top):
        return top
    if meets(growth):
        return growth
    return basic


def evaluate(db: Session, buddy: BuddyProfile, as_of: date) -> Eval:
    """as_of가 든 달 1일 평가 (지난달 동행 · 지난달 말까지 누적 후기). 저장은 apply_grade"""
    m = eval_month(as_of)
    walks = len(walks_in(db, buddy.id, m))
    ratings = reviews_until(db, buddy.id, month_end(m))
    avg = _avg(ratings)
    first = first_month(buddy, m)
    return Eval(decide(buddy.grade or "basic", first, walks, len(ratings), avg), m, walks, len(ratings),
                round(float(avg), 2) if avg is not None else None, first)


def stats_now(db: Session, buddy: BuddyProfile, today: date) -> dict:
    """화면용: 평가 달(지난달) 동행, 이번 달 지금까지 동행, 오늘까지 누적 후기·평점"""
    m, this = eval_month(today), month_start(today)
    ratings = reviews_until(db, buddy.id, today)
    avg = _avg(ratings)
    return {"month": m, "last_month_walks": len(walks_in(db, buddy.id, m)),
            "this_month_walks": len([i for i in walks_in(db, buddy.id, this) if i.date_from <= today]),
            "reviews": len(ratings), "rating": round(float(avg), 2) if avg is not None else None}


def next_grade(code: str) -> rules.Grade | None:
    """한 단계 위 (우수면 None)"""
    i = [g.code for g in rules.GRADES].index(code)
    return rules.GRADES[i - 1] if i > 0 else None


# ---------- 휴면
def last_active(db: Session, buddy: BuddyProfile, today: date) -> date | None:
    """완료 동행 · 요청 수락(decided_at) · 가능 날짜 수정·활동 확인(active_on) 중 가장 늦은 날. 없으면 약속 동의일"""
    walked = db.scalar(select(func.max(BookingItem.date_from)).where(
        BookingItem.type == "buddy", BookingItem.ref_id == buddy.id, BookingItem.status == "confirmed", BookingItem.date_from <= today))
    accepted = db.scalar(select(func.max(BookingItem.decided_at)).where(
        BookingItem.type == "buddy", BookingItem.ref_id == buddy.id, BookingItem.decided_by == buddy.user_id,
        BookingItem.status == "confirmed"))
    days = [d for d in (walked, accepted.date() if accepted else None, buddy.active_on) if d]
    if not days and buddy.code_agreed_at:
        days = [buddy.code_agreed_at.date()]
    return max(days) if days else None


def dormant_from(last: date | None, today: date) -> date | None:
    """last 다음 날부터 운영 기간만 세어 DORMANT_DAYS째가 되는 날 (오늘까지 못 채우면 None)"""
    if not last:
        return None
    n, d = 0, last
    while d < today:
        d += timedelta(days=1)
        n += in_vacation(d)
        if n >= rules.DORMANT_DAYS:
            return d
    return None


def check_dormant(db: Session, buddy: BuddyProfile, today: date) -> bool:
    """승인된 버디가 휴면 조건이면 needs_recheck 켬. 바뀌었으면 True"""
    if buddy.status != "approved" or buddy.needs_recheck:
        return False
    since = dormant_from(last_active(db, buddy, today), today)
    if since:
        buddy.needs_recheck, buddy.dormant_since = True, since
    return bool(since)


def confirm_active(buddy: BuddyProfile, today: date) -> None:
    """'계속 활동할게요': 요청 받기 다시 시작. 등급은 휴면과 상관없이 매달 평가"""
    buddy.needs_recheck, buddy.dormant_since, buddy.active_on = False, None, today


def apply_grade(db: Session, buddy: BuddyProfile, as_of: date) -> bool:
    """as_of가 든 달 1일 평가를 저장. 이미 그 달(또는 더 뒤)을 평가했으면 건너뛴다. 등급·정산율이 바뀌었으면 True"""
    m = eval_month(as_of)
    if buddy.grade_evaluated_for and buddy.grade_evaluated_for >= m:
        return False
    g = evaluate(db, buddy, as_of).grade
    changed = buddy.grade != g.code or Decimal(buddy.payout_rate or 0) != g.rate
    buddy.grade, buddy.payout_rate = g.code, g.rate
    buddy.grade_evaluated_for, buddy.grade_updated_at = m, month_start(as_of)
    return changed


def recompute_all(db: Session, as_of: date, dormancy: bool = True) -> list[BuddyProfile]:
    """매달 1일: 등급 평가(지난달 실적) → 휴면 판정. 등급·정산율·휴면이 바뀐 버디 목록 (commit은 호출한 쪽).
    as_of가 1일이 아니어도 그 달 1일 평가로 본다(그 달에 아직 안 했으면 한다). dormancy=False면 등급만."""
    changed = []
    for b in db.scalars(select(BuddyProfile).order_by(BuddyProfile.id)).all():
        graded = apply_grade(db, b, as_of)
        if (dormancy and check_dormant(db, b, as_of)) or graded:
            changed.append(b)
    db.flush()
    return changed


def replay(db: Session, since: date, today: date) -> None:
    """시드용: since 다음 달 1일부터 today가 든 달 1일까지 매달 평가를 차례로 (휴면은 마지막에 한 번)"""
    m = next_month(since)
    while m <= today:
        recompute_all(db, m, dormancy=False)
        m = next_month(m)


# ---------- 정산율
def lock_rate(it: BookingItem, buddy: BuddyProfile) -> None:
    """예약 확정 때 버디의 지금 정산율을 항목에 고정 (이후 등급이 바뀌어도 그대로)"""
    if it.payout_rate is None:
        it.payout_rate = buddy.payout_rate


def item_rate(db: Session, it: BookingItem) -> Decimal:
    """고정된 정산율, 아직 없으면(확정 전) 버디의 지금 정산율"""
    if it.payout_rate is not None:
        return Decimal(it.payout_rate)
    prof = db.get(BuddyProfile, it.ref_id)
    return Decimal(prof.payout_rate) if prof and prof.payout_rate is not None else rules.GRADES[-1].rate


def buddy_net(gross: int, rate: Decimal) -> int:
    """버디 몫 = round(금액 × 정산율), 0.5는 올림. 금액 = 활동비 + 앨범 (booking_state.payout_base)"""
    return int((Decimal(gross) * Decimal(rate)).quantize(Decimal(1), rounding=ROUND_HALF_UP))

