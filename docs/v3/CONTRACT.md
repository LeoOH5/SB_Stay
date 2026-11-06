# SB Stay v3 변경 계약서 (백엔드·프론트 공통)

v3 화면(해설사 없음, 버디만, 쪽빛 남색 + 감 주황, 로고 C '한 지붕 아래 둘')에 맞춘 코드 변경의 단일 기준.
백엔드와 프론트 목업(`frontend/src/lib/mock`)은 이 문서의 경로·필드명을 그대로 따른다.
화면 그림: `docs/v3/screens/*.png` (T=관광객, B=버디, A=관리자).

## 0. 큰 원칙
- **해설사(guide) 역할 삭제.** ROLES = tourist | buddy | univ_admin | operator. 역할 선택·데모 계정·화면에서 모두 뺀다.
- **투어 → 무료 AI 산책 코스.** DB 테이블 `tours`/`tour_places`와 `/tours` 경로는 그대로 쓰되 의미는 "코스".
  `price`는 0, `guide_id`는 NULL 허용. **코스는 예약 항목이 아니다** (`type="tour"` 예약 → 422 `COURSE_NOT_BOOKABLE`).
  장소 이야기는 AI-02(`/ai/story`)가 맡는다. 버디와 함께 걸을 코스는 버디 항목의 `course_id`로 고른다.
- **예약 항목은 dorm | buddy 두 가지.**
- 사실 값(가격·날짜·운영시간)은 DB에서만. LLM은 고르기·설명만.

## 1. 숫자 규칙 (core/config 또는 상수)
| 이름 | 값 | 뜻 |
|---|---|---|
| `platform_fee_rate` | 0.10 | 숙박·버디 활동비에만. 식사 보증금에는 수수료 없음. 앨범 요금은 전액 플랫폼 수입 |
| `MEAL_LIMIT` | 20000 | 식사 1회 한도(2인). 보증금 = 횟수 × 20000 |
| `MEAL_MAX` | 4 | 버디 항목 1개당 식사 최대 횟수 |
| `ALBUM_FEE` | 5000 | 여행 앨범 옵션 |
| `REPORT_SUSPEND_AT` | 2 | 한 버디에게 신고(기각 제외)가 2건 쌓이면 자동 정지 |
| `QUIZ_PASS` | 8 / 10 | 버디 교육 퀴즈 통과 점수 |
| `BUDDY_MIN_AGE` | 19 | 만 나이 |
| `buddy_otp_code` | "123456" | 학교 메일 인증번호 (데모: 메일 발송 없이 고정값. 설정으로 바꿀 수 있게) |
| `demo_today` | None | 설정값. 있으면 '오늘'로 쓴다(후기 가능 여부, 식비 환불 확정). 데모는 `DEMO_TODAY=2027-01-14` |

버디 항목 가격 = `hourly_fee × 시간` + (`album` ? 5000 : 0) + `meal_count × 20000`.
`booking.platform_fee = round((total_price − Σ meal_deposit − Σ album_fee) × 0.10) + Σ album_fee` (앨범은 버디 정산에 들어가지 않는다).

## 2. DB 변경 — Alembic 1개: `v3_buddy_only` (down_revision = `776d75a1c756`)
- `users` + `birth_date DATE NULL`
- `universities` + `email_domains JSON NULL` (예: `["korea.ac.kr","a-univ.ac.kr"]` — 데모 계정 도메인 a-univ.ac.kr은 1번 대학에 포함)
- `tours.guide_id` → NULL 허용
- `buddy_profiles` + `personality JSON`, `style JSON`, `can_help JSON`, `school_email VARCHAR(255)`, `school_email_verified_at TIMESTAMPTZ`, `code_agreed_at TIMESTAMPTZ`, `quiz_score SMALLINT`, `bank_account VARCHAR(100)`
- `booking_items` + `request JSON NULL`, `course_id INT NULL FK tours.id`, `meal_count SMALLINT DEFAULT 0`, `meal_deposit INT DEFAULT 0`, `album BOOLEAN DEFAULT false`
- `reviews` + `sub_scores JSON NULL`, `tags JSON NULL`
- 새 표 `buddy_activities`: id, buddy_id FK buddy_profiles, booking_item_id FK NULL, date, places JSON(문자열 목록), foods TEXT, note TEXT, photos JSON(문자열 목록), created_at
- 새 표 `meal_claims`: id, booking_item_id FK, buddy_id FK, date, place VARCHAR(100), items TEXT, amount INT, receipt_url VARCHAR(500) NULL, status(requested|approved|rejected), reason TEXT NULL, decided_by FK users NULL, decided_at, created_at
- 새 표 `reports`: id, booking_item_id FK NULL, reporter_id FK users, buddy_id FK buddy_profiles, category(no_show|rude|money|unsafe|other), text TEXT, photo_url NULL, status(open|resolved|dismissed), action VARCHAR(20) NULL, auto_suspended BOOL, created_at, resolved_at
- `guides` 표는 남겨 둔다(빈 표). 코드에서 쓰지 않는다.

## 3. 코드값 (프론트 라벨은 한국어/영어로 번역)
- diet: vegan 비건, vegetarian 채식, halal 할랄, no_pork 돼지고기 X, no_beef 소고기 X, no_alcohol 술 X
- allergies: mushroom 버섯, nuts 견과류, seafood 해산물, dairy 유제품, egg 달걀, gluten 밀
- pace: slow 천천히, normal 보통
- dorm 요청: late_checkin 늦은 체크인, quiet_room 조용한 방, low_floor 낮은 층
- personality: calm 차분해요, lively 활발해요, listener 잘 들어줘요, humor 유머 있어요
- style: slow_walk 천천히 걸어요, explore 많이 돌아봐요, cafe_break 카페에서 쉬어 가요, photo_walk 사진 위주
- can_help: vegan_food 비건 식당 안내, halal_food 할랄 식당 안내, photo 사진 찍어 주기, subway 지하철 타는 법, shopping 쇼핑
- review sub_scores 키: kind 친절해요, talk 소통, punctual 시간 약속, local 동네 추천 (각 1~5)
- review tags: fun_talk 대화가 즐거워요, knows_food 맛집을 잘 알아요, good_photos 사진을 잘 찍어 줘요, cares_requests 요청을 잘 챙겨요, easy_guide 길 안내가 편해요
- report category: no_show 약속 장소에 오지 않았어요, rude 불편한 말이나 행동, money 돈이나 선물 요구, unsafe 안전이 걱정돼요, other 기타
- 요청 → 도움 매핑(매칭용): vegan/vegetarian → vegan_food, halal → halal_food

## 4. 예약 (BK) — `services/booking_state.py`
### BookingItemIn (추가 필드)
```
request: dict | None      # buddy: {diet:[], allergies:[], pace:"slow"|"normal", places:[place_id ≤3], note:"≤300자"}
                          # dorm:  {late_checkin:bool, quiet_room:bool, low_floor:bool}
course_id: int | None     # buddy 항목: 같이 걸을 코스 (tours.id)
meal_count: int = 0       # buddy 항목: 0~4
album: bool = False       # buddy 항목
```
### 생성 규칙 (create_booking) — 오류 코드
- `type == "tour"` → 422 `COURSE_NOT_BOOKABLE`
- dorm 2개 이상 → 422 `ONE_STAY`
- dorm 있는데 buddy 0개 → 422 `BUDDY_REQUIRED` ("기숙사 숙박에는 버디가 1명 필요해요")
- dorm 있을 때 buddy 날짜가 `dorm.date_from ≤ d ≤ dorm.date_to` 밖 → 422 `BUDDY_OUT_OF_STAY`
- request·course_id·meal_count 검증 실패 → 422 `VALIDATION`
- buddy만 있는 예약은 허용. tour 즉시 확정 로직 삭제.
### BookingItemOut (추가)
```
request, course_id, course_title, meal_count, meal_deposit,
meal_used        # 이 항목 식비 청구 중 requested+approved 합
meal_approved    # approved 합
meal_refund      # meal_deposit − meal_approved (여행 끝나기 전엔 예정액)
album, album_photos   # 앨범 사진 수
reviewed: bool, can_review: bool   # can_review = confirmed && date_from ≤ 오늘(demo_today) && 아직 후기 없음
```
### 개인정보 (BK-03 수정)
- 예약자 본인·operator: traveler 전체.
- univ_admin(자기 대학 숙박 항목이 있는 예약): traveler 전체 (체크인에 여권 필요).
- buddy: traveler는 `{name, nationality, guests}`만, items는 **자기 항목만**, 자기 항목의 request는 보임.
- 다른 공급자의 항목 request는 절대 내보내지 않는다.
### 버디 바꾸기
`POST /bookings/{id}/items/{item_id}/replace-buddy` body `{buddy_id, date?, time?}` (예약자 본인)
- 대상 항목이 buddy이고 status ∈ requested|rejected|confirmed(날짜 전).
- 기존 항목: rejected면 그대로, 아니면 cancelled. 새 buddy 항목을 requested로 만들고 request·course_id·meal_count·album 복사, 가격 다시 계산(총액·수수료 갱신).
- dorm 기간 규칙 그대로 검사. 응답 BookingOut.
### 후기 (BK-08 수정)
body `{item_id, rating 1~5, text?, sub_scores?: {kind,talk,punctual,local}, tags?: [코드]}`
- 항목 confirmed/approved 이고 `date_from ≤ 오늘` 아니면 409 `TRIP_NOT_DONE`. 1항목 1후기.
### 앨범
`GET /bookings/{id}/album` (본인) → `{items: [{item_id, buddy_name, date, places: [str], photos: [url]}]}` — album=true인 버디 항목의 활동 기록 사진.

## 5. 버디 공개 정보 (BD-01·02)
BuddyOut 추가: `personality[], style[], can_help[], sub_scores {kind,talk,punctual,local}(평균, 없으면 null), tags_top [코드 최대 3], walk_count, verified {school_email: bool, trained: bool}`
BuddyDetailOut 추가: `recent_activities: [{date, places:[str], foods}]` 최대 3개 (여행자 이름 없음)
BD-01 쿼리 추가: `personality`, `style`, `can_help`, `university_id`
`GET /buddies/{id}/activities` → 공개 활동 기록 최대 10개.

## 6. AI
- **AI-01 `/ai/plan`**: 코스는 무료 추천. PlanItem.type에 `"course"` 추가(price 0, meta "무료 코스 · 장소 N곳"). 숙소를 넣으면 버디를 반드시 넣고(숙박 기간 안), 버디 항목에 `course_id`. 버디가 없으면 `warnings: ["NO_BUDDY"]`. 예산 초과 시 숙소가 있으면 버디는 빼지 않고 `warnings: ["OVER_BUDGET"]`. PlanOut에 `warnings: list[str]` 추가. 버디 후보는 숙소와 같은 대학 우선.
- **AI-03 `/ai/buddy-match`**: body에 `personality?[] style?[] needs?[](can_help 코드) university_id?` 추가. 점수 = 기존 + 성향/스타일 일치 0.05×(최대 2) + needs를 모두 도우면 0.10 + 같은 대학 0.10, 최대 0.99. 이유 문장에 "비건 식당 안내 가능", "같은 대학 숙소" 등.
- **AI-04 `/ai/buddy-brief`**: 장소는 버디 항목의 `course_id` 코스 → 없으면 request.places → 없으면 관심사. 요청(식단·알레르기·속도)을 brief 템플릿 첫 문장에 넣는다 ("비건, 버섯 알레르기 요청이 있어요. 식당에서 꼭 확인해 주세요."). 투어 관련 문장 삭제.

## 7. 버디 본인 (BD-03~07, `/buddy/*`, role=buddy만)
- PUT `/buddy/profile` 필드 추가: personality, style, can_help, bank_account
- `GET /buddy/requests` 항목에 `request, course_title, meal_count, album` 추가 (본인 항목이므로 보임). traveler는 이름·국적만.
- 식비: `POST /buddy/meal-claims {item_id, place, items, amount, receipt_url?}` → 201 MealClaimOut. 조건: 본인 항목, confirmed, meal_count>0, 청구 수 < meal_count. `GET /buddy/meal-claims`.
  MealClaimOut = `{id, item_id, booking_code, tourist, date, place, items, amount, limit:20000, over_limit(bool), status, reason, created_at}`
- 활동 기록: `POST /buddy/activities {item_id?, date, places:[str], foods?, note?, photos?:[str]}` → 201, `GET /buddy/activities`.
- 정산: `GET /buddy/settlement?month=2027-01` →
  `{month, pay_date:"2027-02-28", account(마스킹), walks, gross, fee, net, meals_approved, meals_pending, payout, items:[{item_id, date, tourist, gross, fee, meal_approved, meal_pending, net, status:"confirmed"|"meal_pending"}]}`
  gross = 활동비(앨범 제외), fee = round(gross×0.1), net = gross − fee, payout = net 합 + meals_approved.
- `GET /buddy/earnings` amount는 수수료 뺀 금액(net)으로.
- 지원 5단계 (`/buddy/apply/*`):
  - `GET /buddy/apply` → `{email_verified, school_email, university, age_ok, code_agreed, quiz_score, quiz_passed, profile_done, status}`
  - `POST /buddy/apply/email {email}` → 도메인이 universities.email_domains에 없으면 422 `NOT_SEONGBUK_SCHOOL`. 응답 `{sent:true, university, dev_code}` (dev_code는 설정 debug일 때만)
  - `POST /buddy/apply/verify {email, code, birth_date}` → code 틀리면 422 `BAD_CODE`, 만 19세 미만 422 `TOO_YOUNG`. user.university_id·birth_date 저장, 프로필 없으면 pending으로 생성.
  - `POST /buddy/apply/agree` → code_agreed_at
  - `GET /buddy/apply/quiz` → `{questions:[{id, text, options:[str]}]}` 10문제(정답 미포함)
  - `POST /buddy/apply/quiz {answers:{id: 보기번호}}` → `{score, total:10, passed}` (최고 점수 저장)
- 신고 누적으로 suspended면 요청 받기 멈춤(BD-01 목록에서 빠짐 — status=approved만 노출하므로 자동).

## 8. 신고
- `POST /reports {booking_item_id, category, text, photo_url?}` (예약자 본인, 버디 항목만) → 201. 저장 후 그 버디의 신고(dismissed 제외) 수 ≥ 2 이고 approved면 suspended, `auto_suspended=true`.
- `GET /admin/reports?status=` (operator) → `{items:[{id, created_at, buddy_id, buddy_name, buddy_university, reporter, booking_code, category, text, photo_url, count_for_buddy, status, action, auto_suspended, buddy_status}]}`
- `PATCH /admin/reports/{id} {action: warn|suspend|unsuspend|dismiss}` → 신고 resolved(dismiss면 dismissed), 버디 상태 반영.

## 9. 관리자
- AD-04 승인(`approve`)은 학교 메일 인증·만 19세·약속 동의·퀴즈 ≥8 모두 충족해야 함. 아니면 409 `NOT_READY` + message에 빠진 항목.
- AdminBuddyRow 추가: `age, school_email_verified, code_agreed, quiz_score, report_count, can_help`
- AD-06 정산: 해설사 행 삭제. 버디 행에 `meals`(승인 식비) 추가, 지급액 = 활동비×0.9 + meals. 응답에 `meal_refund_total`(여행자에게 돌려줄 남은 보증금 합).
- 식비 심사: `GET /admin/meal-claims?status=` (operator) → MealClaimOut + `{buddy_name, deposit, deposit_left, request_summary}`; `PATCH /admin/meal-claims/{id} {action: approve|reject, reason?}`
- AD-07 `/admin/tours` → 코스 행 `{id, title, theme, duration_min, places:[이름], place_count, story_ready(이야기 자료 있는 장소 수), buddy_walks(이 코스를 고른 버디 항목 수)}`

## 10. 시드
- guides.json → `[]`, users에서 해설사 계정 삭제, tours.json `guide_id: null, price: 0`.
- bookings/booking_items: tour 항목 삭제. 숙박 예약은 모두 기간 안 버디 1개 이상. Emma 예약 SB-2027-0112: 숙박(1/12–15) + 버디 지우(1/13 14:00, course 3, request 비건·버섯·천천히, meal_count 2, album true). 지난 여행 1건은 confirmed + 후기(sub_scores·tags).
- buddy_profiles: personality·style·can_help 채우고 approved 버디는 school_email_verified_at·code_agreed_at·quiz_score(9) 채움. 대기 버디 1명은 quiz 7.
- buddy_activities 몇 개(지우: 1/6 길상사→수연산방 대추차·단팥죽 등), meal_claims 예시(승인 1, 대기 1), reports 예시 1건.
- packages: tour_id는 "추천 코스"로 유지, 모든 패키지에 버디, total_price = 숙박 + 버디 활동비.
- universities.email_domains 채움.

## 11. 프론트
- 색: `--sb-navy` 계열 → 쪽빛 `#1E3A5F`(진하게 `#172E4C`, 연하게 `#E7EDF5`), 강조 감 주황 `#E2722F`(로고 `#F08A3C`, 연하게 `#FDF0E7`). 기존 green 토큰은 쓰지 않음(확정 상태도 쪽빛).
- 글꼴: IBM Plex Sans KR(`@fontsource/ibm-plex-sans-kr` 400/600/700). 굵기는 400 본문, 600 강조·버튼, 700 제목.
- 상단: 흰 배경 상단바. 첫 화면은 로고+“성북스테이”(쪽빛 700), 버디 앱은 + 주황 “버디” 배지, 관리자는 “관리” 배지. 탭 화면 제목 22px 700.
- 탭: 관광객 홈 · 숙박 · 코스 · 내 여행 / 버디 홈 · 요청함 · 일정 · 내 활동.
- 로고 SVG: `frontend/public/brand/*.svg` (C안).
- 목업(`lib/mock`)도 이 문서의 새 경로를 모두 지원한다(USE_MOCK=true에서 전 화면 시연 가능해야 함).
