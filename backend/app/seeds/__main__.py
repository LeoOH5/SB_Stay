"""시드 적재: python -m app.seeds  (기존 데이터 삭제 후 재적재)

v3: guides는 빈 표, tours는 무료 코스(guide_id 없음). 예약은 숙박 + 기간 안 버디.

data/*.json 을 테이블 순서대로 넣는다. 데모 날짜는 2027년 1월(겨울방학) 고정, 가격은 전부 가정값.
v3.2: 마지막에 버디 등급·휴면을 데모 '오늘'(DEMO_TODAY, 없으면 2027-01-14) 기준으로 계산한다.
v3.7: 등급은 매달 1일 평가라, 가장 이른 승인일 다음 달부터 '오늘'이 든 달 1일까지 차례로 평가를 다시 해 본다(grades.replay).
      그래서 시드 등급 = 2027-01-01 평가(2026년 12월 동행) 결과. 휴면은 마지막에 '오늘' 기준으로 한 번.
v3.8: data/walk_routes.json(실제 도보 경로, scripts/fetch_walk_routes.py가 만듦)이 있으면 walk_routes 표에 넣는다.
      저장소에는 이 파일을 두지 않는다 → 없으면 0줄이고 코스 걷는 시간은 직선 × 1.3 추정 그대로 (테스트도 늘 같은 숫자).
      places.json에 없는 장소가 낀 줄은 건너뛴다.
"""
import json
from datetime import date
from pathlib import Path

from sqlalchemy import delete, text

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.core.security import hash_password
from app.models import (
    AiPlan,
    AiUsage,
    Booking,
    BookingItem,
    BuddyActivity,
    BuddyAvailability,
    BuddyProfile,
    Content,
    CourseSurvey,
    DormRoom,
    Guide,
    MealClaim,
    Message,
    Notification,
    Package,
    Payment,
    Place,
    Report,
    Review,
    Tour,
    TourPlace,
    University,
    User,
    WalkRoute,
)
from app.seeds import overviews
from app.services import grades

DATA = Path(__file__).parent / "data"
SEED_TODAY = date(2027, 1, 14)  # 데모 '오늘' 기본값
ORDER = [
    ("universities.json", University),
    ("users.json", User),
    ("dorm_rooms.json", DormRoom),
    ("guides.json", Guide),
    ("places.json", Place),
    ("tours.json", Tour),
    ("tour_places.json", TourPlace),
    ("walk_routes.json", WalkRoute),  # v3.8 없으면 0줄
    ("buddy_profiles.json", BuddyProfile),
    ("buddy_availability.json", BuddyAvailability),
    ("packages.json", Package),
    ("contents.json", Content),
    ("bookings.json", Booking),
    ("booking_items.json", BookingItem),
    ("reviews.json", Review),
    ("buddy_activities.json", BuddyActivity),
    ("meal_claims.json", MealClaim),
    ("reports.json", Report),
]
DELETE_ORDER = [CourseSurvey, AiUsage, Report, MealClaim, BuddyActivity, Notification, Message, Review, AiPlan, Payment, BookingItem, Booking, Content, Package,
                BuddyAvailability, BuddyProfile, WalkRoute, TourPlace, Tour, Place, Guide, DormRoom, User, University]


def load(name: str) -> list[dict]:
    p = DATA / name
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else []


def walk_rows(rows: list[dict], place_ids: set[int]) -> list[dict]:
    """v3.8 도보 경로 줄: 두 장소가 모두 places.json에 있고 from < to 인 줄만 (반대로 적혀 있으면 path를 뒤집어 맞춘다)"""
    out, seen = [], set()
    for r in rows:
        a, b = int(r["from_place_id"]), int(r["to_place_id"])
        if a == b or a not in place_ids or b not in place_ids:
            continue
        path = r.get("path") or []
        if a > b:
            a, b, path = b, a, path[::-1]
        if (a, b) in seen:
            continue
        seen.add((a, b))
        out.append({"from_place_id": a, "to_place_id": b, "distance_m": int(r["distance_m"]), "path": path})
    return out


def main() -> None:
    with SessionLocal() as db:
        for model in DELETE_ORDER:
            db.execute(delete(model))
        place_ov = {str(k): v for k, v in (load(overviews.OVERVIEWS) or {}).items()}
        for fname, model in ORDER:
            rows = load(fname)
            if model is Place and place_ov:  # AI-02 근거: TourAPI 개요를 story_doc·sources에 붙인다
                rows = [overviews.merge(r, place_ov.get(str(r["id"]))) for r in rows]
            if model is WalkRoute:
                rows = walk_rows(rows, {p["id"] for p in load("places.json")})
            for row in rows:
                if model is User and "password" in row:
                    row["password_hash"] = hash_password(row.pop("password"))
                db.add(model(**row))
            db.flush()
            print(f"{fname}: {len(rows)}")
        # 명시적 id로 넣었으니 시퀀스를 max(id)로 맞춘다
        for _, model in ORDER:
            table = model.__tablename__
            if "id" in model.__table__.columns and model.__table__.columns["id"].type.python_type is int:
                db.execute(text(f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), COALESCE((SELECT MAX(id) FROM {table}), 0) + 1, false)"))
        today = get_settings().demo_today or SEED_TODAY
        first = min((b.approved_on for b in db.query(BuddyProfile).all() if b.approved_on), default=None)
        if first:
            grades.replay(db, first, today)
        for b in grades.recompute_all(db, today):
            print(f"grade: buddy {b.id} → {b.grade} {b.payout_rate}" + (" (휴면)" if b.needs_recheck else ""))
        db.commit()
    print("seed done")


if __name__ == "__main__":
    main()
