"""v3.8 실제 도보 경로(OpenStreetMap) 저장 표 walk_routes

Revision ID: v3h_walk_routes
Revises: v3g_monthly_grade
Create Date: 2026-11-08 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = 'v3h_walk_routes'
down_revision = 'v3g_monthly_grade'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 두 장소 사이 한 줄 (작은 id → 큰 id). 경로는 scripts/fetch_walk_routes.py 로 받아 python -m app.seeds 로 넣는다
    op.create_table('walk_routes',
    sa.Column('from_place_id', sa.Integer(), nullable=False),
    sa.Column('to_place_id', sa.Integer(), nullable=False),
    sa.Column('distance_m', sa.Integer(), nullable=False),
    sa.Column('path', sa.JSON(), nullable=False),
    sa.CheckConstraint('from_place_id < to_place_id', name='ck_walk_routes_order'),
    sa.ForeignKeyConstraint(['from_place_id'], ['places.id'], ),
    sa.ForeignKeyConstraint(['to_place_id'], ['places.id'], ),
    sa.PrimaryKeyConstraint('from_place_id', 'to_place_id')
    )
    op.create_index(op.f('ix_walk_routes_to_place_id'), 'walk_routes', ['to_place_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_walk_routes_to_place_id'), table_name='walk_routes')
    op.drop_table('walk_routes')
