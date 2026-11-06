"""여행자 → 버디 신고. 기각(dismissed) 제외 신고가 REPORT_SUSPEND_AT(2)건이 되면 승인 버디를 자동 정지한다."""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import rules
from app.models.booking import Booking, BookingItem, Report
from app.models.supply import BuddyProfile
from app.models.user import User
from app.schemas.admin import AdminReportRow
from app.services import eligibility


def count_for(db: Session, buddy_id: int) -> int:
    return db.scalar(select(func.count()).select_from(Report).where(Report.buddy_id == buddy_id, Report.status != "dismissed")) or 0


def auto_suspend(db: Session, report: Report) -> None:
    prof = db.get(BuddyProfile, report.buddy_id)
    if prof and prof.status == "approved" and count_for(db, prof.id) >= rules.REPORT_SUSPEND_AT:
        prof.status = "suspended"
        report.auto_suspended = True


def row(db: Session, r: Report) -> AdminReportRow:
    prof = db.get(BuddyProfile, r.buddy_id)
    it = db.get(BookingItem, r.booking_item_id) if r.booking_item_id else None
    b = db.get(Booking, it.booking_id) if it else None
    reporter = (b.traveler or {}).get("name") if b and b.tourist_id == r.reporter_id else None
    return AdminReportRow(
        id=r.id, created_at=r.created_at, buddy_id=prof.id, buddy_name=db.get(User, prof.user_id).name, buddy_university=eligibility.university_name(db, prof),
        reporter=reporter or db.get(User, r.reporter_id).name, booking_code=b.code if b else None, category=r.category, text=r.text,
        photo_url=r.photo_url, count_for_buddy=count_for(db, prof.id), status=r.status, action=r.action,
        auto_suspended=r.auto_suspended, buddy_status=prof.status,
    )
