"""FastAPI 의존성: 인증·역할 체크. 권한은 DB RLS가 아니라 여기서 처리한다."""
from collections.abc import Callable

from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.errors import api_error
from app.core.security import decode_token
from app.models.user import User


def get_current_user(
    authorization: str | None = Header(default=None), db: Session = Depends(get_db)
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise api_error(401, "UNAUTHORIZED", "토큰이 없습니다")
    payload = decode_token(authorization.split(" ", 1)[1])
    if not payload:
        raise api_error(401, "UNAUTHORIZED", "토큰이 유효하지 않습니다")
    user = db.get(User, int(payload["sub"]))
    if not user:
        raise api_error(401, "UNAUTHORIZED", "사용자를 찾을 수 없습니다")
    return user


def require_role(*roles: str) -> Callable[..., User]:
    def _dep(user: User = Depends(get_current_user)) -> User:
        if roles and user.role not in roles:
            raise api_error(403, "FORBIDDEN", "권한이 없습니다")
        return user

    return _dep


def scope_university(user: User, university_id: int | None) -> None:
    """univ_admin은 같은 university_id 데이터만. operator는 전체."""
    if user.role == "operator":
        return
    if user.role == "univ_admin" and user.university_id == university_id:
        return
    raise api_error(403, "FORBIDDEN", "다른 대학의 데이터입니다")

