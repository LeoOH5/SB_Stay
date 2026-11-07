"""버디 지원 학교 메일 인증번호 email_otps

Revision ID: v3i_email_otps
Revises: v3h_walk_routes
Create Date: 2026-11-07 11:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = 'v3i_email_otps'
down_revision = 'v3h_walk_routes'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('email_otps',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('code_hash', sa.String(length=64), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('attempts', sa.Integer(), nullable=False),
    sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_email_otps_user_id'), 'email_otps', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_email_otps_user_id'), table_name='email_otps')
    op.drop_table('email_otps')
