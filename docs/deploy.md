# 배포

| 대상 | 플랫폼 | 주소 |
|---|---|---|
| 프론트 (Next.js) | Vercel 프로젝트 `sbstay` (root: `frontend`) | https://sbstay.vercel.app |
| 백엔드 (FastAPI) | Railway 서비스 (root: `backend`, `Dockerfile`) | Railway가 준 `*.up.railway.app` |
| DB | Railway PostgreSQL | 백엔드 `DATABASE_URL`에 연결 |

## 백엔드 (Railway)
- `backend/Dockerfile`로 빌드, 시작은 `scripts/start.sh`: `alembic upgrade head` → DB가 비어 있으면 데모 데이터(`scripts/seed_if_empty.py`) → uvicorn (`$PORT`)
- 헬스체크 `/health` (`backend/railway.json`)
- 사진 업로드는 볼륨을 `/data`에 붙이고 `UPLOAD_DIR=/data/uploads`
- `DATABASE_URL`은 Railway가 주는 `postgresql://...` 그대로 넣으면 된다 (앱이 `postgresql+psycopg://`로 바꿈)
- 하루 뒤 테스트 결제 자동 환불은 서버가 켜져 있는 동안 돈다 (`AUTO_REFUND_AFTER_HOURS`)

환경변수: `backend/.env.example`의 키를 Railway 변수에 넣는다. 배포에서 꼭 바꿀 것:
- `APP_ENV=prod`, `JWT_SECRET`(긴 무작위 값), `CORS_ORIGINS=https://sbstay.vercel.app,http://localhost:3100`
- `GOOGLE_REDIRECT_URI=postmessage`, 구글 콘솔 "승인된 JavaScript 원본"에 `https://sbstay.vercel.app` 추가

## 프론트 (Vercel)
- `NEXT_PUBLIC_API_URL=https://<railway 주소>/api/v1`, `NEXT_PUBLIC_USE_MOCK=false`
- `NEXT_PUBLIC_KAKAO_MAP_KEY`(JavaScript 키, 카카오 플랫폼 Web에 `https://sbstay.vercel.app` 등록)
- 결제: `NEXT_PUBLIC_TOSS_CLIENT_KEY`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID` · 구글: `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- 배포: `cd frontend && vercel deploy --prod`
