# 데모 계정

시드(`python -m app.seeds`)로 생성되는 계정입니다. 비밀번호는 모두 `demo1234`.

| 역할 | 이메일 | 로그인 화면 | 로그인 후 |
|---|---|---|---|
| 관광객 | emma@example.com | `/login` | `/home` |
| 관광객 | yuki@example.com | `/login` | `/home` |
| 버디 | jiwoo@a-univ.ac.kr | `/buddy/login` 또는 `/login` | `/buddy` |
| 버디 | minho@b-univ.ac.kr | `/buddy/login` | `/buddy` |
| 해설사 | guide.park@example.com | `/buddy/login` | `/buddy` |
| 대학 담당자 (A대학교) | admin@a-univ.ac.kr | `/login` | `/admin` |
| 운영자 | operator@sbstay.app | `/login` | `/admin` |

그 밖의 버디(하린·도윤·서연·준서)와 해설사(김해설·이해설) 계정은 `backend/app/seeds/data/users.json` 참고.

## 데모 순서
1. Emma로 로그인 → 홈 "AI로 여행 설계하기" → 추천 일정 → 모두 장바구니에 담기 → 여행자 정보 → 예약 신청
2. 대학 담당자로 로그인 → 대시보드에서 숙박 승인
3. 지우로 로그인 → 홈에서 Emma 동행 요청 수락
4. Emma로 다시 로그인 → 내 여행에서 세 항목 모두 확정 확인

## 구글 로그인
구글 콘솔 테스트 모드라 테스트 사용자로 등록된 구글 계정만 로그인됩니다. 등록 방법은 `backend/README.md`.
