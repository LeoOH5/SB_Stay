"""버디 등급 재산정 (매월 1일 1회): uv run python scripts/recompute_grades.py [YYYY-MM-DD]

등급·정산율 갱신 → 휴면 판정 (services/grades.recompute_all). 운영자 API POST /admin/buddies/recompute-grades 와 같다.
날짜를 안 주면 설정의 '오늘'(DEMO_TODAY 또는 실제 오늘). 이미 확정된 예약 항목의 정산율은 바뀌지 않는다.
"""
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.services import grades


def main(argv: list[str]) -> None:
    today = date.fromisoformat(argv[0]) if argv else get_settings().today()
    with SessionLocal() as db:
        changed = grades.recompute_all(db, today)
        db.commit()
        for b in changed:
            print(f"buddy {b.id}: {b.grade} {b.payout_rate}" + (f" 휴면({b.dormant_since})" if b.needs_recheck else ""))
    print(f"{today}: {len(changed)}명 바뀜")


if __name__ == "__main__":
    main(sys.argv[1:])
