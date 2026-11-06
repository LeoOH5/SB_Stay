"""돈 규칙 테스트 — 금액은 원 단위 int, 비율은 퍼센트 int. 이 파일이 통과해야 머지한다.

환불 규정: 첫 일정 7일 전까지 100%, 3일 전까지 50%, 그 뒤 0%.
"""
from datetime import date, timedelta

import pytest

from app.core import rules
from app.services import payments as ps

FIRST_DAY = date(2027, 1, 20)  # 첫 일정 날짜


class _Item:
    def __init__(self, d):
        self.date_from = d


# ---------- 날짜별 환불 (먼저 정해 둔 표)
@pytest.mark.parametrize(
    ("days_before", "percent"),
    [
        (30, 100),
        (8, 100),
        (7, 100),  # 경계: 7일 전은 전액
        (6, 50),
        (4, 50),
        (3, 50),  # 경계: 3일 전은 절반
        (2, 0),
        (1, 0),
        (0, 0),  # 당일
        (-1, 0),  # 이미 지난 일정
    ],
)
def test_refund_percent_by_date(days_before, percent):
    today = FIRST_DAY - timedelta(days=days_before)
    assert rules.refund_percent(days_before) == percent
    assert ps.refund_percent(None, [_Item(FIRST_DAY)], today=today) == percent


@pytest.mark.parametrize(
    ("days_before", "paid", "refund"),
    [
        (7, 100_000, 100_000),
        (6, 100_000, 50_000),
        (3, 99_999, 50_000),  # 49,999.5원 → 0.5원은 올림
        (3, 1, 1),
        (2, 100_000, 0),
    ],
)
def test_refund_amount_is_whole_won(days_before, paid, refund):
    percent = rules.refund_percent(days_before)
    amount = rules.pct(paid, percent)
    assert amount == refund
    assert isinstance(amount, int)


def test_refund_uses_earliest_item():
    """숙박·버디 중 가장 빠른 날짜가 기준"""
    items = [_Item(FIRST_DAY + timedelta(days=2)), _Item(FIRST_DAY), _Item(None)]
    assert ps.refund_percent(None, items, today=FIRST_DAY - timedelta(days=5)) == 50


# ---------- 수수료·비율 계산은 정수
@pytest.mark.parametrize(
    ("amount", "percent", "expected"),
    [
        (219_000, 10, 21_900),
        (105_000, 10, 10_500),
        (12_345, 10, 1_235),  # 1,234.5원 → 올림
        (12_344, 10, 1_234),
        (0, 10, 0),
        (150_000, 100, 150_000),
        (150_000, 0, 0),
    ],
)
def test_pct_integer(amount, percent, expected):
    got = rules.pct(amount, percent)
    assert got == expected and isinstance(got, int)


def test_pct_rejects_negative():
    with pytest.raises(ValueError):
        rules.pct(-1, 10)


def test_fee_settings_are_integers():
    from app.core.config import get_settings

    assert isinstance(get_settings().platform_fee_percent, int)
    assert all(isinstance(d, int) and isinstance(p, int) for d, p in rules.REFUND_RULES)
    assert all(isinstance(v, int) for v in (rules.MEAL_LIMIT, rules.ALBUM_FEE))


def test_meal_deposit_is_count_times_limit():
    for n in range(rules.MEAL_MAX + 1):
        assert n * rules.MEAL_LIMIT == 20_000 * n


# ---------- v3.6 앨범(사진 기록)도 정산율로 나눈다
@pytest.mark.parametrize(("rate", "buddy", "platform"), [("0.70", 3500, 1500), ("0.75", 3750, 1250), ("0.80", 4000, 1000)])
def test_album_split_by_grade_rate(rate, buddy, platform):
    from decimal import Decimal

    from app.models.booking import BookingItem
    from app.services import grades
    from app.services.booking_state import activity_fee, album_fee, payout_base

    assert grades.buddy_net(rules.ALBUM_FEE, Decimal(rate)) == buddy and rules.ALBUM_FEE - buddy == platform
    # 활동 30,000 + 앨범 5,000 + 식사 1회 20,000 → 정산 대상 35,000 (보증금은 통과 금액)
    it = BookingItem(type="buddy", price=30_000 + rules.ALBUM_FEE + rules.MEAL_LIMIT, meal_deposit=rules.MEAL_LIMIT, album=True)
    assert (activity_fee(it), album_fee(it), payout_base(it)) == (30_000, 5_000, 35_000)
    net = grades.buddy_net(payout_base(it), Decimal(rate))
    assert net == grades.buddy_net(30_000, Decimal(rate)) + buddy and isinstance(net, int)
    assert payout_base(BookingItem(type="buddy", price=30_000, meal_deposit=0, album=False)) == 30_000
