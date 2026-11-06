#!/bin/sh
# 배포 서버 시작: DB 마이그레이션 → (DB가 비어 있으면) 데모 데이터 → API 서버
set -e
alembic upgrade head
if [ "${SEED_IF_EMPTY:-true}" = "true" ]; then
  python -m scripts.seed_if_empty
fi
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips '*'
