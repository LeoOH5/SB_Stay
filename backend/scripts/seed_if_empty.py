"""사용자 표가 비어 있을 때만 데모 데이터를 넣는다 (배포 첫 기동용). 이미 데이터가 있으면 아무것도 하지 않는다."""
from sqlalchemy import func, select

from app.core.db import SessionLocal
from app.models import User
from app.seeds.__main__ import main as seed_main


def run() -> None:
    with SessionLocal() as db:
        count = db.scalar(select(func.count()).select_from(User)) or 0
    if count:
        print(f"seed skip: users={count}")
        return
    seed_main()


if __name__ == "__main__":
    run()
