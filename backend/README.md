# SB Stay 백엔드 (FastAPI + PostgreSQL)

## 실행
```bash
cp .env.example .env
uv sync --extra dev
uv run alembic upgrade head
uv run python -m app.seeds          # 데모 데이터 (기존 삭제 후 재적재)
uv run uvicorn app.main:app --reload --port 8000
```
Swagger: http://localhost:8000/docs · 헬스: `/health`

## 테스트
별도 DB `sbstay_test`를 쓴다 (`CREATE DATABASE sbstay_test OWNER sbstay;`). 스키마는 테스트 시작 때 다시 만든다.
```bash
uv run pytest -q
uv run ruff check app tests
```

## 구현 상태 (B 담당)
| 그룹 | 상태 |
|---|---|
| AU 인증 | 구글 로그인(code/id_token)·회원가입·데모 로그인·내 정보·언어·역할 선택·캘린더 연동/해제 |
| DM 숙박 | 대학·객실 조회(기간별 잔여 객실), 어드민 객실 등록·수정, 개방 기간 |
| BK 예약 | 통합 신청(가격·개방 기간·운영 요일·잔여 객실 검증), 공급자별 승인/거절, 취소, 결제·체크인 안내·리뷰·채팅(목업), 알림 |
| BD 버디 본인 | 프로필·가능 일정·요청함·확정 일정·활동 내역 (해설사는 투어 항목) |
| AD 어드민 | 대시보드 집계, 예약 목록, 버디 승인, 회원·정산·투어 조회, 숙박신고 CSV |
| A 담당 (미구현, 501) | `routers/tours.py` `buddies.py`(목록·상세) `ai.py` `contents.py` — `docs/api-detail` 명세와 `frontend/src/lib/mock` 형식대로 |

상태 전이는 `services/booking_state.py` 한 곳에서만 바꾼다. 권한은 `core/deps.py`의 `require_role`·`scope_university`.

## 구글 OAuth · 캘린더 설정
1. Google Cloud 콘솔 → OAuth 동의 화면: **테스트 모드**, 테스트 사용자에 데모 계정 이메일 추가 (캘린더 범위는 민감 범위라 테스트 사용자만 통과).
2. 사용자 인증 정보 → OAuth 클라이언트(웹) 생성. 승인된 리디렉션 URI에 `GOOGLE_REDIRECT_URI` 값(`http://localhost:3000/auth/callback`, 배포 주소)을 등록.
3. `.env`에 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`(아래 명령으로 생성) 입력.
   ```bash
   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   ```
4. 로그인: 프론트가 받은 authorization code 또는 id_token을 `POST /api/v1/auth/google`로 보낸다. 첫 로그인이면 `needs_role_setup=true` → `PATCH /api/v1/auth/me/role`.
5. 캘린더: 버디가 연동 버튼을 누르면 `scope=https://www.googleapis.com/auth/calendar.events&access_type=offline&prompt=consent`로 받은 code를 `POST /api/v1/auth/google/calendar`에 보낸다. 이후 동행이 확정되면 이벤트가 자동 생성되고, 취소되면 삭제된다. 실패해도 승인은 유지되고 로그만 남는다.
