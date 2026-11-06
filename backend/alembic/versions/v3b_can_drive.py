"""v3.1 버디 운전 가능 표시 (표시만 — 유상 운송 금지, 여객자동차 운수사업법 제81조)

Revision ID: v3b_can_drive
Revises: v3_buddy_only
Create Date: 2026-11-06 18:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = 'v3b_can_drive'
down_revision = 'v3_buddy_only'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('buddy_profiles', sa.Column('can_drive', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    op.drop_column('buddy_profiles', 'can_drive')
