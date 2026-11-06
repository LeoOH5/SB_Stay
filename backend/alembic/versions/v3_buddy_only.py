"""v3 buddy only: 해설사 삭제·코스 무료화, 버디 요청·식비·앨범·활동 기록·신고·지원 단계 (docs/v3/CONTRACT.md §2)

Revision ID: v3_buddy_only
Revises: 776d75a1c756
Create Date: 2026-11-06 13:51:43.605600
"""
from alembic import op
import sqlalchemy as sa


revision = 'v3_buddy_only'
down_revision = '776d75a1c756'
branch_labels = None
depends_on = None

FK_COURSE = 'booking_items_course_id_fkey'


def upgrade() -> None:
    op.add_column('users', sa.Column('birth_date', sa.Date(), nullable=True))
    op.add_column('universities', sa.Column('email_domains', sa.JSON(), nullable=True))
    op.alter_column('tours', 'guide_id', existing_type=sa.INTEGER(), nullable=True)
    for name, col in [('personality', sa.JSON()), ('style', sa.JSON()), ('can_help', sa.JSON()),
                      ('school_email', sa.String(length=255)), ('school_email_verified_at', sa.DateTime(timezone=True)),
                      ('code_agreed_at', sa.DateTime(timezone=True)), ('quiz_score', sa.SmallInteger()),
                      ('bank_account', sa.String(length=100))]:
        op.add_column('buddy_profiles', sa.Column(name, col, nullable=True))
    op.add_column('booking_items', sa.Column('request', sa.JSON(), nullable=True))
    op.add_column('booking_items', sa.Column('course_id', sa.Integer(), nullable=True))
    op.add_column('booking_items', sa.Column('meal_count', sa.SmallInteger(), server_default='0', nullable=False))
    op.add_column('booking_items', sa.Column('meal_deposit', sa.Integer(), server_default='0', nullable=False))
    op.add_column('booking_items', sa.Column('album', sa.Boolean(), server_default='false', nullable=False))
    op.create_foreign_key(FK_COURSE, 'booking_items', 'tours', ['course_id'], ['id'])
    op.add_column('reviews', sa.Column('sub_scores', sa.JSON(), nullable=True))
    op.add_column('reviews', sa.Column('tags', sa.JSON(), nullable=True))

    op.create_table('buddy_activities',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('buddy_id', sa.Integer(), nullable=False),
    sa.Column('booking_item_id', sa.Integer(), nullable=True),
    sa.Column('date', sa.Date(), nullable=False),
    sa.Column('places', sa.JSON(), nullable=True),
    sa.Column('foods', sa.Text(), nullable=True),
    sa.Column('note', sa.Text(), nullable=True),
    sa.Column('photos', sa.JSON(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['booking_item_id'], ['booking_items.id'], ),
    sa.ForeignKeyConstraint(['buddy_id'], ['buddy_profiles.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_buddy_activities_buddy_id'), 'buddy_activities', ['buddy_id'], unique=False)
    op.create_table('meal_claims',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('booking_item_id', sa.Integer(), nullable=False),
    sa.Column('buddy_id', sa.Integer(), nullable=False),
    sa.Column('date', sa.Date(), nullable=False),
    sa.Column('place', sa.String(length=100), nullable=False),
    sa.Column('items', sa.Text(), nullable=True),
    sa.Column('amount', sa.Integer(), nullable=False),
    sa.Column('receipt_url', sa.String(length=500), nullable=True),
    sa.Column('status', sa.String(length=10), nullable=False),
    sa.Column('reason', sa.Text(), nullable=True),
    sa.Column('decided_by', sa.Integer(), nullable=True),
    sa.Column('decided_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['booking_item_id'], ['booking_items.id'], ),
    sa.ForeignKeyConstraint(['buddy_id'], ['buddy_profiles.id'], ),
    sa.ForeignKeyConstraint(['decided_by'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_meal_claims_booking_item_id'), 'meal_claims', ['booking_item_id'], unique=False)
    op.create_index(op.f('ix_meal_claims_buddy_id'), 'meal_claims', ['buddy_id'], unique=False)
    op.create_index(op.f('ix_meal_claims_status'), 'meal_claims', ['status'], unique=False)
    op.create_table('reports',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('booking_item_id', sa.Integer(), nullable=True),
    sa.Column('reporter_id', sa.Integer(), nullable=False),
    sa.Column('buddy_id', sa.Integer(), nullable=False),
    sa.Column('category', sa.String(length=20), nullable=False),
    sa.Column('text', sa.Text(), nullable=False),
    sa.Column('photo_url', sa.String(length=500), nullable=True),
    sa.Column('status', sa.String(length=10), nullable=False),
    sa.Column('action', sa.String(length=20), nullable=True),
    sa.Column('auto_suspended', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['booking_item_id'], ['booking_items.id'], ),
    sa.ForeignKeyConstraint(['buddy_id'], ['buddy_profiles.id'], ),
    sa.ForeignKeyConstraint(['reporter_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_reports_buddy_id'), 'reports', ['buddy_id'], unique=False)
    op.create_index(op.f('ix_reports_status'), 'reports', ['status'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_reports_status'), table_name='reports')
    op.drop_index(op.f('ix_reports_buddy_id'), table_name='reports')
    op.drop_table('reports')
    op.drop_index(op.f('ix_meal_claims_status'), table_name='meal_claims')
    op.drop_index(op.f('ix_meal_claims_buddy_id'), table_name='meal_claims')
    op.drop_index(op.f('ix_meal_claims_booking_item_id'), table_name='meal_claims')
    op.drop_table('meal_claims')
    op.drop_index(op.f('ix_buddy_activities_buddy_id'), table_name='buddy_activities')
    op.drop_table('buddy_activities')
    op.drop_column('reviews', 'tags')
    op.drop_column('reviews', 'sub_scores')
    op.drop_constraint(FK_COURSE, 'booking_items', type_='foreignkey')
    for name in ('album', 'meal_deposit', 'meal_count', 'course_id', 'request'):
        op.drop_column('booking_items', name)
    for name in ('bank_account', 'quiz_score', 'code_agreed_at', 'school_email_verified_at', 'school_email',
                 'can_help', 'style', 'personality'):
        op.drop_column('buddy_profiles', name)
    # 코스에 guide_id가 없는 행이 있으면 NOT NULL로 되돌릴 수 없어 그런 행(v3 시드)은 지운다
    op.execute("DELETE FROM tour_places WHERE tour_id IN (SELECT id FROM tours WHERE guide_id IS NULL)")
    op.execute("UPDATE packages SET tour_id = NULL WHERE tour_id IN (SELECT id FROM tours WHERE guide_id IS NULL)")
    op.execute("DELETE FROM tours WHERE guide_id IS NULL")
    op.alter_column('tours', 'guide_id', existing_type=sa.INTEGER(), nullable=False)
    op.drop_column('universities', 'email_domains')
    op.drop_column('users', 'birth_date')
