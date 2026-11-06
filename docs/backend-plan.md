# 백엔드 역할 분담 · 개발 규칙 (2인)

기준일 2026-11-05 · 프론트는 Excalidraw 와이어프레임에서 바로 만들고, 백엔드만 둘이 나눈다.

## 1. 역할 분담

| | A: AI·콘텐츠 | B: 예약·권한·인프라 |
|---|---|---|
| 엔드포인트 | AI-01~05, TR-01~04, BD-01~02, HM-01, CM-01 + 목업 엔드포인트 일괄(조회 API 끝낸 뒤) | AU-01~08, DM-01~06, BK-01~10, BD-03~07, AD-01~10 |
| 데이터(시드) | 장소 15~20곳, 역사 이야기 문서(RAG), 투어 3~5개, 버디 6~10명, 패키지 2~3개 | 대학·객실, 데모 계정 6개(구글 콘솔 테스트 사용자로 등록), 샘플 예약 20~30건 |
| 인프라 | 임베딩 적재, LLM 클라이언트, 프롬프트·JSON 스키마, 폴백 | DB 스키마·마이그레이션, 구글 OAuth·캘린더 푸시(services/google_calendar.py), JWT 인증, 권한 의존성, 배포 |
| 데모 담당 | 1~2단계 (AI 추천, 역사 질문) | 3~6단계 (예약 신청 → 대학 승인 → 버디 수락 → 확정) |

유일한 접점: AI-01 응답의 일정 항목 `{ type, ref_id, date, time, price }` 를 BK-01 요청 `items[]`가 그대로 받는다. 첫날 밤에 이 형식을 먼저 고정한다.

## 2. 자료에 있던 규칙 (그대로 적용)

- 화면·API 형식 먼저, 코드는 그다음. 명세 기준은 노션 "API 명세서 v1"과 `docs/api-detail/`. 바꿀 땐 명세부터 고친다.
- 브랜치는 기능 단위, 하루 두 번 이상 main에 병합. 막히면 30분 안에 단톡 공유.
- API 키는 전부 환경변수, 깃허브 업로드 금지. 키 만드는 사람은 한 명.
- 운영시간·가격·좌표 같은 사실은 LLM이 만들지 않고 DB 값을 쓴다. AI 응답은 JSON. 역사 답변은 RAG 문서 밖이면 "자료에 없다"(`grounded=false`).
- 대학 담당자는 같은 `university_id` 데이터만, 운영자는 전체.
- 공공데이터는 실시간 호출 없이 미리 DB에 적재.
- 승인 구조: 숙박만 승인제, 투어는 즉시 확정, 버디는 별도 수락.
- 개발 과정의 AI 활용(코드 생성 등)은 발표에서 보조로만 언급.

## 3. 추가 규칙 (추천)

### 스택
- FastAPI + PostgreSQL + SQLAlchemy. 권한 체크는 FastAPI 의존성 `require_role(...)`에서 (DB RLS 아님). Supabase는 시간이 남을 때만.
- 임베딩은 메모리 또는 pgvector. 장소 20곳 이내라 별도 벡터DB 없음.

### 레포 구조
```
backend/
  app/
    main.py
    core/        # settings(.env), security(JWT), deps(require_role)
    models/      # SQLAlchemy
    schemas/     # Pydantic (요청·응답 = api-detail과 동일)
    routers/     # auth, dorms, tours, buddies, ai, bookings, admin, contents
    services/    # llm.py, rag.py, booking_state.py, google_calendar.py (이벤트 생성·삭제, 단방향)
    seeds/       # *.json + __main__.py (python -m app.seeds)
  tests/         # 상태 전이·권한만 최소
  .env.example
```
라우터는 노션 그룹 단위 파일로 나눠 둘이 다른 파일만 만진다.

### 브랜치 · 커밋
- 브랜치: `feat/A-ai-plan`, `feat/B-bookings` (담당 이니셜 + 기능).
- 커밋 메시지 앞에 엔드포인트 번호: `BK-04 공급자 승인·거절 API`.
- main은 항상 실행 가능. 깨진 상태로 병합 금지. 병합 전 `uvicorn` 기동 + 데모 계정 로그인 확인.

### 응답 규약
- 실패: `{ "error": { "code": "...", "message": "..." } }` 하나로 통일. 코드는 UNAUTHORIZED 401 / FORBIDDEN 403 / NOT_FOUND 404 / VALIDATION 422 / CONFLICT 409.
- 목록: `{ "items": [...], "next_cursor": null }`.
- 날짜 ISO 8601(`2027-01-12`), 시간 `HH:MM`, 금액은 원 단위 정수.
- 다국어: `Accept-Language: ko|en`, 응답에 `name`/`name_en` 둘 다 포함.

### 상태 전이 (B 소유)
- `booking_items.status`: requested → approved | rejected → confirmed → cancelled. 투어 항목은 생성 즉시 confirmed.
- `bookings.status`: requested → partially_approved → confirmed | cancelled. 모든 항목이 approved/confirmed면 confirmed.
- 전이는 `services/booking_state.py` 한 곳에서만 바꾼다. buddy/guide 항목이 `confirmed`가 될 때와 `cancelled`가 될 때 여기서 `google_calendar.py`를 호출한다(아래).

### 구글 OAuth · 캘린더 푸시 (B)
- 로그인은 구글 OAuth(Authorization Code) → 우리 JWT(AU-01). 범위는 `openid email profile`만. 이메일 로그인(AU-05)은 데모 계정 전용 폴백으로 남긴다.
- 캘린더 범위(`calendar.events`)는 버디가 B3에서 연동 버튼을 누를 때 증분 인증(AU-07)으로 받고, refresh token은 `TOKEN_ENCRYPTION_KEY`로 암호화해 `users.google_refresh_token`에 저장.
- 단방향 푸시: 확정 시 이벤트 생성 → `booking_items.google_event_id`, 취소 시 삭제. `FastAPI BackgroundTasks`로 돌리고 실패는 로그만(승인·취소 응답은 항상 성공).
- 구글 콘솔은 테스트 모드. 데모 계정 구글 주소를 테스트 사용자로 등록하고, refresh token 7일 만료 대비 데모 직전 재연동.

### 목업 엔드포인트 (A, 일괄 — 조회 API 끝낸 뒤)
- 결제·채팅·체크인 안내·리뷰·알림·정산·회원 목록은 고정 JSON 반환. 경로·형식은 명세와 동일하게 해 프론트가 구분하지 못하게 한다.
- B가 구글 OAuth·캘린더 푸시를 맡는 대신, A가 조회 API(TR/BD/HM)를 끝낸 뒤 가져간다.

### 시드 데이터
- `seeds/*.json` → `python -m app.seeds`로 초기화(기존 데이터 삭제 후 재적재).
- 데모 날짜는 2027년 1월(겨울방학) 고정. 가격은 전부 가정값.
- 데모 계정: 관광객 Emma(EN)·Yuki, 버디 지우, 해설사 1, 대학 담당자 고려대학교, 운영자.

### AI 안전장치 (A)
- LLM 호출은 `services/llm.py` 하나를 통해서. 타임아웃 20초, 재시도 1회.
- 실패 시 규칙 기반 폴백: DB에서 날짜·가격·운영일로 거른 후보 상위 3개를 그대로 반환(추천 이유는 고정 문구). 데모 중 API 장애에도 화면이 멈추지 않게.
- 프롬프트 입력에는 후보 목록(id·이름·가격·날짜)만 넣고, 출력은 id 선택·순서·설명만 받는다. 응답은 Pydantic으로 검증해 없는 id는 버린다.

### 환경변수
- `.env.example`에 키 이름만 커밋: `DATABASE_URL, JWT_SECRET, LLM_API_KEY, LLM_MODEL, KAKAO_MAP_KEY, CORS_ORIGINS, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, TOKEN_ENCRYPTION_KEY`.
- 배포(Render/Railway)에도 같은 이름으로 등록.

## 4. 일정

| 시점 | A | B |
|---|---|---|
| 11/5(목) 밤 | AI-01 입출력 형식 확정, 장소·이야기 데이터 수집 시작 | 스키마·시드·구글 로그인(AU-01/05/06)·권한 의존성, AI-01↔BK-01 형식 확정 |
| 11/6(금) 오전 | 조회 API(TR/BD/HM) + 시드 | DM, BK-01~05, AD-01~04 |
| 11/6(금) 오후 | AI-01~03 + 폴백, 목업 엔드포인트 일괄 | 캘린더 연동·푸시(AU-07/08, BK-04/05), 배포 |
| 11/6(금) 저녁 | **둘이 함께** 데모 6단계 통합 점검 | |
| 11/7(토) 오전 | 버그 수정 · 배포 URL 확인 · 백업 영상 | |
