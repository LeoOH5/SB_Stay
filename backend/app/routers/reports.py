"""신고 — 여행자가 버디 항목을 신고한다. 처리(경고·정지·기각)는 운영자 /admin/reports."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core import rules
from app.core.db import get_db
from app.core.deps import get_current_user
from app.core.errors import api_error
from app.models.booking import Booking, BookingItem, Report
from app.models.user import User
from app.schemas.admin import ReportIn, ReportOut
from app.services import reports

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("", response_model=ReportOut, status_code=201)
def create_report(body: ReportIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ReportOut:
    """예약자 본인, 버디 항목만. 저장 후 기각 제외 신고가 2건 이상이면 버디 자동 정지(auto_suspended=true)."""
    if body.category not in rules.REPORT_CATEGORY:
        raise api_error(422, "VALIDATION", f"category는 {' | '.join(rules.REPORT_CATEGORY)}")
    it = db.get(BookingItem, body.booking_item_id)
    if not it:
        raise api_error(404, "NOT_FOUND", "예약 항목을 찾을 수 없습니다")
    if db.get(Booking, it.booking_id).tourist_id != user.id:
        raise api_error(403, "FORBIDDEN", "본인 예약만 신고할 수 있습니다")
    if it.type != "buddy":
        raise api_error(422, "VALIDATION", "버디 항목만 신고할 수 있습니다")
    r = Report(booking_item_id=it.id, reporter_id=user.id, buddy_id=it.ref_id, category=body.category, text=body.text,
               photo_url=body.photo_url, status="open", auto_suspended=False)
    db.add(r)
    db.flush()
    reports.auto_suspend(db, r)
    db.commit()
    db.refresh(r)
    return ReportOut(id=r.id, booking_item_id=r.booking_item_id, buddy_id=r.buddy_id, category=r.category, text=r.text,
                     photo_url=r.photo_url, status=r.status, auto_suspended=r.auto_suspended, created_at=r.created_at)
