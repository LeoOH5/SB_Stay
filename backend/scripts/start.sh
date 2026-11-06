#!/bin/sh
# 배포 서버 시작: DB 마이그레이션 → (DB가 비어 있으면) 데모 데이터 → API 서버
# RESEED_ON_START=true 면 데모 데이터를 모두 지우고 다시 넣는다 (시드 데이터를 바꾼 뒤 한 번만. 확인 후 변수를 지울 것)
set -e
alembic upgrade head
if [ "${RESEED_ON_START:-false}" = "true" ]; then
  echo "!!!!! RESEED_ON_START=true: 모든 데이터를 지우고 데모 데이터를 다시 넣습니다 (python -m app.seeds). 끝나면 Railway 변수 RESEED_ON_START를 지우세요 !!!!!"
  python -m app.seeds
  echo "!!!!! RESEED_ON_START: 다시 넣기 끝 !!!!!"
elif [ "${SEED_IF_EMPTY:-true}" = "true" ]; then
  python -m scripts.seed_if_empty
fi
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips '*'
