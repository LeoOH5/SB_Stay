"""refresh token 등 민감값 암호화 (Fernet). TOKEN_ENCRYPTION_KEY 미설정이면 평문 저장을 막기 위해 예외."""
from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings


def _fernet() -> Fernet:
    key = get_settings().token_encryption_key
    if not key:
        raise RuntimeError("TOKEN_ENCRYPTION_KEY가 설정되지 않았습니다")
    return Fernet(key.encode())


def encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt(value: str) -> str:
    try:
        return _fernet().decrypt(value.encode()).decode()
    except InvalidToken as e:
        raise RuntimeError("암호화 키가 바뀌었거나 값이 손상되었습니다") from e
