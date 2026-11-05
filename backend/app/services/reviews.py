"""투어·버디 리뷰 조회 (TR-04, BD-02, /buddies/{id}/reviews 공용).

리뷰는 BK-08로 예약 항목(booking_items)마다 하나씩 남는다. 아직 실제 리뷰가 없으면
데모 화면이 비지 않도록 고정 샘플을 돌려준다(목업 처리, 명세 TR-04 비고와 같음).
"""
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Booking, BookingItem, Review, User
from app.schemas.tours import ReviewOut

SAMPLES: dict[str, list[ReviewOut]] = {
    "tour": [
        ReviewOut(id=-1, rating=5, text="해설이 정말 좋았어요. 심우장 이야기가 기억에 남아요.", author="Mia", created_at=date(2027, 1, 20)),
        ReviewOut(id=-2, rating=5, text="The guide explained everything in English. Loved the hanok alleys.", author="Lena", created_at=date(2027, 1, 18)),
        ReviewOut(id=-3, rating=4, text="코스가 알차요. 언덕이 있어서 편한 신발 추천합니다.", author="Jun", created_at=date(2027, 1, 16)),
    ],
    "buddy": [
        ReviewOut(id=-11, rating=5, text="We talked about poetry over coffee.", author="Lena", created_at=date(2027, 1, 21)),
        ReviewOut(id=-12, rating=4, text="학교 식당이랑 골목 맛집까지 친절하게 알려 줬어요.", author="Yuki", created_at=date(2027, 1, 19)),
        ReviewOut(id=-13, rating=5, text="Felt like walking with a local friend. Great photo spots!", author="Emma", created_at=date(2027, 1, 15)),
    ],
}


def item_reviews(db: Session, item_type: str, ref_id: int) -> tuple[list[ReviewOut], bool]:
    """(리뷰 목록, 샘플 여부). 실제 리뷰가 하나라도 있으면 실제 리뷰만 돌려준다."""
    rows = db.execute(
        select(Review, User.name)
        .join(BookingItem, BookingItem.id == Review.booking_item_id)
        .join(Booking, Booking.id == BookingItem.booking_id)
        .join(User, User.id == Booking.tourist_id)
        .where(BookingItem.type == item_type, BookingItem.ref_id == ref_id)
        .order_by(Review.id.desc())
    ).all()
    if rows:
        return [ReviewOut(id=r.id, rating=r.rating, text=r.text, author=(name or "").split(" ")[0],
                          created_at=r.created_at.date()) for r, name in rows], False
    samples = SAMPLES.get(item_type, [])
    if item_type == "buddy":  # 버디마다 화면이 똑같아 보이지 않게 샘플 개수를 2~3개로 다르게
        samples = samples[: 2 + ref_id % 2]
    return samples, True


def average(reviews: list[ReviewOut]) -> float | None:
    return round(sum(r.rating for r in reviews) / len(reviews), 1) if reviews else None
