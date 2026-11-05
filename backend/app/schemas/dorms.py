from datetime import date

from pydantic import BaseModel


class UniversityOut(BaseModel):
    id: int
    name: str
    name_en: str
    address: str | None = None
    open_from: date | None = None
    open_to: date | None = None

    model_config = {"from_attributes": True}


class DormRoomOut(BaseModel):
    id: int
    university: UniversityOut
    building: str
    room_type: str
    price_per_night: int
    total_rooms: int
    open_from: date | None
    open_to: date | None
    available_rooms: int
    photos: list[str] = []
    rules: list[str] = []
    active: bool = True


class DormRoomIn(BaseModel):
    university_id: int | None = None  # univ_admin은 자기 대학으로 고정
    building: str
    room_type: str  # single | double | twin
    price_per_night: int
    total_rooms: int
    open_from: date | None = None
    open_to: date | None = None
    rules: list[str] = []
    photos: list[str] = []
    active: bool = True


class DormRoomPatch(BaseModel):
    building: str | None = None
    room_type: str | None = None
    price_per_night: int | None = None
    total_rooms: int | None = None
    open_from: date | None = None
    open_to: date | None = None
    rules: list[str] | None = None
    photos: list[str] | None = None
    active: bool | None = None


class UniversityPatch(BaseModel):
    open_from: date | None = None
    open_to: date | None = None
    checkin_guide: dict | None = None
