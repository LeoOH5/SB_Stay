"""시드 적재: python -m app.seeds  (기존 데이터 삭제 후 재적재)

v3: guides는 빈 표, tours는 무료 코스(guide_id 없음). 예약은 숙박 + 기간 안 버디.

data/*.json 을 테이블 순서대로 넣는다. 데모 날짜는 2027년 1월(겨울방학) 고정, 가격은 전부 가정값.
"""
import json
from pathlib import Path

from sqlalchemy import delete, text

from app.core.db import SessionLocal
from app.core.security import hash_password
from app.models import (
    AiPlan,
    Booking,
    BookingItem,
    BuddyActivity,
    BuddyAvailability,
    BuddyProfile,
    Content,
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
)

DATA = Path(__file__).parent / "data"
ORDER = [
    ("universities.json", University),
    ("users.json", User),
    ("dorm_rooms.json", DormRoom),
    ("guides.json", Guide),
    ("places.json", Place),
    ("tours.json", Tour),
    ("tour_places.json", TourPlace),
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
DELETE_ORDER = [Report, MealClaim, BuddyActivity, Notification, Message, Review, AiPlan, Payment, BookingItem, Booking, Content, Package,
                BuddyAvailability, BuddyProfile, TourPlace, Tour, Place, Guide, DormRoom, User, University]


def load(name: str) -> list[dict]:
    p = DATA / name
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else []


def main() -> None:
    with SessionLocal() as db:
        for model in DELETE_ORDER:
            db.execute(delete(model))
        for fname, model in ORDER:
            rows = load(fname)
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
        db.commit()
    print("seed done")


if __name__ == "__main__":
    main()
