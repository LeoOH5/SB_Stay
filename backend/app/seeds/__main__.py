"""시드 적재: python -m app.seeds  (기존 데이터 삭제 후 재적재)

data/*.json 을 테이블 순서대로 넣는다. 데모 날짜는 2027년 1월(겨울방학) 고정, 가격은 전부 가정값.
"""
import json
from pathlib import Path

from sqlalchemy import delete

from app.core.db import SessionLocal
from app.core.security import hash_password
from app.models import (
    AiPlan,
    Booking,
    BookingItem,
    BuddyAvailability,
    BuddyProfile,
    Content,
    DormRoom,
    Guide,
    Message,
    Notification,
    Package,
    Place,
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
]
DELETE_ORDER = [Notification, Message, Review, AiPlan, BookingItem, Booking, Content, Package,
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
        db.commit()
    print("seed done")


if __name__ == "__main__":
    main()
