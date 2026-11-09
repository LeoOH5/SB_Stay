"""시드 데모 계정 (심사용). 역할을 바꾸거나 버디 지원을 하면 데모 시나리오가 깨지므로 막는다"""
import json
from pathlib import Path

DEMO_EMAILS = frozenset(u["email"] for u in json.loads((Path(__file__).resolve().parents[1] / "seeds" / "data" / "users.json").read_text()))
DEMO_BUDDY_BLOCKED = "데모 계정으로는 버디 신청을 할 수 없어요. 로그아웃한 뒤 새 계정으로 신청해 주세요"


def is_demo_email(email: str | None) -> bool:
    return bool(email) and email.lower() in DEMO_EMAILS
