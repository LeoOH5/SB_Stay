# SB Stay (성북스테이)

방학 중 비어 있는 성북 대학 기숙사에 머물며, AI가 짜 준 일정으로 해설사 역사 투어와 대학생 버디 교류를 한 번에 예약하는 체류형 역사문화 관광 플랫폼.
2026 SB 스타트업 네트워킹 페스티벌 「AI 기반 지역문제 해결 해커톤」 출품작.

## 홍보 영상 (46초)

[![SB Stay 홍보 영상 미리보기 — 누르면 소리 있는 영상 재생](docs/media/sbstay-promo-preview.gif)](https://sbstay.site/promo/sbstay-promo.mp4)

▶ [소리와 함께 영상 보기](https://sbstay.site/promo/sbstay-promo.mp4) (1920×1080, 46.5초). 위 미리보기는 소리 없는 GIF예요.
영상 속 앱 화면은 실제 서비스 화면이고, 숫자는 한국관광공사 데이터랩(2026.10)·대학알리미(2025.4.1) 기준입니다.
사진: 삼군부 총무당 — 오모군, CC BY 4.0 · 고려대 프런티어관 — Mimacds, CC BY-SA 3.0 (위키미디어 공용). 효과음: HyperFrames 기본 사운드.

## 구조

```
frontend/   Next.js 16 (App Router, TypeScript, Tailwind v4) — 관광객·버디 모바일 웹 + 어드민 웹
backend/    FastAPI + SQLAlchemy 2 + Alembic + PostgreSQL 16
docs/       API 명세(api-spec.md, api-detail/*.md), ERD(erd.md), 백엔드 분담·규칙(backend-plan.md)
```

### 프론트 라우트
| 영역 | 경로 | 화면 |
|---|---|---|
| 관광객 (모바일) | `/home` `/plan` `/plan/result` `/stay` `/stay/[id]` `/tours` `/tours/[id]` `/buddies` `/buddies/[id]` `/cart` `/checkout` `/trips` `/me` `/login` `/signup` | T0~T11 |
| 버디 (모바일) | `/buddy` `/buddy/requests` `/buddy/schedule` `/buddy/activity` `/buddy/login` | B1~B5 |
| 어드민 (웹) | `/admin` `/admin/rooms` `/admin/bookings` `/admin/members` `/admin/tours` `/admin/settlements` | A1~A3 |

프론트는 `NEXT_PUBLIC_USE_MOCK=true`(기본)면 백엔드 없이 `src/lib/mock` 데이터로 전부 동작한다. 목 핸들러의 경로·응답 형식은 `docs/api-detail`과 같아서, 백엔드가 붙으면 env 하나만 바꾸면 된다.

## 실행

### DB
로컬 PostgreSQL 16이 있으면:
```bash
psql -h localhost -d postgres -c "CREATE ROLE sbstay WITH LOGIN PASSWORD 'sbstay' CREATEDB;"
psql -h localhost -d postgres -c "CREATE DATABASE sbstay OWNER sbstay;"
```
없으면 `docker compose up -d db` (같은 계정/DB).

### 백엔드
```bash
cd backend
cp .env.example .env            # 키 채우기
uv sync --extra dev
uv run alembic upgrade head     # 스키마
uv run python -m app.seeds      # 시드(데모 계정·대학). 기존 데이터 삭제 후 재적재
uv run uvicorn app.main:app --reload --port 8000   # http://localhost:8000/docs
```

### 프론트
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev                     # http://localhost:3000
```

## 데모 계정 (비밀번호 demo1234)
| 역할 | 이메일 |
|---|---|
| 관광객 | emma@example.com, yuki@example.com |
| 버디 | jiwoo@a-univ.ac.kr |
| 해설사 | guide.park@example.com |
| 대학 담당자 | admin@a-univ.ac.kr |
| 운영자 | operator@sbstay.app |

## 개발 규칙
`docs/backend-plan.md` 참고. 요약: 명세 먼저 고치고 코드, 브랜치는 `feat/<이니셜>-<기능>`, 커밋 앞에 엔드포인트 번호(`BK-04 …`), main은 항상 실행 가능, 키는 `.env`에만.
