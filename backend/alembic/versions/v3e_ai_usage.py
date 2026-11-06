"""v3.4 무료 AI 산책 코스: AI-02 질문 수(ai_usage) · 코스 완료 설문(course_surveys)

Revision ID: v3e_ai_usage
Revises: v3d_buddy_grade
Create Date: 2026-11-06 23:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = 'v3e_ai_usage'
down_revision = 'v3d_buddy_grade'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('ai_usage',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('day', sa.Date(), nullable=False),
    sa.Column('questions', sa.SmallInteger(), server_default='0', nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'day', name='uq_ai_usage_user_day')
    )
    op.create_index(op.f('ix_ai_usage_user_id'), 'ai_usage', ['user_id'], unique=False)
    op.create_table('course_surveys',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('tour_id', sa.Integer(), nullable=False),
    sa.Column('satisfaction', sa.SmallInteger(), nullable=False),
    sa.Column('pain', sa.String(length=20), nullable=False),
    sa.Column('want_buddy', sa.Boolean(), nullable=False),
    sa.Column('plan', sa.String(length=10), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['tour_id'], ['tours.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_course_surveys_tour_id'), 'course_surveys', ['tour_id'], unique=False)
    op.create_index(op.f('ix_course_surveys_user_id'), 'course_surveys', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_course_surveys_user_id'), table_name='course_surveys')
    op.drop_index(op.f('ix_course_surveys_tour_id'), table_name='course_surveys')
    op.drop_table('course_surveys')
    op.drop_index(op.f('ix_ai_usage_user_id'), table_name='ai_usage')
    op.drop_table('ai_usage')
