"""BK-10 알림 목록 — 발송(푸시·메일)은 MVP 제외, 승인·확정·취소 시 DB에 쌓인 상태값만 제공"""
from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.models.booking import Notification
from app.models.user import User

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    rows = db.scalars(select(Notification).where(Notification.user_id == user.id).order_by(Notification.id.desc()).limit(50)).all()
    return {"items": [{"id": n.id, "type": n.type, "title": n.title, "body": n.body, "booking_item_id": n.booking_item_id, "read_at": n.read_at, "created_at": n.created_at} for n in rows], "next_cursor": None}


@router.post("/read-all")
def read_all(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    db.execute(update(Notification).where(Notification.user_id == user.id, Notification.read_at.is_(None)).values(read_at=datetime.now(UTC)))
    db.commit()
    return {"ok": True}
