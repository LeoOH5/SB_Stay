"""v3.7 버디 등급 매달 평가 · 자격 두 경로(성북구 대학 메일 / 성북구 거주) · 사전 교육 영상

Revision ID: v3g_monthly_grade
Revises: v3f_course_duration
Create Date: 2026-11-07 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = 'v3g_monthly_grade'
down_revision = 'v3f_course_duration'
branch_labels = None
depends_on = None

COLS = ('approved_on', 'grade_evaluated_for', 'eligibility', 'school_name', 'residence_proof_url',
        'enrollment_proof_url', 'residence_submitted_at', 'education_watched')


def upgrade() -> None:
    op.add_column('buddy_profiles', sa.Column('approved_on', sa.Date(), nullable=True))
    op.add_column('buddy_profiles', sa.Column('grade_evaluated_for', sa.Date(), nullable=True))
    op.add_column('buddy_profiles', sa.Column('eligibility', sa.String(length=20), nullable=True))
    op.add_column('buddy_profiles', sa.Column('school_name', sa.String(length=100), nullable=True))
    op.add_column('buddy_profiles', sa.Column('residence_proof_url', sa.String(length=500), nullable=True))
    op.add_column('buddy_profiles', sa.Column('enrollment_proof_url', sa.String(length=500), nullable=True))
    op.add_column('buddy_profiles', sa.Column('residence_submitted_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('buddy_profiles', sa.Column('education_watched', sa.JSON(), nullable=True))
    op.alter_column('buddy_profiles', 'university_id', existing_type=sa.Integer(), nullable=True)
    # 있던 버디: 메일 인증했으면 대학 메일 경로, 승인된 버디는 약속 동의일(없으면 메일 인증일)을 승인일로
    op.execute("UPDATE buddy_profiles SET eligibility = 'school_email' WHERE school_email_verified_at IS NOT NULL")
    op.execute("UPDATE buddy_profiles SET approved_on = COALESCE(code_agreed_at, school_email_verified_at)::date "
                "WHERE status IN ('approved', 'suspended')")


def downgrade() -> None:
    # 다른 대학(거주 경로) 버디는 되돌릴 대학이 없어 첫 대학으로 둔다 (데모 데이터용)
    op.execute("UPDATE buddy_profiles SET university_id = (SELECT MIN(id) FROM universities) WHERE university_id IS NULL")
    op.alter_column('buddy_profiles', 'university_id', existing_type=sa.Integer(), nullable=False)
    for c in reversed(COLS):
        op.drop_column('buddy_profiles', c)
