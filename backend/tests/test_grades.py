"""버디 등급·정산율·휴면 (services/grades). v3.7: 매달 1일, 지난달 동행으로 평가"""
from datetime import date
from decimal import Decimal

import pytest

from app.core import rules
from app.models import Booking, BookingItem, BuddyProfile, Review
from app.schemas.ai import MatchIn
from app.services import grades, matcher
from tests.conftest import login

TODAY = date(2027, 1, 14)
B = "/api/v1/buddy"
BUDDY_ONLY = {"type": "buddy", "ref_id": 31, "date": "2027-01-16", "time": "14:00", "duration_min": 120}
TRAVELER = {"name": "Emma Clark", "nationality": "US", "email": "emma@example.com", "guests": 1}
RATE = {"basic": Decimal("0.7"), "growth": Decimal("0.75"), "top": Decimal("0.8")}


# ---------- 규칙 표: (지금 등급, 첫 달, 지난달 동행, 누적 후기, 누적 평점) → 새 등급
@pytest.mark.parametrize(("current", "first", "walks", "reviews", "rating", "expect"), [
    # 승인 후 첫 달은 실적과 상관없이 기본
    ("basic", True, 10, 10, "5", "basic"),
    ("growth", True, 10, 10, "5", "basic"),
    # 성장: 지난달 동행 4회부터 (3회는 안 됨)
    ("basic", False, 3, 3, "4.3", "basic"),
    ("basic", False, 4, 3, "4.3", "growth"),
    # 누적 후기 3건, 평점 4.3
    ("basic", False, 4, 2, "5", "basic"),
    ("basic", False, 4, 3, "4.29", "basic"),
    ("basic", False, 9, 0, None, "basic"),
    # 우수: 지금 성장 + 지난달 7회부터 (6회는 성장 그대로)
    ("growth", False, 6, 5, "4.5", "growth"),
    ("growth", False, 7, 5, "4.5", "top"),
    ("growth", False, 7, 4, "4.5", "growth"),
    ("growth", False, 7, 5, "4.49", "growth"),
    # 올라갈 때는 한 단계씩: 기본은 우수 조건이어도 성장까지
    ("basic", False, 12, 20, "5", "growth"),
    # 우수 유지는 우수 조건을 다시 채워야
    ("top", False, 7, 5, "4.5", "top"),
    # 내려갈 때는 바로: 우수 → 성장, 우수 → 기본
    ("top", False, 5, 6, "4.6", "growth"),
    ("top", False, 8, 6, "4.4", "growth"),
    ("top", False, 2, 6, "4.6", "basic"),
    # 동행 없는 달도 똑같이 평가 (방학이 끝나면 기본)
    ("top", False, 0, 20, "5", "basic"),
    ("growth", False, 0, 20, "5", "basic"),
])
def test_decide_table(current, first, walks, reviews, rating, expect):
    g = grades.decide(current, first, walks, reviews, Decimal(rating) if rating else None)
    assert g.code == expect and g.rate == RATE[expect]


def test_rules_numbers():
    assert [(g.code, g.walks, g.reviews, g.rating, g.rate) for g in rules.GRADES] == [
        ("top", 7, 5, Decimal("4.5"), Decimal("0.800")), ("growth", 4, 3, Decimal("4.3"), Decimal("0.750")),
        ("basic", 0, 0, Decimal(0), Decimal("0.700"))]
    assert grades.eval_month(date(2027, 1, 1)) == grades.eval_month(date(2027, 1, 31)) == date(2026, 12, 1)
    assert grades.eval_month(date(2026, 3, 1)) == date(2026, 2, 1) and grades.month_end(date(2028, 2, 1)) == date(2028, 2, 29)


def test_first_month_rule(db):
    b = BuddyProfile(approved_on=date(2026, 12, 1))
    assert grades.first_month(b, date(2026, 12, 1)) is False  # 12월 1일 승인 → 1/1 평가는 12월 한 달을 다 봄
    b.approved_on = date(2026, 12, 2)
    assert grades.first_month(b, date(2026, 12, 1)) is True  # 한 달이 안 됨 → 기본
    assert grades.first_month(BuddyProfile(approved_on=None), date(2026, 12, 1)) is True  # 승인 전
    # 서연(12/3 승인)의 1/1 평가는 첫 달이라 기본
    seoyeon = db.get(BuddyProfile, 35)
    ev = grades.evaluate(db, seoyeon, date(2027, 1, 1))
    assert ev.first_month is True and ev.grade.code == "basic"


def test_seeded_grades(client):
    """시드 등급 = 2027-01-01 평가(2026년 12월 동행)"""
    g = {b["id"]: b["grade"] for b in client.get("/api/v1/buddies").json()["items"]}
    assert g == {31: "growth", 32: "basic", 35: "basic", 36: "basic"}  # 수아(37)는 휴면이라 목록에 없음
    assert client.get("/api/v1/buddies/37").json()["grade"] == "basic"  # 여름 우수 문턱 → 9월부터 동행 0회라 기본
    r = client.get(f"{B}/grade", headers=login(client, "jiwoo@a-univ.ac.kr")).json()
    assert (r["grade"], r["payout_rate"], r["evaluated_for"], r["updated_at"], r["next_eval_on"]) == ("growth", 0.75, "2026-12", "2027-01-01", "2027-02-01")
    # 12월 동행 4회(12/22·24·27·29), 이번 달 끝난 동행 3회(1/6·10·13, 1/20은 아직), 누적 후기 4건 평균 4.5
    assert r["stats"] == {"month": "2026-12", "last_month_walks": 4, "this_month_walks": 3, "reviews": 4, "rating": 4.5}
    assert r["next"] == {"grade": "top", "payout_rate": 0.8, "need": {"walks": 7, "reviews": 5, "rating": 4.5}}
    assert r["keep"] == {"walks": 4, "reviews": 3, "rating": 4.3} and r["first_month"] is False
    assert r["note"] == rules.GRADE_NOTE and "매달 1일" in r["note"] and "한 단계씩" in r["note"]
    assert "window" not in r


def _walk(db, buddy_id: int, d: date, rating: int | None = None, n: list = [0]) -> BookingItem:  # noqa: B006
    n[0] += 1
    b = Booking(code=f"SB-T-{buddy_id}-{d:%m%d}-{n[0]}", tourist_id=1, status="confirmed", total_price=30000,
                traveler={"name": "Test", "nationality": "US", "guests": 1})
    db.add(b)
    db.flush()
    it = BookingItem(booking_id=b.id, type="buddy", ref_id=buddy_id, date_from=d, time="14:00", duration_min=120,
                     price=30000, status="confirmed", payout_rate=Decimal("0.75"))
    db.add(it)
    db.flush()
    if rating:
        db.add(Review(booking_item_id=it.id, rating=rating))
    return it


def test_month_window_boundaries_and_one_step(db, reset_db):
    """2/1 평가 = 1월 동행만. 1/31 동행은 세고 2/1 동행은 안 센다. 같은 달 두 번 돌려도 한 단계만"""
    jiwoo = db.get(BuddyProfile, 31)
    # 1월 시드 동행 4회(1/6·10·13·20) + 1/25 + 1/31(후기 5) + 1/28 = 7회, 2/1(후기 5)은 2월
    _walk(db, 31, date(2027, 1, 25))
    _walk(db, 31, date(2027, 1, 28))
    _walk(db, 31, date(2027, 1, 31), rating=5)
    _walk(db, 31, date(2027, 2, 1), rating=1)
    db.commit()
    assert len(grades.walks_in(db, 31, date(2027, 1, 1))) == 7
    ev = grades.evaluate(db, jiwoo, date(2027, 2, 1))
    # 누적 후기 = 1월 말까지 끝난 동행 후기: 7/15(4) · 12/24(5) · 12/29(4) · 1/6(5) · 1/31(5) → 5건 4.6. 2/1 후기(1점)는 안 셈
    assert (ev.month, ev.walks, ev.reviews, ev.rating, ev.grade.code) == (date(2027, 1, 1), 7, 5, 4.6, "top")
    assert grades.evaluate(db, jiwoo, date(2027, 2, 27)).walks == 7  # 그 달 어느 날 돌려도 2/1 평가
    assert grades.evaluate(db, jiwoo, date(2027, 3, 1)).walks == 1  # 3/1 평가는 2월만

    # 기본에서 출발하면 우수 조건이어도 성장까지, 같은 달 다시 돌려도 그대로
    jiwoo.grade, jiwoo.payout_rate = "basic", Decimal("0.700")
    db.commit()
    assert [b.id for b in grades.recompute_all(db, date(2027, 2, 1), dormancy=False)] == [31]
    assert (jiwoo.grade, jiwoo.payout_rate, jiwoo.grade_evaluated_for) == ("growth", Decimal("0.750"), date(2027, 1, 1))
    assert grades.recompute_all(db, date(2027, 2, 15), dormancy=False) == []
    assert jiwoo.grade == "growth"
    # 3/1: 2월 동행 1회 → 기본으로 바로
    grades.recompute_all(db, date(2027, 3, 1))
    assert (jiwoo.grade, jiwoo.payout_rate) == ("basic", Decimal("0.700"))
    db.commit()


def test_growth_to_top_then_drop(db, reset_db):
    jiwoo = db.get(BuddyProfile, 31)  # 시드: 성장 (12월 평가)
    for d in (25, 26, 27, 28, 29, 30, 31):
        _walk(db, 31, date(2027, 1, d), rating=5 if d == 31 else None)
    db.commit()
    grades.recompute_all(db, date(2027, 2, 1))
    assert (jiwoo.grade, jiwoo.payout_rate) == ("top", Decimal("0.800"))  # 성장 → 우수 (1월 11회, 후기 5건 4.6)
    for d in (3, 10, 17, 24, 28):  # 2월 5회 → 우수 조건(7회) 못 채움 → 성장으로 바로
        _walk(db, 31, date(2027, 2, d))
    db.commit()
    grades.recompute_all(db, date(2027, 3, 1))
    assert jiwoo.grade == "growth"
    db.commit()


def test_history_replay_sua(db, reset_db):
    """수아: 6/12 승인 → 7/1 첫 달 기본 → 8/1 성장(7월 7회·후기 4건 4.75) → 9/1 성장(8월 6회, 우수 7회 미달) → 10/1 기본(9월 0회)"""
    sua = db.get(BuddyProfile, 37)
    sua.grade, sua.payout_rate, sua.grade_evaluated_for = "basic", Decimal("0.700"), None
    db.commit()
    seen = []
    for m in (date(2026, 7, 1), date(2026, 8, 1), date(2026, 9, 1), date(2026, 10, 1), date(2027, 1, 1)):
        grades.recompute_all(db, m, dormancy=False)
        seen.append(sua.grade)
    assert seen == ["basic", "growth", "growth", "basic", "basic"]
    # 8/4부터 확정된 여름 동행은 그때 성장 75%로 고정 (시드 값과 맞음)
    assert {db.get(BookingItem, i).payout_rate for i in range(121, 126)} == {Decimal("0.750")}
    db.commit()


def test_rate_locked_at_confirmation(client, tourist, buddy, db, reset_db):
    r = client.post("/api/v1/bookings", json={"traveler": TRAVELER, "items": [BUDDY_ONLY]}, headers=tourist).json()
    item = r["items"][0]
    assert r["platform_fee"] == 7500  # 확정 전: 지우 지금 정산율(75%)로 어림
    client.patch(f"/api/v1/bookings/{r['id']}/items/{item['id']}", json={"action": "approve"}, headers=buddy)
    db.expire_all()
    assert db.get(BookingItem, item["id"]).payout_rate == Decimal("0.750")
    jiwoo = db.get(BuddyProfile, 31)
    jiwoo.grade, jiwoo.payout_rate = "top", Decimal("0.800")  # 나중에 등급이 올라도
    db.commit()
    row = next(i for i in client.get(f"{B}/settlement", headers=buddy).json()["items"] if i["item_id"] == item["id"])
    assert (row["payout_rate"], row["net"], row["fee"]) == (0.75, 22500, 7500)  # 확정 때 정산율 그대로
    assert client.get(f"/api/v1/bookings/{r['id']}", headers=tourist).json()["platform_fee"] == 7500
    new = client.post("/api/v1/bookings", json={"traveler": TRAVELER, "items": [BUDDY_ONLY | {"date": "2027-01-17"}]}, headers=tourist)
    assert new.json()["platform_fee"] == 6000  # 새 예약은 지금 정산율 80%로 어림


def test_dormancy_hides_and_confirm_active_restores(client, tourist, db, reset_db):
    assert 37 not in [b["id"] for b in client.get("/api/v1/buddies").json()["items"]]
    assert 37 not in [c.profile.id for c in matcher.candidates(db, MatchIn(language="en", interests=["photo"]))]  # AI 추천에서도
    resting = client.post("/api/v1/bookings", json={"traveler": TRAVELER, "items": [BUDDY_ONLY | {"ref_id": 37}]}, headers=tourist)
    assert resting.status_code == 409 and resting.json()["error"]["code"] == "BUDDY_RESTING"
    sua = login(client, "sua@a-univ.ac.kr")
    g = client.get(f"{B}/grade", headers=sua).json()
    # 8/19 마지막 동행 → 운영 기간만 세어 30일째(8월 12일 + 겨울 18일) 1/7 휴면
    assert (g["needs_recheck"], g["dormant_since"], g["grade"], g["payout_rate"]) == (True, "2027-01-07", "basic", 0.7)
    assert g["next"]["grade"] == "growth" and g["keep"] is None
    g = client.post(f"{B}/confirm-active", headers=sua).json()
    assert g["needs_recheck"] is False and g["dormant_since"] is None and g["grade"] == "basic"
    listed = {b["id"]: b for b in client.get("/api/v1/buddies").json()["items"]}
    assert listed[37]["grade"] == "basic"
    assert client.post("/api/v1/bookings", json={"traveler": TRAVELER, "items": [BUDDY_ONLY | {"ref_id": 37}]},
                       headers=tourist).status_code == 201
    assert client.post(f"{B}/confirm-active", headers=tourist).status_code == 403


def test_dormancy_does_not_freeze_grade(db, reset_db):
    """v3.7: 휴면이어도 매달 평가한다 (예전엔 등급을 멈췄다)"""
    sua = db.get(BuddyProfile, 37)
    assert sua.needs_recheck is True
    sua.grade, sua.payout_rate, sua.grade_evaluated_for = "top", Decimal("0.800"), date(2026, 11, 1)  # 가정: 11월 평가까지 우수
    db.commit()
    changed = {b.id: b for b in grades.recompute_all(db, TODAY)}
    assert changed[37].grade == "basic" and changed[37].payout_rate == Decimal("0.700") and sua.needs_recheck is True
    # 휴면 일수는 그대로 운영 기간(VACATIONS)만 센다
    assert grades.dormant_from(date(2026, 8, 19), date(2027, 1, 7)) == date(2027, 1, 7)
    assert grades.dormant_from(date(2026, 8, 19), date(2027, 1, 6)) is None
    assert grades.dormant_from(date(2026, 12, 1), TODAY) is None  # 12/21부터 25일만 운영 기간
    db.commit()


def test_admin_recompute_endpoint(client, operator, univ_admin, db, reset_db):
    assert client.post("/api/v1/admin/buddies/recompute-grades", headers=univ_admin).status_code == 403
    assert client.post("/api/v1/admin/buddies/recompute-grades", headers=operator).json()["items"] == []  # 시드에서 1/1 평가 끝
    jiwoo = db.get(BuddyProfile, 31)
    jiwoo.grade, jiwoo.payout_rate, jiwoo.grade_evaluated_for = "basic", Decimal("0.700"), date(2026, 11, 1)
    db.commit()
    rows = client.post("/api/v1/admin/buddies/recompute-grades", headers=operator).json()["items"]
    assert [r["id"] for r in rows] == [31]
    r = rows[0]
    assert (r["grade"], r["payout_rate"], r["evaluated_for"], r["eval_month"]) == ("growth", 0.75, "2026-12", "2026-12")
    assert (r["last_month_walks"], r["total_reviews"], r["avg_rating"], r["needs_recheck"], r["approved_on"]) == (4, 4, 4.5, False, "2026-06-15")
    assert "eval_walks" not in r
    sua = next(x for x in client.get("/api/v1/admin/buddies", headers=operator).json()["items"] if x["id"] == 37)
    assert sua["needs_recheck"] is True and sua["grade"] == "basic" and sua["korean_national"] is True and sua["last_month_walks"] == 0


def test_approve_requires_korean_national(client, univ_admin, operator, db, reset_db):
    doyun = db.get(BuddyProfile, 34)
    doyun.korean_national_confirmed_at = None
    db.commit()
    r = client.patch("/api/v1/admin/buddies/34", json={"action": "approve"}, headers=operator)
    assert r.status_code == 409 and r.json()["error"]["code"] == "NOT_READY" and "한국 국적" in r.json()["error"]["message"]
