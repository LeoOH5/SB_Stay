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
| `platform_fee_percent` | 10 (정수 %) | 숙박에만 (v3.2: 버디 활동비는 등급 정산율 → §12). 식사 보증금에는 수수료 없음. 앨범 요금은 v3.6부터 활동비처럼 정산율로 나눔 (§15) |
| `MEAL_LIMIT` | 20000 | 식사 1회 한도(2인). 보증금 = 횟수 × 20000 |
| `MEAL_MAX` | 4 | 버디 항목 1개당 식사 최대 횟수 |
| `ALBUM_FEE` | 5000 | 여행 앨범(사진 기록, '셋로그') 옵션. 버디 몫 = 5000 × 정산율 (70% 3,500 · 75% 3,750 · 80% 4,000) |
| `REPORT_SUSPEND_AT` | 2 | 한 버디에게 신고(기각 제외)가 2건 쌓이면 자동 정지 |
| `QUIZ_PASS` | 8 / 10 | 버디 교육 퀴즈 통과 점수 |
| `BUDDY_MIN_AGE` | 19 | 만 나이 |
| `buddy_otp_code` | "123456" | 학교 메일 인증번호 (데모: 메일 발송 없이 고정값. 설정으로 바꿀 수 있게) |
| `demo_today` | None | 설정값. 있으면 '오늘'로 쓴다(후기 가능 여부, 식비 환불 확정). 데모는 `DEMO_TODAY=2027-01-14` |

버디 항목 가격 = `hourly_fee × 시간` + (`album` ? 5000 : 0) + `meal_count × 20000`.
`booking.platform_fee = round((total_price − Σ meal_deposit − Σ album_fee) × 0.10) + Σ album_fee` (앨범은 버디 정산에 들어가지 않는다).
v3.2부터: `booking.platform_fee = round(숙박 × 0.10) + Σ(활동비 − round(활동비 × 정산율)) + Σ album_fee` (§12).
**v3.6부터 (지금 규칙)**: 정산 대상 = 활동비 + 앨범 (`booking_state.payout_base`). 식사 보증금은 통과 금액 그대로.
- 버디 몫 = `round((활동비 + 앨범) × 항목 정산율)` (Decimal, `grades.buddy_net`)
- `booking.platform_fee = rules.pct(숙박, 10) + Σ((활동비 + 앨범) − 버디 몫)`
- 예: 활동비 30,000 + 앨범 5,000, 성장 75% → 버디 26,250 / 플랫폼 8,750.

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
BuddyOut 추가: `personality[], style[], can_help[], can_drive(v3.1, 표시만), sub_scores {kind,talk,punctual,local}(평균, 없으면 null), tags_top [코드 최대 3], walk_count, verified {school_email: bool, trained: bool}`
BuddyDetailOut 추가: `recent_activities: [{date, places:[str], foods}]` 최대 3개 (여행자 이름 없음)
BD-01 쿼리 추가: `personality`, `style`, `can_help`, `university_id`
`GET /buddies/{id}/activities` → 공개 활동 기록 최대 10개.

## 6. AI
- **AI-01 `/ai/plan`**: 코스는 무료 추천. PlanItem.type에 `"course"` 추가(price 0, meta "무료 코스 · 장소 N곳"). 숙소를 넣으면 버디를 반드시 넣고(숙박 기간 안), 버디 항목에 `course_id`. 버디가 없으면 `warnings: ["NO_BUDDY"]`. 예산 초과 시 숙소가 있으면 버디는 빼지 않고 `warnings: ["OVER_BUDGET"]`. PlanOut에 `warnings: list[str]` 추가. 버디 후보는 숙소와 같은 대학 우선.
- **AI-03 `/ai/buddy-match`**: body에 `personality?[] style?[] needs?[](can_help 코드) university_id?` 추가. 점수 = 기존 + 성향/스타일 일치 0.05×(최대 2) + needs를 모두 도우면 0.10 + 같은 대학 0.10, 최대 0.99. 이유 문장에 "비건 식당 안내 가능", "같은 대학 숙소" 등.
- **AI-04 `/ai/buddy-brief`**: 장소는 버디 항목의 `course_id` 코스 → 없으면 request.places → 없으면 관심사. 요청(식단·알레르기·속도)을 brief 템플릿 첫 문장에 넣는다 ("비건, 버섯 알레르기 요청이 있어요. 식당에서 꼭 확인해 주세요."). 투어 관련 문장 삭제.

## 7. 버디 본인 (BD-03~07, `/buddy/*`, role=buddy만)
- PUT `/buddy/profile` 필드 추가: personality, style, can_help, bank_account, can_drive(v3.1)
- `GET /buddy/requests` 항목에 `request, course_title, meal_count, album` 추가 (본인 항목이므로 보임). traveler는 이름·국적만.
- 식비: `POST /buddy/meal-claims {item_id, place, items, amount, receipt_url?}` → 201 MealClaimOut. 조건: 본인 항목, confirmed, meal_count>0, 청구 수 < meal_count. `GET /buddy/meal-claims`.
  MealClaimOut = `{id, item_id, booking_code, tourist, date, place, items, amount, limit:20000, over_limit(bool), status, reason, receipt_url(v3.6), created_at}`
- 활동 기록: `POST /buddy/activities {item_id?, date, places:[str], foods?, note?, photos?:[str]}` → 201, `GET /buddy/activities`.
- 정산: `GET /buddy/settlement?month=2027-01` →
  `{month, pay_date:"2027-02-28", account(마스킹), walks, gross, fee, net, meals_approved, meals_pending, payout, items:[{item_id, date, tourist, gross, fee, meal_approved, meal_pending, net, status:"confirmed"|"meal_pending"}]}`
  gross = 활동비(앨범 제외), fee = round(gross×0.1), net = gross − fee, payout = net 합 + meals_approved.
  (v3.2: net = round(gross × 항목 payout_rate), fee = gross − net — §12)
  (v3.6: gross = 활동비 + 앨범, `album` = 그중 앨범(항목·합계 모두), net = round(gross × payout_rate) — §15)
- `GET /buddy/earnings` amount는 수수료 뺀 금액(net, v3.6부터 앨범 버디 몫 포함)으로.
- 지원 5단계 (`/buddy/apply/*`, v3.7부터 6단계 → §16):
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
- AD-04 승인(`approve`)은 학교 메일 인증·만 19세·약속 동의·퀴즈 ≥8 모두 충족해야 함. 아니면 409 `NOT_READY` + message에 빠진 항목. (v3.7: 자격 경로·교육 영상 추가 → §16)
- AdminBuddyRow 추가: `age, school_email_verified, code_agreed, quiz_score, report_count, can_help, can_drive(v3.1)`
- AD-06 정산: 해설사 행 삭제. 버디 행에 `meals`(승인 식비) 추가, 지급액 = 활동비×0.9 + meals. 응답에 `meal_refund_total`(여행자에게 돌려줄 남은 보증금 합).
  v3.1: `profit {sales, sales_dorm, sales_buddy, sales_album, cost_university, cost_buddy, cost_other(0), profit, margin}` — sales = 숙박 + 활동비 + 앨범, 원가 = 대학·버디 지급(×0.9), 식사 보증금·식비는 통과 금액이라 제외. margin = profit/sales (소수 셋째 자리).
  v3.6: 버디 행 `revenue` = 활동비 + 앨범, `album` = 그중 앨범. `profit.cost_buddy` = 버디 지급 전체(활동비 몫 + 앨범 몫), `profit.cost_buddy_album` = 그중 앨범 몫. `sales_buddy`는 활동비만, `sales_album`은 앨범 요금(그대로) — §15.
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

## 12. 버디 등급·정산율·휴면·국적 (v3.2 `v3d_buddy_grade`, v3.7부터 매달 평가 — Alembic `v3g_monthly_grade`, down_revision `v3f_course_duration`)
- 규칙(`app/core/rules.py` · 프론트 `lib/codes.ts`): `GRADES` = 우수 top(지난달 동행 ≥ 7 · 누적 후기 ≥ 5 · 평점 ≥ 4.5, 0.800) · 성장 growth(≥ 4 · ≥ 3 · ≥ 4.3, 0.750) · 기본 basic(0.700). `GRADE_NOTE` 안내 문장. `DORMANT_DAYS` 30.
- **평가일 = 매달 1일. 평가 달 = 그 전 달(달력 기준).** `recompute_all(db, 어느 날)`은 그날이 든 달 1일의 평가를 한다(1/14에 눌러도 1/1 평가 = 12월 실적).
  이미 그 달을 평가했으면 건너뛴다(`grade_evaluated_for`) → 같은 달에 여러 번 돌려도 한 단계만 오른다.
- 실적: **지난달** 완료 동행 수(확정 + 날짜가 그 달 안, 누적 아님. 말일 동행은 세고 1일 동행은 다음 달). 후기 개수·평균 평점은 **누적**(지난달 말일까지 날짜인 동행의 후기 전체).
- 결정(`grades.decide(지금 등급, 첫 달, 동행, 후기, 평점)`):
  - 승인 후 첫 달은 기본: `approved_on`이 평가 달 1일보다 늦거나 없음.
  - 성장 조건은 지금 등급과 상관없음. 우수는 지금 성장(또는 우수)일 때만 → **올라갈 때 한 단계씩**(기본 → 우수 바로는 안 됨). 우수를 지키려면 우수 조건을 다시 채워야 함.
  - **내려갈 때는 바로** 조건에 맞는 가장 높은 등급으로(우수 + 지난달 2회 → 기본, 5회 → 성장). 동행이 없는 달도 같게 평가(방학이 끝나면 대부분 기본).
- DB: `buddy_profiles` + `grade`, `payout_rate NUMERIC(4,3)`, `grade_updated_at DATE`(평가일), `needs_recheck`, `dormant_since`, `active_on`, `korean_national_confirmed_at`(v3.2) + **`approved_on DATE`**, **`grade_evaluated_for DATE`**(지금 등급을 정한 평가 달 1일, v3.7). `booking_items.payout_rate`(버디 항목 확정 때 고정, 그대로).
- 서비스 `services/grades.py`: `decide`, `evaluate(db, buddy, as_of)`, `stats_now`(화면용), `apply_grade`, `recompute_all(db, as_of, dormancy=True)`(등급 → 휴면), `replay(db, since, today)`(시드용: 매달 차례로), `lock_rate`, `item_rate`, `buddy_net`. `VACATIONS`는 이제 휴면 일수에만 쓴다.
- 휴면 = 운영 기간(`VACATIONS`)만 세어 30일간 활동(완료 동행·요청 수락·가능 날짜 수정)이 없음 → `needs_recheck`. 목록·AI 추천에서 빠지고 새 예약 409 `BUDDY_RESTING`. **v3.7부터 등급은 멈추지 않는다**(휴면이어도 매달 평가). `POST /buddy/confirm-active`는 `needs_recheck`·`dormant_since`를 지운다.
- 승인(AD-04) 때 `approved_on` = 오늘(`get_settings().today()`), 처음 한 번만.
- API:
  - `GET /buddy/grade` → `{grade, payout_rate, evaluated_for:"2026-12"|null, next_eval_on:"2027-02-01", stats:{month:"2026-12", last_month_walks, this_month_walks, reviews, rating}, next:{grade, payout_rate, need:{walks, reviews, rating}}|null, keep:{walks, reviews, rating}|null, first_month, note, needs_recheck, dormant_since, updated_at}` ([BD-08](../api-detail/BD-08.md)). `stats.reviews`·`rating`은 오늘까지 누적, `this_month_walks`는 다음 평가에 쓰일 이번 달 완료 동행.
  - AdminBuddyRow: `eval_rating·eval_walks·eval_reviews` 삭제 → `eval_month, last_month_walks, total_reviews, avg_rating, evaluated_for, approved_on` (+ 자격 칸 §16).
  - `POST /admin/buddies/recompute-grades`(operator): 이번 달 평가를 안 한 버디만 평가 + 휴면 판정, 바뀐 행. `scripts/recompute_grades.py [날짜]`도 같음.
  - BuddyOut `grade`, `/buddy/settlement` `grade, payout_rate`, items[].`payout_rate`, SettlementRow `payout_rate` — 그대로.
- 국적: `POST /buddy/apply/verify`·`/apply/residence` + `korean_national: bool`(아니면 422 `NOT_KOREAN_NATIONAL`), 승인 조건에 국적 확인.
- 시드(DEMO_TODAY 2027-01-14): 로더가 가장 이른 승인일 다음 달부터 2027-01-01까지 매달 평가를 다시 해 본다 → 시드 등급 = 2027-01-01 평가(2026년 12월 동행). 지우 성장 75%, 나머지 기본 70%(수아는 기본 + 휴면).

## 13. v3.4 세 가지 이용 방식 · 무료 AI 산책 코스 (Alembic `v3e_ai_usage`, down_revision `v3d_buddy_grade`)
- 이용 방식: ① 숙박 + 버디(유료, `BUDDY_REQUIRED`·`BUDDY_OUT_OF_STAY` 그대로) ② 버디만(유료, 숙박 없는 버디 예약 허용 — 그대로) ③ 무료 AI 산책 코스(기본 입구, ②·①로 이끄는 제한판).
- 무료/버디 판정 `services/free_tier.py`: 결제(`paid_at`)했고 취소되지 않은 예약에 살아 있는 버디 항목(requested·approved·confirmed)이 있으면 `buddy`, 아니면 `free`. 관광객이 아닌 역할은 제한 없음(`buddy`).
- `GET /auth/me/plan` (AU-09) → `{plan: "free"|"buddy", ai_question_limit: 3|null, ai_questions_left_today: int|null, ai_questions_used_today: int}`.
- AI-02 `/ai/story`: `free`는 질문(`question` 있음)을 하루 `FREE_AI_QUESTIONS`=3번. 넘으면 **429 `AI_LIMIT`**. 장소 소개(질문 없음)는 세지 않음. StoryOut + `questions_left: int|null`. 하루 = `get_settings().today()`.
- `POST /tours/{id}/survey` (TR-05, tourist) body `{satisfaction 1~5, pain, want_buddy}` → 201 `{id, tour_id, satisfaction, pain, want_buddy, plan, created_at}`. pain 코드: ads · question_limit · route_fit · no_help · none (`rules.SURVEY_PAIN`, 프론트 `codes.SURVEY_PAIN`).
- DB: 새 표 `ai_usage`(id, user_id FK users, day DATE, questions SMALLINT, UNIQUE(user_id, day)), `course_surveys`(id, user_id FK, tour_id FK tours, satisfaction, pain VARCHAR(20), want_buddy, plan VARCHAR(10), created_at).
- 정직한 제한만: 길 안내를 틀리게 하지 않고, 코스 순서·데이터를 바꾸지 않고, 일부러 늦추지 않는다. 광고는 '광고'·'예시 광고' 표시, 5초 뒤 건너뛰기(이야기는 그동안 불러옴), 지어낸 가게만. 할인 금액 약속 없음.
- 화면(T08 · T08a 광고 · T08b 질문 한도 · T08c 완료 설문 · T08d 설문 뒤 제안 · T08e 도움 안내 · T09a 버디만): 업셀 버튼은 ②버디 목록(`/buddies?course=`)이 먼저, ①숙박 + 버디(`/stay`)는 보조 링크.
- 시드: 무료 데모 관광객 `noah@example.com`(예약 없음). 목업도 같은 규칙(`lib/mock`: `/auth/me/plan`, AI_LIMIT, `/tours/{id}/survey`).

## 14. v3.5 코스 걸리는 시간은 계산값 (Alembic `v3f_course_duration`, down_revision `v3e_ai_usage`)
- `tours.duration_min` 칸 삭제(tours.json에서도 뺌). 손으로 적던 값 대신 `services/courses.py`가 계산하고 TR-01·TR-02·AD-07이 같은 함수를 쓴다.
- 규칙(`app/core/rules.py` · 프론트 `lib/codes.ts`, 둘 다 **추정값**): `WALK_DETOUR_PERCENT` 130(직선 × 1.3), `WALK_M_PER_HOUR` 4000(4 km/h), `DURATION_STEP_MIN` 10.
- 구간(코스 순서 `tour_places.seq`의 이웃한 두 장소): 걷는 길 m = 직선 m(하버사인, 정수로 반올림) × 130 ÷ 100(`rules.pct`), `walk_m` = 10 m 단위 반올림, `walk_min` = 걷는 길 ÷ 4 km/h **올림**.
- 코스: `stay_min_total` = Σ 장소 `stay_min`(코스별 값 → 없으면 장소 기본값, `places[].stay_min`과 같다), `walk_m_total` = Σ `walk_m`, `walk_min_total` = Σ `walk_min`, `duration_min` = (stay + walk)를 10분 단위로 **올림**.
- 좌표가 없는(null·0) 장소가 끼면 그 구간은 `walk_m`·`walk_min` = null, 합계에서 빠지고 `walk_complete: false` → 화면 "걷는 시간 일부 빠짐".
- TourOut(TR-01 목록 항목·TR-02 상세) 추가: `stay_min_total, walk_m_total, walk_min_total, walk_complete, legs: [{from_place_id, to_place_id, walk_m, walk_min}]`(n−1개). `duration_min`은 그대로 있되 계산값.
- TourPlaceOut 추가: `photo_url, photo_credit`(없으면 null). `lat`·`lng`는 좌표가 없으면 null.
- AdminTourRow(AD-07) 추가: `walk_complete`. `duration_min`은 계산값.
- 화면: T07 코스 목록 C안(코스마다 제목 + 다른 언어 제목, 오른쪽 주황 "약 2시간 50분 · 4곳", 장소 줄 = 56px 사진(없으면 장소 id로 고른 따뜻한 색 블록) + "n. 이름" + 다른 언어 이름, 사진 사이 세로선 위에 "도보 7분 · 450m"), T08 장소 사이 같은 줄, 걸리는 시간 줄에 "머무는 … + 걷는 …분 · …m".
- 화면 연결도: `docs/v3/screen-flow.md`.

## 15. v3.6 앨범(사진 기록) 정산 · 사진 저장 (DB 변경 없음)
### 앨범 요금도 정산율로 나눈다 (팀 결정)
- 버디 몫 = `round((활동비 + 앨범) × 항목 정산율)`, 나머지는 플랫폼. 정산율은 그대로 예약 확정 때 항목에 고정(70 · 75 · 80%). 식사 보증금은 손대지 않음(통과 금액).
- 앨범 5,000원 → 버디 3,500 / 3,750 / 4,000, 플랫폼 1,500 / 1,250 / 1,000.
- 코드: `booking_state.payout_base(it)` = `activity_fee(it) + album_fee(it)`. `recompute_totals`(platform_fee) · `meals.gross_fee_net`(`/buddy/settlement`·`/buddy/earnings`) · AD-06이 모두 이 값을 쓴다. 프론트 `codes.payoutBase` · `platformFee(dorm, [{activity, rate, album}])`.
- `/buddy/settlement`: items[]·합계에 `album` 추가, `gross` = 활동비 + 앨범.
- AD-06: 버디 행 `revenue`에 앨범 포함 + `album`. `profit.cost_buddy`에 앨범 버디 몫 포함, `profit.cost_buddy_album` 추가. `sales_album`은 그대로(앨범 판매가).
- AD-01 대시보드 `platform_fee`는 숙박 수수료만이라 바뀐 것 없음.
- 시드(2027-01, DEMO_TODAY 2027-01-14): 지우 1월 = (120,000 + 앨범 5,000) × 75% = 93,750 + 승인 식비 18,000 = **111,750**. SB-2027-0112 `platform_fee` 19,250. AD-06 이익 **62,150**, 이익률 0.166.

### 사진 저장 `POST /uploads` (UP-01)
- 로그인한 사용자(여행자·버디·관리자) · multipart `file` 한 장 → **201** `{url: "/media/<yyyy>/<mm>/<uuid4 hex>.<ext>", content_type, size}`.
- JPEG · PNG · WebP만, **10 MB**까지. 종류는 확장자가 아니라 매직 바이트로 확인. 오류: 401 `UNAUTHORIZED` · 413 `FILE_TOO_LARGE` · 415 `UNSUPPORTED_TYPE` · 422 `EMPTY_FILE`.
- 저장: 설정 `upload_dir`(`UPLOAD_DIR`, 기본 `backend/uploads/`, 깃 제외) 아래 `<yyyy>/<mm>/<무작위>.<ext>`. 바꿀 자리는 `app/services/storage.py` 하나(save · path_for · exists).
- 보기: `GET /media/<yyyy>/<mm>/<이름>` — `/api/v1` 밖, **백엔드 주소 기준**. 이름 규칙(32자리 hex + jpg|png|webp)에 맞는 파일만, 폴더 목록 없음, `X-Content-Type-Options: nosniff`.
- 새로 받는 사진 값 검사: `POST /buddy/activities` `photos[]` · `POST /buddy/meal-claims` `receipt_url` · `POST /reports` `photo_url`은 우리 `/uploads`가 만든, 실제로 있는 `/media/...` 주소만 → 아니면 422 `PHOTO_URL`(외부 URL·파일 이름 거절). 저장된 예전 시드 값(파일 이름)은 그대로 두고, 화면은 `/media/`가 아니면 자리 표시 타일.
- 프론트: `lib/uploads.ts` `uploadPhoto(file)` · `mediaSrc(값)`(= `API_URL`에서 `/api/v1`을 뺀 백엔드 주소 + `/media/...`, 목업은 `blob:`) · `components/photo-upload.tsx` `usePhotoUploads` · `UploadThumb`. 목업 `/uploads`는 `URL.createObjectURL(file)`.
- **개인정보**: 사진은 주소(추측할 수 없는 이름)를 아는 사람은 누구나 볼 수 있다. 데모용이다. 운영 전에는 비공개 객체 저장소 + 서명 URL(짧은 유효 시간) + 보관 기간(예: 여행 끝나고 N일 뒤 삭제)으로 바꾼다. 버디 활동 기록 화면에 "여행자가 찍어도 된다고 한 사진만 올려 주세요. 다른 사람 얼굴은 피해 주세요."

## 16. v3.7 버디 자격 두 경로 · 사전 교육 영상 (Alembic `v3g_monthly_grade`, §12와 같은 파일)
- **자격**: 대학생 + (a) 성북구 대학에 다님 **또는** (b) 성북구에 삶(어느 대학이든) + 대한민국 국적 + 만 19세 + 약속 7개 + 사전 교육(영상 5개 → 퀴즈 10문제 중 8). 버디는 유료 역사 해설을 하지 않는다(약속·퀴즈 q3·영상 그대로).
- DB `buddy_profiles` + `eligibility VARCHAR(20)`(school_email | residence), `school_name VARCHAR(100)`, `residence_proof_url VARCHAR(500)`, `enrollment_proof_url VARCHAR(500)`, `residence_submitted_at TIMESTAMPTZ`, `education_watched JSON`(본 영상 id). `university_id` NULL 허용(성북구 밖 대학의 거주 경로 버디). 화면의 대학 이름 = 대학 표 이름 → 없으면 `school_name`(`services/eligibility.university_name`).
- 지원 6단계 `/buddy/apply/*` ([BD-09](../api-detail/BD-09.md)):
  1. 자격 확인 — 대학 메일: `POST /apply/email` · `POST /apply/verify`(그대로, `eligibility=school_email`). 거주: `POST /apply/residence {school_name, residence_proof_url, enrollment_proof_url, birth_date, korean_national}` — 사진은 `/uploads`의 `/media/...`만(아니면 422 `PHOTO_URL`), 422 `TOO_YOUNG`·`NOT_KOREAN_NATIONAL`. 학교 이름이 성북구 대학과 같으면 그 `university_id`.
  2. 약속 `POST /apply/agree` (자격 확인 전이면 409)
  3. 교육 영상 `GET /apply/education` → `{videos:[{id, title, topics, duration_sec, video_url:null, watched}], watched, total:5, done}` · `POST /apply/education/{id}` 다 봤어요 (없는 id 404, 자격 확인 전 409). 영상 = `rules.EDUCATION_VIDEOS`: seongbuk_overview · getting_around · safety · history_basics · promises. 데모는 영상 파일 없음("영상 준비 중").
  4. 퀴즈 `GET/POST /apply/quiz` — 영상을 다 보기 전 409 `EDUCATION_NOT_DONE`. 문제 13개(q11 지하철 · q12 응급 · q13 한양도성 기본 상식 추가) 중 10개: 늘 q2·q3·q8 + 지원자 id로 정한 7개(다시 풀어도 같음). 낸 10문제만 채점.
  5. 프로필 `PUT /buddy/profile`  6. 운영팀 승인
- `GET /buddy/apply` + `eligibility, eligible, school_name, residence_proof_url, enrollment_proof_url, videos_watched[], videos_total, education_done`.
- 승인 AD-04 (`services/eligibility.missing_for_approval`) → 409 `NOT_READY` + 빠진 항목: 거주 경로면 "성북구 주소 증빙"·"재학 증명"(운영자 승인이 곧 서류 확인), 아니면 메일 인증이 없을 때 "자격 확인(성북구 대학 메일 또는 성북구 거주)", "한국 국적 확인", "만 19세 확인", "버디 약속 동의", "교육 영상 n/5", "교육 퀴즈 8점 이상".
- AdminBuddyRow + `university, eligibility, school_name, residence_proof_url, enrollment_proof_url, videos_watched, videos_total`. A03 대기 표 '자격 경로'(대학 메일 / 성북구 거주 + 서류 썸네일 두 장, `/media/`가 아니면 자리 표시) · '교육 영상' 열.
- BuddyOut `verified` + `residence`. 매칭(AI-01·03)의 같은 학교 우선은 `university_id`가 같을 때만 → 성북구 밖 대학 거주 버디도 추천되지만 가산점 없음.
- 시드: 가은(id 38, gaeun@example.com) — 서울시립대 · 성북구 거주 · 승인 대기, 서류 값은 자리 표시(`residence_proof_gaeun.jpg`·`enrollment_gaeun.jpg`), 영상 5 · 퀴즈 9 → 승인 가능.

