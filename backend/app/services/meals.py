"""식비 청구·버디 정산 계산 (버디 본인 /buddy/* 와 운영자 /admin/* 공용).

버디 항목 가격 = 활동비 + 앨범 + 식사 보증금. 앨범(5,000)은 전액 플랫폼 수입이라 버디 몫이 아니다.
버디 몫 = 활동비 − 수수료 10% + 승인된 식비(수수료 없음).
"""
import re
from calendar import monthrange
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import rules
from app.core.config import get_settings
from app.models.booking import Booking, BookingItem, MealClaim
from app.models.supply import BuddyProfile
from app.models.user import User
from app.schemas.buddy import AdminMealClaimOut, MealClaimOut
from app.services.booking_state import album_fee, meal_sums


def gross_fee_net(it: BookingItem) -> tuple[int, int, int]:
    """버디 항목의 (활동비, 수수료, 수수료 뺀 금액). 식사 보증금·앨범 제외"""
    gross = it.price - (it.meal_deposit or 0) - album_fee(it)
    fee = round(gross * get_settings().platform_fee_rate)
    return gross, fee, gross - fee


def traveler_name(db: Session, booking: Booking) -> str:
    return (booking.traveler or {}).get("name") or db.get(User, booking.tourist_id).name


def claim_out(db: Session, c: MealClaim) -> MealClaimOut:
    it = db.get(BookingItem, c.booking_item_id)
    b = db.get(Booking, it.booking_id)
    return MealClaimOut(id=c.id, item_id=it.id, booking_code=b.code, tourist=traveler_name(db, b), date=c.date, place=c.place,
                        items=c.items, amount=c.amount, limit=rules.MEAL_LIMIT, over_limit=c.amount > rules.MEAL_LIMIT,
                        status=c.status, reason=c.reason, created_at=c.created_at)


def admin_claim_out(db: Session, c: MealClaim) -> AdminMealClaimOut:
    it = db.get(BookingItem, c.booking_item_id)
    prof = db.get(BuddyProfile, c.buddy_id)
    _, approved = meal_sums(db, it.id)
    others = approved - (c.amount if c.status == "approved" else 0)  # 이 청구 자신은 빼고 계산
    return AdminMealClaimOut(**claim_out(db, c).model_dump(), buddy_name=db.get(User, prof.user_id).name,
                             deposit=it.meal_deposit or 0, deposit_left=(it.meal_deposit or 0) - others,
                             request_summary=rules.request_summary(it.request))


def claims_for_item(db: Session, item_id: int) -> list[MealClaim]:
    return list(db.scalars(select(MealClaim).where(MealClaim.booking_item_id == item_id).order_by(MealClaim.id)).all())


def month_range(month: str) -> tuple[date, date]:
    y, m = int(month[:4]), int(month[5:7])
    return date(y, m, 1), date(y, m, monthrange(y, m)[1])


def pay_date(month: str) -> date:
    """매달 말일까지 확정분을 다음 달 말일에 지급"""
    _, last = month_range(month)
    nxt = date(last.year + (last.month == 12), last.month % 12 + 1, 1)
    return nxt.replace(day=monthrange(nxt.year, nxt.month)[1])


def mask_account(acc: str | None) -> str | None:
    """'신한 110-123-456482' → '신한 110-***-***482' (앞 3자리·뒤 3자리 숫자만 남김)"""
    if not acc:
        return None
    digits = [i for i, ch in enumerate(acc) if ch.isdigit()]
    keep = set(digits[:3] + digits[-3:])
    return "".join("*" if i in digits and i not in keep else ch for i, ch in enumerate(acc))


MONTH_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")
