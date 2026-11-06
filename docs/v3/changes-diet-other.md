# 버디 요청 '기타' 직접 입력 (BK-01)

T18 "○○에게 미리 알려 주세요"에서 먹지 않는 것·알레르기 칩에 없는 것을 직접 적는다.

## 화면
- **T18** (`(tourist)/buddies/[id]/request`): '먹지 않는 것'·'알레르기' 칩 끝에 **기타**. 누르면 그 묶음 아래 한 줄 입력이 열리고(예: "예: 고수, 참깨" / "예: 복숭아"), 다시 누르면 닫히며 지운다. 40자까지, 줄바꿈은 공백으로.
- 장바구니에 담을 때(T18 옵션 단계) 앞뒤 공백을 지우고 비었으면 빼고 담는다(`cleanOther`, `lib/codes.ts`).
- 보이는 곳: 요청 칩 `requestChips`(`lib/codes.ts`)가 "기타: 고수"·"복숭아 알레르기"를 붙인다 → 장바구니·주문 확인·버디 바꾸기·버디 목록 요약, 버디 요청 카드(B02 홈·B03 요청함, `components/buddy/request-card.tsx`). 관리자 식비 심사 상세 '요청 사항'과 AI-04 동행 준비 자료는 서버 요약(`rules.request_summary`)으로.
- 매칭(AI-03)·도움 매핑(`DIET_TO_HELP`)은 '기타'를 쓰지 않는다.

## API · 백엔드
- 버디 항목 `request`에 `diet_other?`·`allergy_other?` (문자열, ≤40자). `booking_state.clean_request` → `clean_other`: 앞뒤 공백 제거, 제어 문자·41자 이상·글자 아님은 422 `VALIDATION`, 비었으면 키 없음. 예전 요청(키 없음)은 그대로 통과·저장.
- `rules.request_summary`: "비건, 기타: 고수, 버섯 알레르기, 복숭아 알레르기, 천천히".
- AI-04: 대체 문구 첫 문장과 LLM 자료(`Traveler requests:`)에 같은 요약. LLM 지시문에 '기타'도 다시 말하라고 추가.
- DB·마이그레이션 변경 없음 (`booking_items.request` JSON 그대로). 돈 계산 변경 없음.

## 목업
- `lib/mock/index.ts` `validateBuddyRequest`가 같은 규칙으로 받고 돌려준다. 목업 AI-04·관리자 식비 요약도 `requestChips`로 같은 순서.

## 테스트
- `tests/test_bookings.py`: 41자·줄바꿈·숫자·배열 → 422, 공백 정리·빈 값 빼기, `request_summary` 순서.
- `tests/test_ai_brief_notice.py`: LLM 없이(대체 문구) 첫 문장에 기타가 들어가고, LLM 자료에도 들어간다.
