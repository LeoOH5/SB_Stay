"""v3.2 버디 등급·정산율·휴면 + 한국 국적 확인

Revision ID: v3d_buddy_grade
Revises: v3c_place_photo
Create Date: 2026-11-06 20:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = 'v3d_buddy_grade'
down_revision = 'v3c_place_photo'
branch_labels = None
depends_on = None

BUDDY_COLS = ('grade', 'payout_rate', 'grade_updated_at', 'needs_recheck', 'dormant_since', 'active_on', 'korean_national_confirmed_at')


def upgrade() -> None:
    op.add_column('buddy_profiles', sa.Column('grade', sa.String(length=10), server_default='basic', nullable=False))
    op.add_column('buddy_profiles', sa.Column('payout_rate', sa.Numeric(4, 3), server_default='0.700', nullable=False))
    op.add_column('buddy_profiles', sa.Column('grade_updated_at', sa.Date(), nullable=True))
    op.add_column('buddy_profiles', sa.Column('needs_recheck', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('buddy_profiles', sa.Column('dormant_since', sa.Date(), nullable=True))
    op.add_column('buddy_profiles', sa.Column('active_on', sa.Date(), nullable=True))
    op.add_column('buddy_profiles', sa.Column('korean_national_confirmed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('booking_items', sa.Column('payout_rate', sa.Numeric(4, 3), nullable=True))


def downgrade() -> None:
    op.drop_column('booking_items', 'payout_rate')
    for c in reversed(BUDDY_COLS):
        op.drop_column('buddy_profiles', c)
