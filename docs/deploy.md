# 배포

| 대상 | 플랫폼 | 주소 |
|---|---|---|
| 프론트 (Next.js) | Vercel 프로젝트 `sbstay` (root: `frontend`) | https://sbstay.site (www·sbstay.vercel.app 은 sbstay.site 로 308 이동) |
| 백엔드 (FastAPI) | Railway 프로젝트 `sbstay` · 서비스 `backend` (root: `backend`, `Dockerfile`) | https://api.sbstay.site (원래 주소 https://backend-production-c315.up.railway.app 도 동작) |
| DB | Railway PostgreSQL (같은 프로젝트) | 백엔드 `DATABASE_URL=${{Postgres.DATABASE_URL}}` |

## 자동 배포 (main에 머지하면 반영)
- 흐름: `feat/*` → PR → `develop`(pytest 필수) → `main` 머지
- 백엔드: Railway 서비스가 GitHub `LeoOH5/SB_Stay`의 `main`을 본다. `backend/**`가 바뀐 커밋만, **GitHub 체크(pytest)가 통과한 뒤** 배포 (Wait for CI)
- 프론트: Vercel 프로젝트가 같은 저장소의 `main`을 Production으로 배포, 다른 브랜치·PR은 Preview URL. `frontend/`가 안 바뀐 커밋은 빌드 생략 (`git diff --quiet HEAD^ HEAD -- .`)
- 손으로 배포해야 할 때: 프론트는 **저장소 루트에서** `vercel deploy --prod`(root가 `frontend`라서), 백엔드는 Railway에서 Redeploy

## 백엔드 (Railway)
- `backend/Dockerfile`로 빌드, 시작은 `scripts/start.sh`: `alembic upgrade head` → DB가 비어 있으면 데모 데이터(`scripts/seed_if_empty.py`) → uvicorn (`$PORT`)
- 헬스체크 `/health` (`backend/railway.json`), 설정(root `/backend`, Dockerfile, 헬스체크 `/health`, 감시 경로 `/backend/**`)은 Railway 서비스 설정에 있다
- 사진 업로드는 볼륨을 `/data`에 붙이고 `UPLOAD_DIR=/data/uploads`
- `DATABASE_URL`은 Railway가 주는 `postgresql://...` 그대로 넣으면 된다 (앱이 `postgresql+psycopg://`로 바꿈)
- 하루 뒤 테스트 결제 자동 환불은 서버가 켜져 있는 동안 돈다 (`AUTO_REFUND_AFTER_HOURS`)

### 시드 데이터를 바꾼 뒤 (배포 DB 다시 넣기)
배포 DB는 비어 있을 때만 시드를 넣으므로, `backend/app/seeds/data/*.json`을 바꿔도 그대로는 반영되지 않는다.
1. Railway 변수 `RESEED_ON_START=true`
2. 재배포 (`cd backend && railway up` 또는 Railway에서 Redeploy) → 로그에 `!!!!! RESEED_ON_START=true ...` 줄이 보이면 `python -m app.seeds`(모두 지우고 다시 넣기)가 돈 것
3. 앱에서 바뀐 데이터를 확인한 뒤 **변수 `RESEED_ON_START`를 삭제** (안 지우면 재시작마다 데모 데이터가 초기화되어 그동안 만든 예약·회원이 사라진다)

예: v3.9 코스 5 '정릉과 성곽길' 순서 변경([v3/course-order.md](v3/course-order.md))은 이렇게 한 번 다시 넣어야 배포 앱에 보인다.

환경변수: `backend/.env.example`의 키를 Railway 변수에 넣는다. 배포에서 꼭 바꿀 것:
- `APP_ENV=prod`, `JWT_SECRET`(긴 무작위 값), `CORS_ORIGINS=https://sbstay.vercel.app,http://localhost:3100`
- `GOOGLE_REDIRECT_URI=postmessage`, 구글 콘솔 "승인된 JavaScript 원본"에 `https://sbstay.vercel.app` 추가

## 프론트 (Vercel)
- `NEXT_PUBLIC_API_URL=https://<railway 주소>/api/v1`, `NEXT_PUBLIC_USE_MOCK=false`
- `NEXT_PUBLIC_KAKAO_MAP_KEY`(JavaScript 키, 카카오 플랫폼 Web에 `https://sbstay.vercel.app` 등록)
- 결제: `NEXT_PUBLIC_TOSS_CLIENT_KEY`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID` · 구글: `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- 배포: main 머지 시 자동 (위 "자동 배포" 참고)

## 도메인 (sbstay.site)
Spaceship에서 구매(1년, 자동 연장은 끔 권장). DNS는 Spaceship Advanced DNS:

| 종류 | Host | 값 |
|---|---|---|
| A | `@` | `76.76.21.21` (Vercel) |
| A | `www` | `76.76.21.21` (Vercel) |
| CNAME | `api` | Railway가 준 `*.up.railway.app` 주소 |
| TXT | `_railway-verify.api` | Railway가 준 `railway-verify=...` |

도메인을 바꿀 때 함께 바꿀 곳:
- Railway `CORS_ORIGINS`, Vercel `NEXT_PUBLIC_API_URL`
- 구글 OAuth 클라이언트 "승인된 JavaScript 원본", 브랜딩(홈페이지·개인정보처리방침·약관·승인된 도메인)
- 카카오 디벨로퍼스 > 플랫폼 > Web 사이트 도메인
