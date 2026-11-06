"""v3.2 버디 등급·정산율·휴면 (services/grades)"""
from datetime import date
from decimal import Decimal

import pytest

from app.core import rules
from app.models import BookingItem, BuddyProfile
from app.schemas.ai import MatchIn
from app.services import grades, matcher
from tests.conftest import login

TODAY = date(2027, 1, 14)
B = "/api/v1/buddy"
BUDDY_ONLY = {"type": "buddy", "ref_id": 31, "date": "2027-01-16", "time": "14:00", "duration_min": 120}
TRAVELER = {"name": "Emma Clark", "nationality": "US", "email": "emma@example.com", "guests": 1}


@pytest.mark.parametrize(("rating", "walks", "reviews", "grade"), [
    ("4.3", 5, 3, "growth"), ("4.29", 5, 3, "basic"), ("4.3", 4, 3, "basic"), ("4.3", 5, 2, "basic"),
    ("4.5", 15, 5, "top"), ("4.49", 15, 5, "growth"), ("4.5", 14, 5, "growth"), ("4.5", 15, 4, "growth"),
    (None, 20, 0, "basic"), ("5", 0, 0, "basic"),
])
def test_grade_boundaries(rating, walks, reviews, grade):
    g = grades.grade_for(Decimal(rating) if rating else None, walks, reviews)
    assert g.code == grade and g.rate == {"basic": Decimal("0.7"), "growth": Decimal("0.75"), "top": Decimal("0.8")}[grade]


def test_window_is_current_plus_previous_vacation(db):
    assert [n for n, _, _ in grades.window(TODAY)] == ["2026 여름방학", "2027 겨울방학"]
    assert grades.window_out(TODAY) == {"from": "2026-06-22", "to": "2027-02-28", "label": "2026 여름방학 + 2027 겨울방학"}
    assert [n for n, _, _ in grades.window(date(2026, 11, 6))] == ["2025 겨울방학", "2026 여름방학"]  # 방학 밖 → 가장 최근 방학
    assert grades.window(date(2025, 6, 1)) == []
    jiwoo = db.get(BuddyProfile, 31)
    ev = grades.evaluate(db, jiwoo, TODAY)  # 여름 6회 + 1월 완료 3회(1/20은 아직), 후기 4건 평균 4.5
    assert (ev.walks, ev.reviews, ev.rating, ev.grade.code) == (9, 4, 4.5, "growth")
    assert grades.evaluate(db, db.get(BuddyProfile, 32), TODAY).walks == 0  # 11/21 동행은 방학 밖이라 안 셈
    assert grades.evaluate(db, db.get(BuddyProfile, 37), date(2026, 7, 1)).walks == 3  # 그날까지 끝난 것만


def test_seeded_grades(client):
    g = {b["id"]: b["grade"] for b in client.get("/api/v1/buddies").json()["items"]}
    assert g == {31: "growth", 32: "basic", 35: "basic", 36: "basic"}  # 수아(37)는 휴면이라 목록에 없음
    assert client.get("/api/v1/buddies/37").json()["grade"] == "top"
    r = client.get(f"{B}/grade", headers=login(client, "jiwoo@a-univ.ac.kr")).json()
    assert (r["grade"], r["payout_rate"], r["needs_recheck"], r["updated_at"]) == ("growth", 0.75, False, "2027-01-14")
    assert r["window"] == {"from": "2026-06-22", "to": "2027-02-28", "label": "2026 여름방학 + 2027 겨울방학"}
    assert r["stats"] == {"rating": 4.5, "walks": 9, "reviews": 4}
    assert r["next"] == {"grade": "top", "payout_rate": 0.8, "need": {"rating": 4.5, "walks": 15, "reviews": 5}}


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
    # 8/19 마지막 동행 → 운영 기간만 세어 30일째(8월 12일 + 겨울 18일) 1/7 휴면. 예약이 없어서라 정산율은 그대로
    assert (g["needs_recheck"], g["dormant_since"], g["grade"], g["payout_rate"]) == (True, "2027-01-07", "top", 0.8)
    assert g["next"] is None
    g = client.post(f"{B}/confirm-active", headers=sua).json()
    assert g["needs_recheck"] is False and g["grade"] == "top" and g["payout_rate"] == 0.8
    listed = {b["id"]: b for b in client.get("/api/v1/buddies").json()["items"]}
    assert listed[37]["grade"] == "top"
    assert client.post("/api/v1/bookings", json={"traveler": TRAVELER, "items": [BUDDY_ONLY | {"ref_id": 37}]},
                       headers=tourist).status_code == 201
    assert client.post(f"{B}/confirm-active", headers=tourist).status_code == 403


def test_dormancy_does_not_lower_grade(db, monkeypatch, reset_db):
    """다음 여름(가정) 재산정: 여름 실적이 빠져 지우는 기본으로 내려가지만, 휴면 중인 수아는 우수 그대로"""
    monkeypatch.setattr(rules, "VACATIONS", [*rules.VACATIONS, ("2027 여름방학", date(2027, 6, 21), date(2027, 8, 31))])
    changed = {b.id: b for b in grades.recompute_all(db, date(2027, 7, 10))}
    db.commit()
    assert changed[31].grade == "basic" and changed[31].payout_rate == Decimal("0.7")  # 1월 완료 4회 < 5
    sua = db.get(BuddyProfile, 37)
    assert 37 not in changed and (sua.grade, sua.payout_rate, sua.needs_recheck) == ("top", Decimal("0.800"), True)
    assert grades.dormant_from(date(2026, 8, 19), date(2027, 1, 7)) == date(2027, 1, 7)
    assert grades.dormant_from(date(2026, 8, 19), date(2027, 1, 6)) is None
    assert grades.dormant_from(date(2026, 12, 1), TODAY) is None  # 12/21부터 25일만 운영 기간


def test_admin_recompute_endpoint(client, operator, univ_admin, db, reset_db):
    assert client.post("/api/v1/admin/buddies/recompute-grades", headers=univ_admin).status_code == 403
    assert client.post("/api/v1/admin/buddies/recompute-grades", headers=operator).json()["items"] == []  # 시드에서 이미 계산
    jiwoo = db.get(BuddyProfile, 31)
    jiwoo.grade, jiwoo.payout_rate = "basic", Decimal("0.700")
    db.commit()
    rows = client.post("/api/v1/admin/buddies/recompute-grades", headers=operator).json()["items"]
    assert [r["id"] for r in rows] == [31]
    r = rows[0]
    assert (r["grade"], r["payout_rate"], r["eval_rating"], r["eval_walks"], r["eval_reviews"], r["needs_recheck"]) == ("growth", 0.75, 4.5, 9, 4, False)
    sua = next(x for x in client.get("/api/v1/admin/buddies", headers=operator).json()["items"] if x["id"] == 37)
    assert sua["needs_recheck"] is True and sua["grade"] == "top" and sua["korean_national"] is True


def test_approve_requires_korean_national(client, univ_admin, operator, db, reset_db):
    doyun = db.get(BuddyProfile, 34)
    doyun.korean_national_confirmed_at = None
    db.commit()
    r = client.patch("/api/v1/admin/buddies/34", json={"action": "approve"}, headers=operator)
    assert r.status_code == 409 and r.json()["error"]["code"] == "NOT_READY" and "한국 국적" in r.json()["error"]["message"]
