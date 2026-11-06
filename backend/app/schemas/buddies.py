from datetime import date

from pydantic import BaseModel

from app.schemas.tours import ReviewOut


class BuddyVerified(BaseModel):
    school_email: bool = False  # 학교 메일 인증
    trained: bool = False  # 약속 동의 + 교육 퀴즈 통과
    residence: bool = False  # v3.7 성북구 거주 경로 (운영자가 서류 확인 후 승인)


class BuddyOut(BaseModel):
    """BD-01 목록 항목 (프론트 Buddy 타입과 같은 모양). 연락처 등 개인정보는 넣지 않는다."""
    id: int
    name: str
    university: str
    university_id: int | None = None
    major: str | None = None
    year: int | None = None
    languages: list[str] = []
    interests: list[str] = []
    intro: str | None = None
    avatar: str | None = None
    hourly_fee: int = 0
    available_dates: list[date] = []
    rating: float = 0
    review_count: int = 0
    personality: list[str] = []
    style: list[str] = []
    can_help: list[str] = []
    can_drive: bool = False  # 운전 가능 표시만 (차량 이동 서비스 없음)
    sub_scores: dict[str, float] | None = None  # {kind, talk, punctual, local} 평균, 없으면 null
    tags_top: list[str] = []  # 리뷰 태그 코드 최대 3
    walk_count: int = 0  # 끝난 동행 수
    grade: str = "basic"  # 공개 배지: basic | growth | top (화면은 성장·우수만 표시)
    verified: BuddyVerified = BuddyVerified()


class ActivityPublic(BaseModel):
    """공개 활동 기록 (여행자 이름·메모·사진 없음)"""
    date: date
    places: list[str] = []
    foods: str | None = None


class BuddyDetailOut(BuddyOut):
    """BD-02: 목록 항목 + 리뷰 샘플 + 최근 활동 3개"""
    reviews: list[ReviewOut] = []
    recent_activities: list[ActivityPublic] = []
