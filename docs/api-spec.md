# 성북스테이(가칭) API 명세서 v1

> **v3 변경(해설사 삭제·버디만)이 이 문서보다 우선합니다.** 맨 아래 [v3 변경](#v3-변경) 표와 `docs/v3/CONTRACT.md`를 보세요.

- 기준일: 2026-11-05 · 해커톤 MVP 기준 (구글 문서 9장 "주요 API" + 와이어프레임 T0~T6 / B1 / A1~A2)
- Base URL: `/api/v1` · JSON · 인증: `Authorization: Bearer <JWT>` (로그인 응답의 `access_token`)
- 인증 흐름: 구글 OAuth(Authorization Code) → 백엔드 JWT. 캘린더 범위는 버디가 연동 버튼을 누를 때 증분 요청. 구글 콘솔은 테스트 모드, 데모 계정을 테스트 사용자로 등록. 이메일 로그인(AU-05)은 데모 계정 전용 폴백.
- 공통 에러: `{ "error": { "code": "NOT_FOUND", "message": "..." } }` · 코드: `UNAUTHORIZED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `VALIDATION` 422, `CONFLICT` 409
- 권한: `tourist` 본인 예약만 · `buddy`/`guide` 본인 요청·일정만 · `univ_admin` 같은 `university_id`만 · `operator` 전체
- 원칙: 운영시간·가격·좌표 같은 사실은 LLM이 만들지 않고 DB 값을 쓴다. AI 응답은 모두 JSON. 역사 답변은 RAG 문서 밖이면 `"자료에 없다"`.
- 상태값: `booking_items.status` = `requested` → `approved` | `rejected` → `confirmed` → `cancelled` / `bookings.status` = `requested` → `partially_approved` → `confirmed` | `cancelled`

## 1. 인증 (Auth)

| # | Method | Path | 역할 | 설명 | 화면 | 우선순위 | 처리 |
|---|---|---|---|---|---|---|---|
| AU-01 | POST | /auth/google | 전체 | 구글 로그인. 프론트가 받은 authorization code(또는 id_token) → 프로필 조회 → users upsert(google_sub, email, name, avatar) → 우리 JWT 발급. 응답에 `needs_role_setup`(처음 로그인이면 true) | T0 | 필수 | 구현 |
| AU-02 | POST | /auth/signup | tourist | 이메일 회원가입 (언어 포함) | T0 | 필수 | 구현(단순화) |
| AU-03 | GET | /auth/me | 전체 | 현재 사용자 정보 | 공통 | 필수 | 구현 |
| AU-04 | PATCH | /users/me | 전체 | 언어(한/영)·통화 설정, 프로필 수정. 언어 설정은 MVP 필수 | 마이페이지 | 필수 | 구현(언어만) |
| AU-05 | POST | /auth/login | 전체 | 이메일 로그인 — **데모 계정 전용** 폴백. 역할·소속 학교 반환 | T0 | 필수 | 구현 |
| AU-06 | PATCH | /users/me/role | 전체 | 첫 로그인 후 역할 선택 (`tourist` \| `buddy` \| `guide`, buddy/guide는 `university_id` 필수). univ_admin·operator는 시드 계정만 | T0(역할 선택) | 필수 | 구현 |
| AU-07 | POST | /auth/google/calendar | buddy, guide | 증분 인증으로 `calendar.events` 범위 동의 코드를 받아 refresh token 저장(암호화), `calendar_connected=true` | B3 | 권장 | 구현 |
| AU-08 | DELETE | /auth/google/calendar | buddy, guide | 캘린더 연동 해제 (토큰 폐기, `calendar_connected=false`) | B3 | 권장 | 구현 |
| AU-09 | GET | /auth/me/plan | 전체 | v3.4 내 이용 방식 `free`/`buddy` + 오늘 남은 AI 질문 (무료 하루 3번) | T08 | 필수 | 구현 |

AU-01 Request (`code` 또는 `id_token` 중 하나)
```json
{ "code": "4/0AX4XfWh...", "redirect_uri": "https://sbstay.app/auth/callback" }
```
Response 200
```json
{ "access_token": "jwt", "needs_role_setup": true, "user": { "id": 1, "email": "emma@gmail.com", "name": "Emma Clark", "avatar_url": "https://lh3.googleusercontent.com/a/...", "role": "tourist", "university_id": null, "language": "en", "calendar_connected": false } }
```
`role`: `tourist` | `buddy` | `guide` | `univ_admin` | `operator` · upsert: `google_sub` 일치 → 갱신, 없으면 `email` 일치(시드 데모 계정) → 연결, 둘 다 없으면 `role=tourist`로 생성 + `needs_role_setup=true`.

AU-06 Request → Response 200 (AU-03과 같은 user 객체)
```json
{ "role": "buddy", "university_id": 1 }
```

AU-07 Request → Response 200
```json
{ "code": "4/0AX4XfWh...", "redirect_uri": "https://sbstay.app/auth/calendar/callback" }
```
```json
{ "calendar_connected": true, "google_email": "jiwoo@gmail.com", "scopes": ["https://www.googleapis.com/auth/calendar.events"] }
```

## 1-1. 홈 · 공통 (Home / Common)

| # | Method | Path | 역할 | 설명 | 화면 | 우선순위 | 처리 |
|---|---|---|---|---|---|---|---|
| HM-01 | GET | /packages | 전체 | 홈의 추천 패키지(숙박+투어+버디 묶음) 목록. 시드 데이터 | T1 | 필수 | 구현 |
| CM-01 | GET | /contents/{key} | 전체 | terms, refund, support(긴급연락처), intro(성북 소개) 정적 콘텐츠. 언어별 | 마이페이지, T1 | 권장 | 목업 |

## 2. 숙박 (Dorms)

| # | Method | Path | 역할 | 설명 | 화면 | 우선순위 | 처리 |
|---|---|---|---|---|---|---|---|
| DM-01 | GET | /universities | 전체 | 대학 목록 (학교명, 위치, 개방 기간) | T4b | 필수 | 구현 |
| DM-02 | GET | /dorms | 전체 | 객실 목록. `?university_id&check_in&check_out&guests` | T4b | 필수 | 구현 |
| DM-03 | GET | /dorms/{id} | 전체 | 객실 상세 (사진, 가격, 기간, 이용 규칙, 남은 객실) | T4b | 필수 | 구현 |
| DM-04 | POST | /admin/dorms | univ_admin, operator | 객실 등록 | A2 | 필수 | 구현 |
| DM-05 | PATCH | /admin/dorms/{id} | univ_admin, operator | 객실 수정 (가격, 객실 수, 개방 기간, 활성 여부) | A2 | 필수 | 구현 |
| DM-06 | PATCH | /admin/universities/{id} | univ_admin, operator | 개방 기간 수정 | A2 | 필수 | 구현 |

DM-02 Response 200
```json
{ "items": [ { "id": 10, "university": { "id": 1, "name": "고려대학교", "name_en": "Korea University" }, "building": "프런티어관", "room_type": "double", "price_per_night": 35000, "open_from": "2027-01-05", "open_to": "2027-02-20", "available_rooms": 12, "photos": ["..."], "rules": ["체크인 15:00 / 체크아웃 11:00", "취사 금지"] } ] }
```

## 3. 투어 (Tours)

| # | Method | Path | 역할 | 설명 | 화면 | 우선순위 | 처리 |
|---|---|---|---|---|---|---|---|
| TR-01 | GET | /tours | 전체 | 코스 목록. `?theme&date&language` | 투어 목록 | 필수 | 구현 |
| TR-02 | GET | /tours/{id} | 전체 | 코스 상세 (장소 순서·좌표, 해설사, 소요시간, 가격, 운영 요일) | T4 | 필수 | 구현 |
| TR-03 | GET | /places/{id} | 전체 | 장소 상세 (이름 한·영, 좌표, 운영시간, 휴관일, 요금, 태그) | T4 | 필수 | 구현 |
| TR-04 | GET | /tours/{id}/reviews | 전체 | 리뷰 (샘플) | T4 | 권장 | 목업 |
| TR-05 | POST | /tours/{id}/survey | tourist | v3.4 무료 코스 완료 설문 (만족도·불편했던 점·버디 의향) | T08c | 권장 | 구현 |

TR-02 Response 200
```json
{ "id": 3, "title": "문인의 성북동 산책", "title_en": "Writers' Seongbuk Walk", "theme": "literature", "guide": { "id": 21, "name": "박○○", "license": "관광통역안내사", "languages": ["ko", "en"] }, "duration_min": 120, "price": 20000, "operating_days": ["sat", "sun"], "languages": ["en", "ko"], "meeting_point": "한성대입구역 5번 출구", "places": [ { "order": 1, "id": 101, "name": "최순우 옛집", "name_en": "Choi Sunu House", "lat": 37.59, "lng": 127.01, "stay_min": 20 } ] }
```

## 4. 버디 (Buddies)

| # | Method | Path | 역할 | 설명 | 화면 | 우선순위 | 처리 |
|---|---|---|---|---|---|---|---|
| BD-01 | GET | /buddies | 전체 | 버디 목록. `?language&date&interest&major` (승인된 버디만) | T4c | 필수 | 구현 |
| BD-02 | GET | /buddies/{id} | 전체 | 버디 상세 (소개, 관심사, 가능 날짜, 리뷰 샘플) | T4c | 필수 | 구현 |
| BD-03 | PUT | /buddy/profile | buddy, guide | 내 프로필 등록·수정 (학교 이메일 인증은 목업) | B1 | 필수 | 구현 |
| BD-04 | PUT | /buddy/availability | buddy, guide | 가능 날짜 목록 교체 | B1 | 필수 | 구현 |
| BD-05 | GET | /buddy/requests | buddy, guide | 내게 온 동행/투어 요청 (`?status=requested`) | B1 | 필수 | 구현 |
| BD-06 | GET | /buddy/schedule | buddy, guide | 확정 일정 (오늘·이번 주) | B1 | 필수 | 구현 |
| BD-07 | GET | /buddy/earnings | buddy, guide | 활동 내역·정산 | 활동 내역 | 권장 | 목업 |

BD-01 Response 200
```json
{ "items": [ { "id": 31, "name": "지우", "university": "고려대학교", "major": "국어국문", "year": 3, "languages": ["ko", "en", "ja"], "interests": ["literature", "walking"], "intro": "...", "avatar": "illust_01.png", "available_dates": ["2027-01-13", "2027-01-14"], "rating": 4.9, "review_count": 12 } ] }
```

## 5. AI

| # | Method | Path | 역할 | 설명 | 화면 | 우선순위 | 처리 |
|---|---|---|---|---|---|---|---|
| AI-01 | POST | /ai/plan | tourist | AI 여행 설계. 조건 → 날짜별 일정 JSON (숙박+투어+버디) + 추천 이유 | T2→T3 | 필수 | 구현 |
| AI-02 | POST | /ai/story | 전체 | 장소 역사 이야기 / 자유 질문 (RAG, 출처 포함) | T4 | 필수 | 구현 |
| AI-03 | POST | /ai/buddy-match | tourist | 조건에 맞는 버디 3명 + 이유 | T4c | 필수 | 구현 |
| AI-04 | POST | /ai/buddy-brief | buddy | 동행 준비 자료 (예약된 코스 장소 요약) | B1 | 선택 | 선택 |
| AI-05 | POST | /ai/translate-notice | operator | 체크인 안내·이용 규칙 다국어 초안 | 어드민 | 선택 | 제외 |

AI-01 Request
```json
{ "check_in": "2027-01-12", "check_out": "2027-01-15", "budget": 200000, "interests": ["literature", "independence"], "with_buddy": true, "language": "en", "note": "I love Korean poetry" }
```
Response 200 (후보는 DB에서 날짜·가격·운영일로 먼저 거르고 LLM은 선택·순서·설명만)
```json
{ "plan_id": "pl_8f2", "reason": "문학·독립운동 관심에 맞춰 한용운·이태준이 살던 성북동 코스를 넣었어요. 숙소에서 걸어서 20분.", "total_price": 155000, "days": [ { "date": "2027-01-12", "items": [ { "time": "15:00", "type": "dorm", "ref_id": 10, "title": "고려대학교 프런티어관 체크인", "price": 105000 } ] }, { "date": "2027-01-13", "items": [ { "time": "10:00", "type": "tour", "ref_id": 3, "title": "문인의 성북동 산책", "price": 20000 }, { "time": "14:00", "type": "buddy", "ref_id": 31, "title": "버디와 캠퍼스·동네 걷기", "price": 30000 } ] }, { "date": "2027-01-14", "items": [ { "time": null, "type": "free", "ref_id": null, "title": "정릉 · 선잠박물관 추천", "price": 0 } ] } ] }
```

AI-02 Request
```json
{ "place_id": 103, "question": "Why does this house face north?", "language": "en" }
```
Response 200
```json
{ "answer": "He refused to face the Japanese Government-General building to the south…", "sources": [ { "title": "성북구 문화관광 자료", "url": "..." } ], "grounded": true }
```
`question` 생략 시 장소 소개 이야기 반환. `grounded=false`면 프론트는 "자료에 없다" 안내.

AI-03 Request / Response
```json
{ "language": "en", "date": "2027-01-13", "interests": ["literature"] }
```
```json
{ "reason": "문학 관심·영어 가능한 순으로 골랐어요", "matches": [ { "buddy_id": 31, "score": 0.92, "reason": "시 전공, 영어 토론 동아리" } ] }
```

## 6. 예약 (Bookings)

| # | Method | Path | 역할 | 설명 | 화면 | 우선순위 | 처리 |
|---|---|---|---|---|---|---|---|
| BK-01 | POST | /bookings | tourist | 통합 예약 신청 (숙박·투어·버디 항목 묶음 + 여행자 정보). 투어는 즉시 `confirmed` | T5 | 필수 | 구현 |
| BK-02 | GET | /bookings/me | tourist | 내 예약 목록 (예정·지난) + 항목별 상태 | T6 | 필수 | 구현 |
| BK-03 | GET | /bookings/{id} | tourist(본인), 공급자(해당 항목), admin | 예약 상세 | T6, A1 | 필수 | 구현 |
| BK-04 | PATCH | /bookings/{id}/items/{itemId} | univ_admin(dorm), buddy(buddy), guide(tour), operator | 공급자 승인·거절 `{ "action": "approve" \| "reject", "reason"?: "" }` | A1, B1 | 필수 | 구현 |
| BK-05 | POST | /bookings/{id}/cancel | tourist, operator | 예약 취소 + 환불 규정(7일 전 100% · 3일 전 50% · 이후 0%)대로 토스 결제 환불 | T6, A1 | 필수 | 구현 |
| BK-06 | POST | /bookings/{id}/pay | tourist | 결제 (목업: 즉시 `paid`). 토스 키가 있으면 409 `USE_PAYMENT_WIDGET` → PM-01·02 사용 | T5 | 필수 | 구현 |
| BK-07 | GET | /bookings/{id}/checkin-guide | tourist | 체크인 안내 (기숙사 위치, 입실 절차, 비상연락처) | T6 | 필수 | 목업 |
| BK-08 | POST | /bookings/{id}/reviews | tourist | 숙박·버디·투어 리뷰 작성 | T6 | 권장 | 목업 |
| BK-09 | GET | /bookings/{id}/chat | tourist, buddy | 버디 채팅 메시지 (자동 번역 포함 예정) | T6, B1 | 필수 | 목업 |
| PM-01 | POST | /payments/prepare | tourist | 결제 주문 생성 `{ booking_id }` → orderId·금액(서버 예약 금액)·주문명·customerKey | T5 | 필수 | 구현 |
| PM-02 | POST | /payments/confirm | tourist | 결제창 성공 후 승인 `{ payment_key, order_id, amount }`. 금액 불일치면 승인 요청 안 함 | T5 | 필수 | 구현 |
| PM-03 | GET | /payments/bookings/{id} | tourist | 예약의 결제 상태·수단·영수증 URL·환불액 | T6 | 권장 | 구현 |
| PM-04 | POST | /payments/paypal/orders | tourist | PayPal 주문 생성 `{ booking_id }`. 예약 원화 금액을 고정 환율로 USD 환산 (외국인·해외카드) | T5 | 필수 | 구현 |
| PM-05 | POST | /payments/paypal/capture | tourist | 구매자 승인 후 캡처 `{ paypal_order_id }`. 캡처 금액·통화가 주문과 같아야 완료 | T5 | 필수 | 구현 |
| PM-06 | GET | /payments/methods | 공개 | 서버에 켜진 결제수단 `{ toss, paypal, usd_krw_rate }` | T5 | 권장 | 구현 |
| BK-10 | GET | /notifications | tourist, buddy | 승인·확정·취소 알림 목록. 발송은 MVP 제외, 상태값만 | T6 | 권장 | 목업 |

BK-01 Request
```json
{ "traveler": { "name": "Emma Clark", "nationality": "US", "email": "emma@example.com", "passport_no": "optional", "emergency_contact": "+1..." }, "items": [ { "type": "dorm", "ref_id": 10, "date_from": "2027-01-12", "date_to": "2027-01-15", "guests": 1 }, { "type": "tour", "ref_id": 3, "date": "2027-01-13", "time": "10:00" }, { "type": "buddy", "ref_id": 31, "date": "2027-01-13", "time": "14:00", "duration_min": 120 } ] }
```
Response 201
```json
{ "id": 501, "code": "SB-2027-0112", "status": "requested", "total_price": 155000, "platform_fee": 15500, "items": [ { "id": 1, "type": "dorm", "status": "requested", "price": 105000 }, { "id": 2, "type": "tour", "status": "confirmed", "price": 20000 }, { "id": 3, "type": "buddy", "status": "requested", "price": 30000 } ] }
```
규칙: 모든 항목이 `approved`/`confirmed`면 booking `confirmed`. 한 항목이라도 `rejected`면 해당 항목만 제외하고 관광객에게 알림(알림 발송은 MVP 제외, 상태값만).

구글 캘린더 푸시(단방향): BK-04에서 buddy/guide 항목이 `confirmed`로 바뀌고 공급자가 `calendar_connected`면 `services/google_calendar.py`가 이벤트를 만들고 `booking_items.google_event_id`를 저장한다. 실패해도 승인은 성공(비동기·로그만). BK-05 취소 시 `google_event_id`가 있으면 이벤트 삭제.

## 7. 어드민 (Admin)

| # | Method | Path | 역할 | 설명 | 화면 | 우선순위 | 처리 |
|---|---|---|---|---|---|---|---|
| AD-01 | GET | /admin/dashboard | univ_admin, operator | 예약 수·승인 대기·숙박 매출·플랫폼 수수료·상태별 건수 (`?from&to`) | A1 | 필수 | 구현 |
| AD-02 | GET | /admin/bookings | univ_admin, operator | 예약 목록 (`?status&type&university_id`) | A1 | 필수 | 구현 |
| AD-03 | GET | /admin/buddies | univ_admin, operator | 소속 버디 목록 (`?status=pending`) | A2 | 필수 | 구현 |
| AD-04 | PATCH | /admin/buddies/{id} | univ_admin, operator | 버디 승인·제재 `{ "action": "approve" \| "suspend" }` | A2 | 필수 | 부분 구현 |
| AD-05 | GET | /admin/users | operator | 회원 목록 (관광객·버디·해설사) | 회원 관리 | 권장 | 목업 |
| AD-06 | GET | /admin/settlements | operator | 대학·버디·해설사별 정산 내역 | 정산 | 권장 | 목업 |
| AD-07 | GET | /admin/tours | operator | 투어 코스 관리 (시드 데이터 조회) | 투어 관리 | 권장 | 시드 대체 |
| AD-08 | GET | /admin/export/foreign-guests | operator | 외국인 숙박신고 양식 내보내기 (CSV) | A-06 | 권장 | 제외 |
| AD-09 | PUT | /admin/contents/{key} | operator | 투어 소개글·이용 안내 다국어 버전 관리. 시드 데이터로 대체 | 콘텐츠 관리 | 권장 | 제외 |
| AD-10 | PATCH | /admin/settings | operator | 수수료율 등 설정값. 해커톤은 상수로 대체 | 설정 | 선택 | 제외 |

AD-01 Response 200
```json
{ "period": { "from": "2027-01-05", "to": "2027-02-20" }, "bookings": 24, "pending": 3, "nights": 72, "dorm_revenue": 2520000, "platform_fee": 252000, "fee_rate": 0.1, "by_status": { "requested": 3, "approved": 8, "confirmed": 11, "cancelled": 2 }, "daily": [ { "date": "2027-01-12", "bookings": 2, "revenue": 140000 } ] }
```

## 8. 데이터베이스 (참고)

| 테이블 | 주요 컬럼 |
|---|---|
| users | id, email, password_hash(null 허용·데모 계정만), name, role, university_id, language, google_sub(unique·null), avatar_url, google_refresh_token(암호화·null), calendar_connected(default false), created_at |
| universities | id, name, name_en, address, lat, lng, open_from, open_to |
| dorm_rooms | id, university_id, building, room_type, price_per_night, total_rooms, open_from, open_to, rules(json), photos(json), active |
| guides | id, user_id, license, languages(json), intro |
| tours | id, guide_id, title, title_en, theme, duration_min, price, operating_days(json), languages(json), meeting_point, description |
| tour_places | tour_id, place_id, order, stay_min |
| places | id, name, name_en, lat, lng, address, hours, closed_days, fee, need_reservation, stay_min, tags(json), story_doc(text), sources(json) |
| buddy_profiles | id, user_id, university_id, major, year, languages(json), interests(json), intro, avatar, status(pending/approved/suspended), hourly_fee |
| buddy_availability | buddy_id, date |
| bookings | id, code, tourist_id, status, total_price, platform_fee, traveler(json), paid_at, created_at |
| booking_items | id, booking_id, type(dorm/tour/buddy), ref_id, date_from, date_to, time, price, status, decided_by, decided_at, reject_reason, google_event_id(null) |
| reviews | id, booking_item_id, rating, text |
| messages | id, booking_item_id, sender_id, text, translated_text |

## 9. 기능 명세(F/P/A) 대응표

| 기능 | 엔드포인트 |
|---|---|
| F-01 회원가입/로그인 | AU-01, AU-02, AU-03, AU-05, AU-06 |
| F-02 언어 설정 | AU-04 |
| F-03 숙박 조회 | DM-01, DM-02, DM-03 |
| F-04 버디 조회 | BD-01, BD-02, AI-03 |
| F-05 투어 조회 | TR-01, TR-02, TR-03, AI-02 |
| F-06 통합 예약 | BK-01 |
| F-07 결제 | BK-06, PM-01~06 |
| F-08 예약 상태 확인 | BK-02, BK-03, BK-10 |
| F-09 채팅 | BK-09 |
| F-10 체크인 안내 | BK-07 |
| F-11 리뷰 | TR-04, BK-08 |
| F-12 AI 추천 | AI-01 |
| P-01 프로필 등록 | BD-03 |
| P-02 가능 일정 등록 | BD-04, AU-07, AU-08 |
| P-03 요청 수락/거절 | BD-05, BD-06, BK-04, AI-04 |
| P-04 활동 내역 | BD-07 |
| A-01 대학/객실 관리 | DM-04, DM-05, DM-06 |
| A-02 예약 관리 | AD-02, BK-04, BK-05 |
| A-03 회원 관리 | AD-03, AD-04, AD-05 |
| A-04 정산 관리 | AD-06 |
| A-05 콘텐츠 관리 | AD-07, AD-09, AI-05 |
| A-06 외국인 숙박신고 | AD-08 |
| 신규 어드민 대시보드 | AD-01 |
| 홈 추천 패키지 / 마이페이지 약관·고객센터 / 어드민 설정 | HM-01 / CM-01 / AD-10 |


## v3 변경

기준: `docs/v3/CONTRACT.md` (해설사 삭제, 코스 무료, 예약 항목은 dorm | buddy). 역할은 `tourist | buddy | univ_admin | operator`.
숫자: 수수료 10%(숙박·버디 활동비) · 앨범 ₩5,000(전액 플랫폼 수입) · 식사 1회 한도 ₩20,000(보증금 = 횟수 × 20,000, 수수료 없음, 최대 4회) · 신고 2건 자동 정지 · 퀴즈 8/10 · 만 19세 · `DEMO_TODAY`(후기·식비 기준일).
`booking.platform_fee = round((total − Σ식사 보증금 − Σ앨범) × 0.10) + Σ앨범`. 버디 정산 = 활동비 × 0.9 + 승인 식비.

| Method | Path | 역할 | 변경 | 내용 |
|---|---|---|---|---|
| PATCH | /auth/me/role | 전체 | 변경 | role은 `tourist` \| `buddy`. `guide` → 422. buddy의 `university_id`는 선택(학교 메일 인증에서 정해짐) |
| GET | /tours, /tours/{id} | 공개 | 변경 | 무료 AI 산책 코스: `price` 0, `guide` null. 예약 항목 아님 |
| GET | /packages | 공개 | 변경 | items의 코스는 `type: "course"`. 모든 패키지에 버디, `total_price` = 숙박 + 버디 활동비 |
| POST | /bookings | tourist | 변경 | 항목에 `request`·`course_id`·`meal_count`(0~4)·`album`. 오류 `COURSE_NOT_BOOKABLE`(tour) · `ONE_STAY` · `BUDDY_REQUIRED` · `BUDDY_OUT_OF_STAY` · `VALIDATION`(요청·코스·식사). 버디만 예약 허용 |
| GET | /bookings/me, /bookings/{id} | 본인 등 | 변경 | BookingItemOut + `request, course_id, course_title, meal_count, meal_deposit, meal_used, meal_approved, meal_refund, album, album_photos, reviewed, can_review`. 버디는 traveler `{name, nationality, guests}` + 자기 항목만, 대학 담당자는 자기 대학 숙박이 있으면 traveler 전체(남의 항목 request는 null) |
| POST | /bookings/{id}/items/{item_id}/replace-buddy | 예약자 | 신규 | `{buddy_id, date?, time?}` → 기존 항목 cancelled(거절이면 그대로) + 새 버디 항목 requested(요청·코스·식사·앨범 복사, 총액·수수료 재계산). 응답 BookingOut |
| POST | /bookings/{id}/reviews | 예약자 | 변경 | `{item_id, rating, text?, sub_scores?:{kind,talk,punctual,local}, tags?:[코드]}`. 확정·지난 항목만 아니면 409 `TRIP_NOT_DONE` |
| GET | /bookings/{id}/album | 예약자 | 신규 | `{items:[{item_id, buddy_name, date, places, photos}]}` (album=true 버디 항목의 활동 기록 사진) |
| GET | /buddies | 공개 | 변경 | 쿼리 `personality, style, can_help, university_id` 추가. 응답 + `university_id, personality, style, can_help, sub_scores, tags_top, walk_count, verified{school_email, trained}` |
| GET | /buddies/{id} | 공개 | 변경 | + `recent_activities:[{date, places, foods}]` 최대 3 |
| GET | /buddies/{id}/activities | 공개 | 신규 | 공개 활동 기록 최대 10개 `{items:[{date, places, foods}]}` |
| POST | /ai/plan | tourist | 변경 | 숙소가 있으면 버디 필수(숙박 기간 안·같은 대학 우선), 버디 항목에 `course_id`. 버디가 없으면 `type:"course"`(price 0) 항목. `warnings`: `NO_BUDDY` · `OVER_BUDGET`(버디는 빼지 않음) |
| POST | /ai/buddy-match | tourist | 변경 | body + `personality, style, needs(can_help 코드), university_id`. 점수 + 성향·스타일 0.05×(최대 2) + 도움 0.10 + 같은 대학 0.10 (최대 0.99) |
| POST | /ai/buddy-brief | buddy | 변경 | 장소: 코스 → 요청 places → 관심사. 요청(식단·알레르기·속도)을 brief 첫 문장에. guide 역할 삭제 |
| GET/PUT | /buddy/profile | buddy | 변경 | + `personality, style, can_help, bank_account` (코드값만), 응답 + `school_email, school_email_verified, code_agreed, quiz_score` |
| GET | /buddy/requests, /buddy/schedule | buddy | 변경 | + `request, course_id, course_title, meal_count, album`. tourist는 `{id, name, nationality, language}`만 |
| GET | /buddy/earnings | buddy | 변경 | `amount` = 활동비 − 수수료 (식사 보증금·앨범 제외) |
| GET | /buddy/settlement?month=YYYY-MM | buddy | 신규 | `{month, pay_date, account(마스킹), walks, gross, fee, net, meals_approved, meals_pending, payout, items[]}` |
| POST/GET | /buddy/meal-claims | buddy | 신규 | `{item_id, place, items, amount, receipt_url?}` → 201 MealClaimOut. 본인 확정 항목, 청구 수(반려 제외) < meal_count 아니면 409 `MEAL_LIMIT` |
| POST/GET | /buddy/activities | buddy | 신규 | `{item_id?, date, places[], foods?, note?, photos?[]}` → 201 |
| GET | /buddy/apply | buddy | 신규 | `{email_verified, school_email, university, age_ok, code_agreed, quiz_score, quiz_passed, profile_done, status}` |
| POST | /buddy/apply/email | buddy | 신규 | `{email}` → `{sent, university, dev_code}`. 성북 대학 도메인 아니면 422 `NOT_SEONGBUK_SCHOOL` |
| POST | /buddy/apply/verify | buddy | 신규 | `{email, code, birth_date}` → 422 `BAD_CODE` · `TOO_YOUNG`. 대학·생년월일 저장, 프로필 pending 생성 |
| POST | /buddy/apply/agree | buddy | 신규 | 버디 약속 동의 (메일 인증 전이면 409) |
| GET/POST | /buddy/apply/quiz | buddy | 신규 | 10문제(정답 미포함) / `{answers:{id: 보기 번호(0부터)}}` → `{score, total, passed, best_score}` |
| POST | /reports | 예약자 | 신규 | `{booking_item_id, category, text, photo_url?}` (버디 항목만) → 201. 기각 제외 2건이면 자동 정지 `auto_suspended` |
| GET/PATCH | /admin/reports | operator | 신규 | 목록(`?status=`) / `{action: warn\|suspend\|unsuspend\|dismiss}` |
| GET/PATCH | /admin/meal-claims | operator | 신규 | MealClaimOut + `buddy_name, deposit, deposit_left(이 청구 제외), request_summary` / `{action: approve\|reject, reason?}`, 승인 합이 보증금을 넘으면 409 `OVER_DEPOSIT` |
| GET | /admin/buddies | admin | 변경 | + `age, school_email_verified, code_agreed, quiz_score, report_count, can_help` |
| PATCH | /admin/buddies/{id} | admin | 변경 | approve는 학교 메일·만 19세·약속 동의·퀴즈 8점 모두 필요, 아니면 409 `NOT_READY`(빠진 항목) |
| GET | /admin/settlements | operator | 변경 | 해설사 행 삭제, 버디 행 + `meals`, `payout` = 활동비×0.9 + meals, 응답 + `meal_refund_total` |
| GET | /admin/tours | admin | 변경 | 코스 행 `{id, title, theme, duration_min, places, place_count, story_ready, buddy_walks}` |

### v3.1 추가
| Method | Path | 역할 | 변경 | 내용 |
|---|---|---|---|---|
| GET | /buddies, /buddies/{id} | 공개 | 변경 | + `can_drive` (운전 가능 표시만. 차량 이동·차비 없음 — 자가용 유상 운송 금지) |
| GET/PUT | /buddy/profile | buddy | 변경 | + `can_drive: bool` |
| GET | /admin/buddies | admin | 변경 | + `can_drive` |
| GET | /admin/settlements | operator | 변경 | + `profit {sales, sales_dorm, sales_buddy, sales_album, cost_university, cost_buddy, cost_other, profit, margin}`. 판매가 − 원가 = 이익, 식사 보증금·식비 제외 |

### v3.2 추가 — 버디 등급·정산율, 휴면, 한국 국적
등급(기본 70% · 성장 75% · 우수 80%)은 현재 + 직전 운영 방학의 완료 동행·평균 평점·후기 수로 매월 1회 갱신. 정산율은 버디 항목이 확정될 때 `booking_items.payout_rate`로 고정.
`booking.platform_fee = round(숙박 × 0.10) + Σ(활동비 − round(활동비 × 정산율)) + Σ앨범` (확정 전 항목은 버디의 지금 정산율로 어림). 버디 정산 = Σ round(활동비 × 항목 정산율) + 승인 식비.

| Method | Path | 역할 | 변경 | 내용 |
|---|---|---|---|---|
| GET | /buddies, /buddies/{id} | 공개 | 변경 | + `grade` (basic \| growth \| top, 화면 배지는 성장·우수만). 휴면(`needs_recheck`) 버디는 목록·AI 추천(AI-01·03)에서 빠짐(상세는 열림) |
| POST | /bookings, replace-buddy | 예약자 | 변경 | 휴면 버디 → 409 `BUDDY_RESTING` |
| PATCH | /bookings/{id}/items/{item_id} | buddy | 변경 | 버디가 수락(confirmed)하면 그때 정산율을 항목에 고정하고 예약 `platform_fee` 다시 계산 |
| GET | /buddy/grade | buddy | 신규 | `{grade, payout_rate, window:{from,to,label}, stats:{rating,walks,reviews}, next:{grade,payout_rate,need:{rating,walks,reviews}}\|null, needs_recheck, dormant_since, updated_at}` (`need` = 다음 등급 기준값) |
| POST | /buddy/confirm-active | buddy | 신규 | 휴면 복귀 '계속 활동할게요' → `needs_recheck=false`. 등급·정산율 그대로. 응답 = /buddy/grade |
| GET | /buddy/settlement | buddy | 변경 | + `grade, payout_rate`, items[] + `payout_rate`. `fee` = 활동비 − net, `net` = round(활동비 × 항목 정산율) |
| GET | /buddy/earnings | buddy | 변경 | `amount` = 항목 정산율을 적용한 버디 몫 |
| GET | /buddy/apply | buddy | 변경 | + `korean_national` |
| POST | /buddy/apply/verify | buddy | 변경 | body + `korean_national: bool` (true 아니면 422 `NOT_KOREAN_NATIONAL` — 외국인 유학생은 시간제 취업 허가 문제로 불가) |
| GET | /admin/buddies | admin | 변경 | + `korean_national, grade, payout_rate, eval_rating, eval_walks, eval_reviews, needs_recheck` |
| PATCH | /admin/buddies/{id} | admin | 변경 | approve는 한국 국적 확인도 필요 (409 `NOT_READY`) |
| POST | /admin/buddies/recompute-grades | operator | 신규 | 등급·정산율 갱신 → 휴면 판정. 바뀐 버디 행 `{items:[AdminBuddyRow]}`. 매월 1일 실행 (`scripts/recompute_grades.py`도 같음) |
| GET | /admin/settlements | operator | 변경 | 버디 행 `fee` = 활동비 − Σ 버디 몫(항목 정산율), + `payout_rate`(실효값). `profit.cost_buddy` 도 항목 정산율로 |
