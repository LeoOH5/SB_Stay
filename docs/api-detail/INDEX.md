# API 상세 명세 목록 (성북스테이)

총 54개 엔드포인트. 공통 규칙은 [../api-spec.md](../api-spec.md) 참고.

## 인증 (Auth)

- [AU-01](AU-01.md) `POST /auth/google` — 구글 로그인 (필수 / 구현)
- [AU-02](AU-02.md) `POST /auth/signup` — 회원가입 (필수 / 구현(단순화))
- [AU-03](AU-03.md) `GET /auth/me` — 내 정보 조회 (필수 / 구현)
- [AU-04](AU-04.md) `PATCH /users/me` — 언어·통화 설정 / 프로필 수정 (필수 / 구현(언어만))
- [AU-05](AU-05.md) `POST /auth/login` — 이메일 로그인, 데모 계정 전용 (필수 / 구현)
- [AU-06](AU-06.md) `PATCH /users/me/role` — 역할 선택, 첫 로그인 (필수 / 구현)
- [AU-07](AU-07.md) `POST /auth/google/calendar` — 구글 캘린더 연동 (권장 / 구현)
- [AU-08](AU-08.md) `DELETE /auth/google/calendar` — 구글 캘린더 연동 해제 (권장 / 구현)
- [AU-09](AU-09.md) `GET /auth/me/plan` — 내 이용 방식 무료/버디, 오늘 남은 AI 질문 (v3.4, 필수 / 구현)

## 홈 (Home)

- [HM-01](HM-01.md) `GET /packages` — 추천 패키지 조회 (필수 / 구현)

## 숙박 (Dorms)

- [DM-01](DM-01.md) `GET /universities` — 대학 목록 조회 (필수 / 구현)
- [DM-02](DM-02.md) `GET /dorms` — 객실 목록 조회 (필수 / 구현)
- [DM-03](DM-03.md) `GET /dorms/{id}` — 객실 상세 조회 (필수 / 구현)
- [DM-04](DM-04.md) `POST /admin/dorms` — 객실 등록 (필수 / 구현)
- [DM-05](DM-05.md) `PATCH /admin/dorms/{id}` — 객실 수정 (필수 / 구현)
- [DM-06](DM-06.md) `PATCH /admin/universities/{id}` — 개방 기간 수정 (필수 / 구현)

## 투어 (Tours)

- [TR-01](TR-01.md) `GET /tours` — 투어 코스 목록 조회 (필수 / 구현)
- [TR-02](TR-02.md) `GET /tours/{id}` — 투어 코스 상세 조회 (필수 / 구현)
- [TR-03](TR-03.md) `GET /places/{id}` — 장소 상세 조회 (필수 / 구현)
- [TR-04](TR-04.md) `GET /tours/{id}/reviews` — 투어 리뷰 조회 (권장 / 목업)
- [TR-05](TR-05.md) `POST /tours/{id}/survey` — 무료 코스 완료 설문 (v3.4, 권장 / 구현)

## 버디 (Buddies)

- [BD-01](BD-01.md) `GET /buddies` — 버디 목록 조회 (필수 / 구현)
- [BD-02](BD-02.md) `GET /buddies/{id}` — 버디 상세 조회 (필수 / 구현)
- [BD-03](BD-03.md) `PUT /buddy/profile` — 버디 프로필 등록·수정 (필수 / 구현)
- [BD-04](BD-04.md) `PUT /buddy/availability` — 버디 가능 일정 등록 (필수 / 구현)
- [BD-05](BD-05.md) `GET /buddy/requests` — 버디 요청함 조회 (필수 / 구현)
- [BD-06](BD-06.md) `GET /buddy/schedule` — 버디 확정 일정 조회 (필수 / 구현)
- [BD-07](BD-07.md) `GET /buddy/earnings` — 버디 활동 내역·정산 조회 (권장 / 목업)

## AI

- [AI-01](AI-01.md) `POST /ai/plan` — AI 여행 설계 (필수 / 구현)
- [AI-02](AI-02.md) `POST /ai/story` — AI 역사 스토리 (RAG) (필수 / 구현)
- [AI-03](AI-03.md) `POST /ai/buddy-match` — AI 버디 매칭 (필수 / 구현)
- [AI-04](AI-04.md) `POST /ai/buddy-brief` — AI 동행 준비 자료 (선택 / 선택)
- [AI-05](AI-05.md) `POST /ai/translate-notice` — AI 다국어 안내문 초안 (선택 / 제외)

## 예약 (Bookings)

- [BK-01](BK-01.md) `POST /bookings` — 통합 예약 신청 (필수 / 구현)
- [BK-02](BK-02.md) `GET /bookings/me` — 내 예약 목록 조회 (필수 / 구현)
- [BK-03](BK-03.md) `GET /bookings/{id}` — 예약 상세 조회 (필수 / 구현)
- [BK-04](BK-04.md) `PATCH /bookings/{id}/items/{itemId}` — 예약 항목 승인·거절 (필수 / 구현)
- [BK-05](BK-05.md) `POST /bookings/{id}/cancel` — 예약 취소 (필수 / 구현)
- [BK-06](BK-06.md) `POST /bookings/{id}/pay` — 결제 (필수 / 목업)
- [BK-07](BK-07.md) `GET /bookings/{id}/checkin-guide` — 체크인 안내 조회 (필수 / 목업)
- [BK-08](BK-08.md) `POST /bookings/{id}/reviews` — 리뷰 작성 (권장 / 목업)
- [BK-09](BK-09.md) `GET /bookings/{id}/chat` — 버디 채팅 (필수 / 목업)
- [BK-10](BK-10.md) `GET /notifications` — 알림 목록 조회 (권장 / 목업)

## 어드민 (Admin)

- [AD-01](AD-01.md) `GET /admin/dashboard` — 어드민 대시보드 (필수 / 구현)
- [AD-02](AD-02.md) `GET /admin/bookings` — 어드민 예약 목록 조회 (필수 / 구현)
- [AD-03](AD-03.md) `GET /admin/buddies` — 소속 버디 목록 조회 (필수 / 구현)
- [AD-04](AD-04.md) `PATCH /admin/buddies/{id}` — 버디 승인·제재 (필수 / 부분 구현)
- [AD-05](AD-05.md) `GET /admin/users` — 회원 목록 조회 (권장 / 목업)
- [AD-06](AD-06.md) `GET /admin/settlements` — 정산 내역 조회 (권장 / 목업)
- [AD-07](AD-07.md) `GET /admin/tours` — 투어 코스 관리 (권장 / 시드 대체)
- [AD-08](AD-08.md) `GET /admin/export/foreign-guests` — 외국인 숙박신고 내보내기 (권장 / 제외)
- [AD-09](AD-09.md) `PUT /admin/contents/{key}` — 콘텐츠 관리 (다국어) (권장 / 제외)
- [AD-10](AD-10.md) `PATCH /admin/settings` — 어드민 설정 (선택 / 제외)

## 공통 (Common)

- [CM-01](CM-01.md) `GET /contents/{key}` — 약관·환불 규정·고객센터 조회 (권장 / 목업)
