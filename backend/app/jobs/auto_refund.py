"""테스트 결제 자동 환불. 서버에서 주기 실행되고, 수동 실행도 가능: python -m app.jobs.auto_refund"""
import asyncio
import logging

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.services import payments as ps

log = logging.getLogger("auto_refund")


def run_once() -> list[int]:
    hours = get_settings().auto_refund_after_hours
    with SessionLocal() as db:
        ids = ps.auto_refund_due(db, hours)
    if ids:
        log.info("auto refund: %s", ids)
    return ids


async def loop() -> None:
    minutes = max(1, get_settings().auto_refund_check_minutes)
    while True:
        try:
            await asyncio.to_thread(run_once)
        except Exception:  # 주기 작업은 실패해도 서버를 멈추지 않는다
            log.exception("auto refund failed")
        await asyncio.sleep(minutes * 60)


if __name__ == "__main__":
    print("refunded:", run_once())
