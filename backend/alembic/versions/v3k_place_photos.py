"""데이터: 사진 없던 관광지 9곳에 사진 채우기 (Wikimedia Commons CC · 공공누리 제1유형, 출처는 docs/photo-credits.md)

운영 DB는 시드를 다시 넣지 않으므로, photo_url 이 비어 있는 장소에만 채운다.

Revision ID: v3k_place_photos
Revises: v3j_drop_tourist_pending
Create Date: 2026-11-07 14:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = 'v3k_place_photos'
down_revision = 'v3j_drop_tourist_pending'
branch_labels = None
depends_on = None

PHOTOS = [
    (106, "/places/108.jpg", "바로 옆 선잠단지 · 1997au · Wikimedia Commons · CC BY-SA 4.0"),
    (107, "/places/107.jpg", "북악구간 숙정문 · Tom Page · Wikimedia Commons · CC BY-SA 2.0"),
    (108, "/places/108.jpg", "1997au · Wikimedia Commons · CC BY-SA 4.0"),
    (109, "/places/109.jpg", "한국학중앙연구원·김형수 · 공공누리 제1유형"),
    (113, "/places/113.jpg", "Korea.net/KOCIS (Jeon Han) · Wikimedia Commons · CC BY-SA 2.0"),
    (118, "/places/118.jpg", "국가유산청 · 공공누리 제1유형"),
    (123, "/places/123.jpg", "el_ave · Wikimedia Commons · CC BY 2.0"),
    (126, "/places/126.jpg", "오모군 · Wikimedia Commons · CC BY 4.0"),
    (130, "/places/130.jpg", "바로 옆 의릉 · Younghopark7 · Wikimedia Commons · CC BY-SA 3.0"),
]


def upgrade() -> None:
    q = sa.text("UPDATE places SET photo_url = :u, photo_credit = :c WHERE id = :i AND (photo_url IS NULL OR photo_url = '')")
    for i, u, c in PHOTOS:
        op.execute(q.bindparams(i=i, u=u, c=c))


def downgrade() -> None:
    q = sa.text("UPDATE places SET photo_url = NULL, photo_credit = NULL WHERE id = :i AND photo_url = :u")
    for i, u, _ in PHOTOS:
        op.execute(q.bindparams(i=i, u=u))
