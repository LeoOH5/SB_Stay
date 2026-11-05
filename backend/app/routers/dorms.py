"""숙박 — DM-01 대학 목록 · DM-02 객실 목록 · DM-03 객실 상세 · DM-04~06 어드민 객실/개방 기간 (B 담당)"""
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import require_role, scope_university
from app.core.errors import api_error
from app.models.supply import DormRoom, University
from app.models.user import User
from app.schemas.common import ListResponse
from app.schemas.dorms import DormRoomIn, DormRoomOut, DormRoomPatch, UniversityOut, UniversityPatch
from app.services.availability import occupied_rooms

router = APIRouter(tags=["dorms"])


def to_out(db: Session, room: DormRoom, check_in: date | None = None, check_out: date | None = None) -> DormRoomOut:
    uni = db.get(University, room.university_id)
    occ = occupied_rooms(db, room.id, check_in, check_out)
    return DormRoomOut(
        id=room.id, university=UniversityOut.model_validate(uni), building=room.building, room_type=room.room_type,
        price_per_night=room.price_per_night, total_rooms=room.total_rooms, open_from=room.open_from or (uni.open_from if uni else None),
        open_to=room.open_to or (uni.open_to if uni else None), available_rooms=max(room.total_rooms - occ, 0),
        photos=room.photos or [], rules=room.rules or [], active=room.active,
    )


@router.get("/universities", response_model=ListResponse[UniversityOut])
def list_universities(db: Session = Depends(get_db)) -> ListResponse[UniversityOut]:
    """DM-01"""
    rows = db.scalars(select(University).order_by(University.id)).all()
    return ListResponse(items=[UniversityOut.model_validate(u) for u in rows])


@router.get("/dorms", response_model=ListResponse[DormRoomOut])
def list_dorms(
    university_id: int | None = None, check_in: date | None = None, check_out: date | None = None,
    guests: int | None = Query(default=None, ge=1), db: Session = Depends(get_db),
) -> ListResponse[DormRoomOut]:
    """DM-02: 활성 객실만. 날짜를 주면 그 기간의 잔여 객실을 계산하고 개방 기간 밖이면 제외."""
    if check_in and check_out and check_out <= check_in:
        raise api_error(422, "VALIDATION", "check_out은 check_in 뒤여야 합니다")
    q = select(DormRoom).where(DormRoom.active.is_(True)).order_by(DormRoom.university_id, DormRoom.id)
    if university_id:
        q = q.where(DormRoom.university_id == university_id)
    items = []
    for room in db.scalars(q).all():
        out = to_out(db, room, check_in, check_out)
        if check_in and check_out and out.open_from and out.open_to and (check_in < out.open_from or check_out > out.open_to):
            continue
        items.append(out)
    return ListResponse(items=items)


@router.get("/dorms/{room_id}", response_model=DormRoomOut)
def get_dorm(room_id: int, check_in: date | None = None, check_out: date | None = None, db: Session = Depends(get_db)) -> DormRoomOut:
    """DM-03"""
    room = db.get(DormRoom, room_id)
    if not room:
        raise api_error(404, "NOT_FOUND", "객실을 찾을 수 없습니다")
    return to_out(db, room, check_in, check_out)


# ---- 어드민 (univ_admin은 자기 대학만, operator 전체)
@router.get("/admin/dorms", response_model=ListResponse[DormRoomOut])
def admin_list_dorms(user: User = Depends(require_role("univ_admin", "operator")), db: Session = Depends(get_db)) -> ListResponse[DormRoomOut]:
    q = select(DormRoom).order_by(DormRoom.id)
    if user.role == "univ_admin":
        q = q.where(DormRoom.university_id == user.university_id)
    return ListResponse(items=[to_out(db, r) for r in db.scalars(q).all()])


@router.post("/admin/dorms", response_model=DormRoomOut, status_code=201)
def create_dorm(body: DormRoomIn, user: User = Depends(require_role("univ_admin", "operator")), db: Session = Depends(get_db)) -> DormRoomOut:
    """DM-04"""
    university_id = user.university_id if user.role == "univ_admin" else body.university_id
    if not university_id or not db.get(University, university_id):
        raise api_error(422, "VALIDATION", "university_id가 필요합니다")
    if body.room_type not in ("single", "double", "twin"):
        raise api_error(422, "VALIDATION", "room_type은 single | double | twin")
    room = DormRoom(**body.model_dump(exclude={"university_id"}), university_id=university_id)
    db.add(room)
    db.commit()
    db.refresh(room)
    return to_out(db, room)


@router.patch("/admin/dorms/{room_id}", response_model=DormRoomOut)
def update_dorm(room_id: int, body: DormRoomPatch, user: User = Depends(require_role("univ_admin", "operator")), db: Session = Depends(get_db)) -> DormRoomOut:
    """DM-05"""
    room = db.get(DormRoom, room_id)
    if not room:
        raise api_error(404, "NOT_FOUND", "객실을 찾을 수 없습니다")
    scope_university(user, room.university_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(room, k, v)
    db.commit()
    db.refresh(room)
    return to_out(db, room)


@router.patch("/admin/universities/{university_id}", response_model=UniversityOut)
def update_university(university_id: int, body: UniversityPatch, user: User = Depends(require_role("univ_admin", "operator")), db: Session = Depends(get_db)) -> UniversityOut:
    """DM-06: 개방 기간·체크인 안내 수정"""
    uni = db.get(University, university_id)
    if not uni:
        raise api_error(404, "NOT_FOUND", "대학을 찾을 수 없습니다")
    scope_university(user, uni.id)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(uni, k, v)
    db.commit()
    db.refresh(uni)
    return UniversityOut.model_validate(uni)
