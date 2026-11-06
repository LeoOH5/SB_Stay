"""v3.5 코스 시간은 계산값: tours.duration_min 삭제 (services/courses.py가 좌표·머무는 시간으로 계산)

Revision ID: v3f_course_duration
Revises: v3e_ai_usage
Create Date: 2026-11-07 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = 'v3f_course_duration'
down_revision = 'v3e_ai_usage'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column('tours', 'duration_min')


def downgrade() -> None:
    # 손으로 적던 값은 되살릴 수 없어 120분으로 채운다
    op.add_column('tours', sa.Column('duration_min', sa.Integer(), server_default='120', nullable=False))
