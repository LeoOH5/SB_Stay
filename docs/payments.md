# 결제 (토스페이먼츠 + PayPal)

국내 카드·간편결제는 토스페이먼츠, 외국인(해외 카드·PayPal 계정)은 PayPal로 받습니다. 결제 화면에서 둘 중 하나를 고르고, 영어 사용자는 PayPal이 먼저 선택됩니다.

## 키 넣기
토스페이먼츠 개발자센터 > API 키 > **결제위젯 연동 키**를 씁니다. API 개별 연동 키(`test_ck` / `test_sk`)와 섞으면 `INVALID_API_KEY`가 납니다.

| 파일 | 변수 | 값 |
|---|---|---|
| `backend/.env` | `TOSS_SECRET_KEY` | `test_gsk_...` (서버에만, 절대 프론트에 넣지 않음) |
| `frontend/.env.local` | `NEXT_PUBLIC_TOSS_CLIENT_KEY` | `test_gck_...` |
| `frontend/.env.local` | `NEXT_PUBLIC_USE_MOCK` | `false` (실제 백엔드에 붙여야 결제창이 뜸) |
| `backend/.env` | `PAYPAL_CLIENT_ID` · `PAYPAL_CLIENT_SECRET` | developer.paypal.com > Apps & Credentials > **Sandbox** 앱의 Client ID · Secret |
| `backend/.env` | `PAYPAL_API_BASE` | 테스트 `https://api-m.sandbox.paypal.com` (운영은 `https://api-m.paypal.com`) |
| `backend/.env` | `USD_KRW_RATE` | 원→달러 고정 환율, 기본 1400 |
| `frontend/.env.local` | `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | 백엔드와 같은 Client ID |

토스 키만 넣으면 토스만, PayPal 키만 넣으면 PayPal만 보입니다. 모두 비어 있으면 예전처럼 예약 즉시 결제 완료(목업)로 동작합니다. 키를 바꾼 뒤에는 백엔드와 프론트 개발 서버를 다시 켭니다.

## 흐름
1. 여행자 정보 입력 → `POST /bookings` 로 예약 생성 (장바구니 비움)
2. `/pay?booking=id` → `POST /payments/prepare` 가 주문번호와 금액을 정함 (금액은 서버의 예약 금액)
3. 토스 결제위젯에서 결제수단 선택 → 결제
4. 성공하면 `/pay/success?paymentKey&orderId&amount` → `POST /payments/confirm` → 서버가 금액을 다시 확인하고 토스 승인 API 호출 → 예약 `paid_at` 기록, 알림
5. 실패·취소하면 `/pay/fail` → 예약은 남아 있고 내 여행에서 다시 결제

## PayPal 흐름 (외국인)
1. 결제 화면에서 "Overseas card · PayPal" 선택 → PayPal 버튼과 카드 결제 버튼이 나옴
2. 버튼을 누르면 `POST /payments/paypal/orders` 가 예약 원화 금액을 고정 환율로 달러 환산해 PayPal 주문 생성 (센트 단위 올림)
3. 구매자가 PayPal 로그인 또는 카드 정보로 승인 → `POST /payments/paypal/capture` → 캡처된 금액·통화가 주문과 같을 때만 결제 완료
4. 테스트는 PayPal 개발자 대시보드의 Sandbox 구매자 계정(Personal)으로 로그인하거나, 카드 버튼에 PayPal이 안내하는 테스트 카드 번호를 씁니다.

## 취소·환불
`POST /bookings/{id}/cancel` 이 첫 일정 기준 환불 규정대로 토스 취소 API를 부릅니다.

| 첫 일정까지 | 환불 |
|---|---|
| 7일 이상 | 100% (전액 취소) |
| 3~6일 | 50% (부분 취소) |
| 2일 이하 | 0% |

PayPal 결제는 같은 비율을 달러로 환불합니다 (부분 환불은 센트 단위 내림). 환불 요청이 실패하면 예약도 취소하지 않고 오류를 돌려줍니다.

## 확인 포인트
- 테스트 키 결제는 실제로 돈이 빠져나가지 않습니다. 가상계좌는 문서용 공용 키로는 테스트되지 않으니 본인 상점 테스트 키를 씁니다.
- 결제 기록은 `payments` 테이블 (`alembic upgrade head` 필요).
- 영수증 링크는 내 여행 > 영수증에서 열립니다.
