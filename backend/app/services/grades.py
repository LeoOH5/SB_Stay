"""버디 등급·정산율·휴면 (v3.2).

- 평가 기간: 오늘이 든 운영 방학(없으면 가장 최근 방학) + 그 직전 방학. 방학 밖 날짜는 세지 않는다.
- 실적: 확정되고 날짜가 오늘 이전인 버디 항목(활동 완료) 수, 그 항목 후기의 평균 평점·개수.
- 등급: 평점·동행·후기 세 조건을 모두 채우는 가장 높은 등급 (rules.GRADES). 매월 1회 recompute_all.
- 정산율은 예약 확정 때 항목에 고정(lock_rate). 버디 몫 = round(활동비 × 정산율), 나머지는 플랫폼.
- 휴면: 운영 기간 중 30일간 활동(완료 동행·요청 수락·가능 날짜 수정)이 없으면 needs_recheck.
  예약이 없어 생긴 휴면이라 등급·정산율은 내리지 않고, 복귀 후 첫 동행이 끝날 때까지 재산정을 미룬다.
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
    grade: rules.Grade
    rating: float | None  # 소수 둘째 자리
    walks: int
    reviews: int
    window: dict  # {from, to, label}


# ---------- 기간
def vacation_index(today: date) -> int | None:
    """오늘이 든 방학, 없으면 오늘 전 가장 최근 방학의 번호"""
    past = [i for i, (_, start, _) in enumerate(rules.VACATIONS) if start <= today]
    return past[-1] if past else None


def window(today: date) -> list[tuple[str, date, date]]:
    """평가 기간 = [직전 방학, 현재 방학] (오래된 순)"""
    i = vacation_index(today)
    return [] if i is None else rules.VACATIONS[max(i - 1, 0): i + 1]


def window_out(today: date) -> dict:
    w = window(today)
    if not w:
        return {"from": None, "to": None, "label": ""}
    return {"from": w[0][1].isoformat(), "to": w[-1][2].isoformat(), "label": " + ".join(n for n, _, _ in w)}


def in_vacation(d: date) -> bool:
    return any(start <= d <= end for _, start, end in rules.VACATIONS)


# ---------- 평가
def done_items(db: Session, buddy_id: int, today: date) -> list[BookingItem]:
    """평가 기간 안에서 활동 완료(확정 + 날짜 ≤ 오늘)한 버디 항목"""
    rows = db.scalars(select(BookingItem).where(BookingItem.type == "buddy", BookingItem.ref_id == buddy_id,
                                                BookingItem.status == "confirmed", BookingItem.date_from <= today)).all()
    w = window(today)
    return [it for it in rows if any(start <= it.date_from <= end for _, start, end in w)]


def grade_for(rating: Decimal | None, walks: int, reviews: int) -> rules.Grade:
    for g in rules.GRADES:
        if walks >= g.walks and reviews >= g.reviews and (g.reviews == 0 or (rating is not None and rating >= g.rating)):
            return g
    return rules.GRADES[-1]


def evaluate(db: Session, buddy: BuddyProfile, today: date) -> Eval:
    items = done_items(db, buddy.id, today)
    ratings = list(db.scalars(select(Review.rating).where(Review.booking_item_id.in_([i.id for i in items])))) if items else []
    avg = Decimal(sum(ratings)) / len(ratings) if ratings else None
    return Eval(grade_for(avg, len(items), len(ratings)), round(float(avg), 2) if avg is not None else None,
                len(items), len(ratings), window_out(today))


def next_grade(code: str) -> rules.Grade | None:
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
    """'계속 활동할게요': 요청 받기 다시 시작. 등급은 그대로(첫 동행은 기존 정산율), dormant_since는 첫 동행 뒤 지운다"""
    buddy.needs_recheck, buddy.active_on = False, today


def _held(db: Session, buddy: BuddyProfile, today: date) -> bool:
    """휴면 중이거나 복귀 후 아직 동행을 마치지 않았으면 등급 재산정을 미룬다"""
    if buddy.needs_recheck:
        return True
    if not buddy.dormant_since:
        return False
    walked = db.scalar(select(func.max(BookingItem.date_from)).where(
        BookingItem.type == "buddy", BookingItem.ref_id == buddy.id, BookingItem.status == "confirmed", BookingItem.date_from <= today))
    if walked and walked > buddy.dormant_since:
        buddy.dormant_since = None
        return False
    return True


def apply_grade(db: Session, buddy: BuddyProfile, today: date) -> bool:
    """등급·정산율 갱신. 바뀌었으면 True"""
    if _held(db, buddy, today):
        return False
    g = evaluate(db, buddy, today).grade
    changed = buddy.grade != g.code or Decimal(buddy.payout_rate or 0) != g.rate
    buddy.grade, buddy.payout_rate, buddy.grade_updated_at = g.code, g.rate, today
    return changed


def recompute_all(db: Session, today: date) -> list[BuddyProfile]:
    """매월 1회: 등급 재산정 → 휴면 판정 (휴면 중이면 등급은 그대로). 등급·정산율·휴면이 바뀐 버디 목록 (commit은 호출한 쪽)"""
    changed = []
    for b in db.scalars(select(BuddyProfile).order_by(BuddyProfile.id)).all():
        graded = apply_grade(db, b, today)
        if check_dormant(db, b, today) or graded:
            changed.append(b)
    db.flush()
    return changed


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
    """버디 몫 = round(활동비 × 정산율), 0.5는 올림"""
    return int((Decimal(gross) * Decimal(rate)).quantize(Decimal(1), rounding=ROUND_HALF_UP))

