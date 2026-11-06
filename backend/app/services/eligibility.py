"""버디 자격·사전 교육·승인 조건 (v3.7).

자격(지원 1단계)은 두 경로 중 하나:
- school_email: 성북구 대학 메일 인증(인증번호). 소속 대학이 자동으로 정해진다.
- residence: 성북구에 사는 대학생(어느 대학이든). 주소 증빙 + 재학 증명 사진을 올리고, 운영자가 승인(AD-04) 때 보고 확인한다.
공통: 대한민국 국적, 만 19세 이상, 버디 약속 7개, 사전 교육 영상 5개를 다 보고 퀴즈 8/10 이상.
버디는 유료 역사 해설을 하지 않는다(약속·퀴즈·교육 영상에 그대로).
"""
from sqlalchemy.orm import Session

from app.core import rules
from app.core.config import get_settings
from app.models.supply import BuddyProfile, University
from app.models.user import User


def university_name(db: Session, prof: BuddyProfile) -> str:
    """성북구 대학이면 그 이름, 거주 경로로 다른 대학이면 적은 학교 이름"""
    uni = db.get(University, prof.university_id) if prof.university_id else None
    return uni.name if uni else (prof.school_name or "")


def eligible(prof: BuddyProfile | None) -> bool:
    """1단계 자격 확인을 마쳤나 (메일 인증 또는 거주 서류 제출)"""
    if not prof:
        return False
    if prof.eligibility == "residence":
        return bool(prof.residence_submitted_at and prof.residence_proof_url and prof.enrollment_proof_url)
    return prof.school_email_verified_at is not None


def watched(prof: BuddyProfile | None) -> list[str]:
    """다 본 영상 (교육 목록 순서)"""
    seen = set((prof.education_watched or []) if prof else [])
    return [v for v in rules.EDUCATION_IDS if v in seen]


def education_done(prof: BuddyProfile | None) -> bool:
    return len(watched(prof)) == len(rules.EDUCATION_IDS)


def age_ok(user: User) -> bool:
    return bool(user.birth_date) and rules.age_on(user.birth_date, get_settings().today()) >= rules.BUDDY_MIN_AGE


def missing_for_approval(db: Session, prof: BuddyProfile) -> list[str]:
    """승인 조건: 자격 경로 하나 · 한국 국적 · 만 19세 · 약속 동의 · 교육 영상 · 퀴즈 8점 이상.
    거주 경로는 서류 두 장이 있어야 하고, 운영자의 승인이 곧 서류 확인이다."""
    u = db.get(User, prof.user_id)
    miss = []
    if prof.eligibility == "residence":
        if not prof.residence_proof_url:
            miss.append("성북구 주소 증빙")
        if not prof.enrollment_proof_url:
            miss.append("재학 증명")
    elif not prof.school_email_verified_at:
        miss.append("자격 확인(성북구 대학 메일 또는 성북구 거주)")
    if not prof.korean_national_confirmed_at:
        miss.append("한국 국적 확인")
    if not age_ok(u):
        miss.append(f"만 {rules.BUDDY_MIN_AGE}세 확인")
    if not prof.code_agreed_at:
        miss.append("버디 약속 동의")
    if not education_done(prof):
        miss.append(f"교육 영상 {len(watched(prof))}/{len(rules.EDUCATION_IDS)}")
    if (prof.quiz_score or 0) < rules.QUIZ_PASS:
        miss.append(f"교육 퀴즈 {rules.QUIZ_PASS}점 이상")
    return miss
