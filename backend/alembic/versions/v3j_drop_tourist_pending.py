"""데이터 정리: 여행자 계정에 남은 '승인 대기' 버디 지원서 지우기 (버디로 바꿨다가 되돌린 계정)

Revision ID: v3j_drop_tourist_pending
Revises: v3i_email_otps
Create Date: 2026-11-07 13:00:00.000000
"""
from alembic import op


revision = 'v3j_drop_tourist_pending'
down_revision = 'v3i_email_otps'
branch_labels = None
depends_on = None

ORPHANS = """
SELECT bp.id FROM buddy_profiles bp JOIN users u ON u.id = bp.user_id
WHERE u.role = 'tourist' AND bp.status = 'pending'
  AND NOT EXISTS (SELECT 1 FROM meal_claims m WHERE m.buddy_id = bp.id)
  AND NOT EXISTS (SELECT 1 FROM reports r WHERE r.buddy_id = bp.id)
  AND NOT EXISTS (SELECT 1 FROM buddy_activities a WHERE a.buddy_id = bp.id)
  AND NOT EXISTS (SELECT 1 FROM packages p WHERE p.buddy_profile_id = bp.id)
"""


def upgrade() -> None:
    op.execute(f"UPDATE users SET university_id = NULL WHERE role = 'tourist' AND id IN (SELECT user_id FROM buddy_profiles WHERE id IN ({ORPHANS}))")
    op.execute(f"DELETE FROM buddy_availability WHERE buddy_id IN ({ORPHANS})")
    op.execute(f"DELETE FROM buddy_profiles WHERE id IN ({ORPHANS})")


def downgrade() -> None:
    pass  # 지운 지원서는 되돌리지 않는다
