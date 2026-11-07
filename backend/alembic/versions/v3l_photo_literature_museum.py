"""데이터: 성북근현대문학관 사진 (서울특별시 내 손안에 서울, 공공누리 제4유형 — 출처표시·변경금지·비상업)

Revision ID: v3l_photo_literature_museum
Revises: v3k_place_photos
Create Date: 2026-11-07 15:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = 'v3l_photo_literature_museum'
down_revision = 'v3k_place_photos'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(sa.text("UPDATE places SET photo_url = :u, photo_credit = :c WHERE id = 111 AND (photo_url IS NULL OR photo_url = '')")
               .bindparams(u="/places/111.jpg", c="서울특별시 내 손안에 서울(ⓒ김수정) · 공공누리 제4유형"))


def downgrade() -> None:
    op.execute(sa.text("UPDATE places SET photo_url = NULL, photo_credit = NULL WHERE id = 111 AND photo_url = '/places/111.jpg'"))
