"""v3.2 관광지 대표 사진 (TourAPI firstimage + 저작권 유형)

Revision ID: v3c_place_photo
Revises: v3b_can_drive
Create Date: 2026-11-06 19:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = 'v3c_place_photo'
down_revision = 'v3b_can_drive'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('places', sa.Column('photo_url', sa.String(length=500), nullable=True))
    op.add_column('places', sa.Column('photo_credit', sa.String(length=200), nullable=True))


def downgrade() -> None:
    op.drop_column('places', 'photo_credit')
    op.drop_column('places', 'photo_url')
