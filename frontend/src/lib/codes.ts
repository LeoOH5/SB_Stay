// v3 코드값 라벨 + 숫자 규칙 — docs/v3/CONTRACT.md §1·§3
// 화면은 ko/en 라벨을 고르고, API 에는 key 만 보낸다.
import type {
  Allergy, CanHelp, Diet, DormRequestKey, Pace, Personality, ReportCategory, ReviewTag, SubScoreKey, WalkStyle,
} from "./types";

// ---- 숫자 규칙 (§1)
export const PLATFORM_FEE_RATE = 0.1;
/** 식사 1회 한도 (2인). 보증금 = 횟수 × MEAL_LIMIT */
export const MEAL_LIMIT = 20000;
/** 버디 항목 1개당 식사 최대 횟수 */
export const MEAL_MAX = 4;
/** 여행 앨범 옵션 */
export const ALBUM_FEE = 5000;
/** 신고(기각 제외) 누적 시 자동 정지 */
export const REPORT_SUSPEND_AT = 2;
export const QUIZ_PASS = 8;
export const QUIZ_TOTAL = 10;
export const BUDDY_MIN_AGE = 19;
/** 버디 약속 (B07 지원 2단계). 동의는 한 번에 받고(POST /buddy/apply/agree), 개수는 화면 표시용(A03 n/n) */
export const BUDDY_PROMISES = [
  "역사 해설은 하지 않아요. 이야기는 앱의 AI가 들려주고, 나는 친구로 같이 걸어요",
  "앱 밖에서 돈이나 선물을 받지 않아요",
  "예약된 날짜·시간·장소에서만 만나요",
  "술을 권하지 않고, 늦은 밤 동행은 하지 않아요",
  "여행자를 내 차에 태우지 않아요 (유상 운송 금지)",
  "여행자의 요청 사항(음식, 알레르기)을 꼭 확인해요",
  "문제가 생기면 바로 앱에서 운영팀에 알려요",
] as const;
/** 버디 요청: 더 보고 싶은 곳 최대 개수, 메모 최대 길이 */
export const REQUEST_PLACES_MAX = 3;
export const REQUEST_NOTE_MAX = 300;

/** 버디 항목 가격 = hourly_fee × 시간 + (album ? 5000 : 0) + meal_count × 20000 */
export function buddyItemPrice(hourlyFee: number, durationMin: number, mealCount = 0, album = false): number {
  return Math.round(hourlyFee * (durationMin / 60)) + (album ? ALBUM_FEE : 0) + mealCount * MEAL_LIMIT;
}
/** 플랫폼 수수료 = round((총액 − 식비 보증금 합) × 0.10) */
/** 수수료 = (숙박 + 버디 활동비) × 10% + 앨범 요금 전액(플랫폼 수입). 식사 보증금에는 수수료 없음 */
export function platformFee(total: number, mealDeposit: number, albumFees = 0): number {
  return Math.round((total - mealDeposit - albumFees) * PLATFORM_FEE_RATE) + albumFees;
}

// ---- 라벨 (§3)
export interface CodeLabel { ko: string; en: string }
type Labels<K extends string> = Record<K, CodeLabel>;

export const DIET: Labels<Diet> = {
  vegan: { ko: "비건", en: "Vegan" },
  vegetarian: { ko: "채식", en: "Vegetarian" },
  halal: { ko: "할랄", en: "Halal" },
  no_pork: { ko: "돼지고기 X", en: "No pork" },
  no_beef: { ko: "소고기 X", en: "No beef" },
  no_alcohol: { ko: "술 X", en: "No alcohol" },
};
export const ALLERGIES: Labels<Allergy> = {
  mushroom: { ko: "버섯", en: "Mushroom" },
  nuts: { ko: "견과류", en: "Nuts" },
  seafood: { ko: "해산물", en: "Seafood" },
  dairy: { ko: "유제품", en: "Dairy" },
  egg: { ko: "달걀", en: "Egg" },
  gluten: { ko: "밀", en: "Wheat / gluten" },
};
export const PACE: Labels<Pace> = {
  slow: { ko: "천천히", en: "Slow" },
  normal: { ko: "보통", en: "Normal" },
};
export const DORM_REQUEST: Labels<DormRequestKey> = {
  late_checkin: { ko: "늦은 체크인", en: "Late check-in" },
  quiet_room: { ko: "조용한 방", en: "Quiet room" },
  low_floor: { ko: "낮은 층", en: "Low floor" },
};
export const PERSONALITY: Labels<Personality> = {
  calm: { ko: "차분해요", en: "Calm" },
  lively: { ko: "활발해요", en: "Lively" },
  listener: { ko: "잘 들어줘요", en: "Good listener" },
  humor: { ko: "유머 있어요", en: "Funny" },
};
export const STYLE: Labels<WalkStyle> = {
  slow_walk: { ko: "천천히 걸어요", en: "Walks slowly" },
  explore: { ko: "많이 돌아봐요", en: "Explores a lot" },
  cafe_break: { ko: "카페에서 쉬어 가요", en: "Takes café breaks" },
  photo_walk: { ko: "사진 위주", en: "Photo walks" },
};
export const CAN_HELP: Labels<CanHelp> = {
  vegan_food: { ko: "비건 식당 안내", en: "Vegan restaurants" },
  halal_food: { ko: "할랄 식당 안내", en: "Halal restaurants" },
  photo: { ko: "사진 찍어 주기", en: "Takes your photos" },
  subway: { ko: "지하철 타는 법", en: "Subway help" },
  shopping: { ko: "쇼핑", en: "Shopping" },
};
export const SUB_SCORES: Labels<SubScoreKey> = {
  kind: { ko: "친절해요", en: "Kind" },
  talk: { ko: "소통", en: "Communication" },
  punctual: { ko: "시간 약속", en: "Punctual" },
  local: { ko: "동네 추천", en: "Local tips" },
};
export const REVIEW_TAGS: Labels<ReviewTag> = {
  fun_talk: { ko: "대화가 즐거워요", en: "Fun to talk with" },
  knows_food: { ko: "맛집을 잘 알아요", en: "Knows good food" },
  good_photos: { ko: "사진을 잘 찍어 줘요", en: "Great photos" },
  cares_requests: { ko: "요청을 잘 챙겨요", en: "Cared about my requests" },
  easy_guide: { ko: "길 안내가 편해요", en: "Easy to follow" },
};
export const REPORT_CATEGORY: Labels<ReportCategory> = {
  no_show: { ko: "약속 장소에 오지 않았어요", en: "Didn't show up" },
  rude: { ko: "불편한 말이나 행동", en: "Rude words or behavior" },
  money: { ko: "돈이나 선물 요구", en: "Asked for money or gifts" },
  unsafe: { ko: "안전이 걱정돼요", en: "I felt unsafe" },
  other: { ko: "기타", en: "Other" },
};

/** 요청 → 도움 매핑 (매칭용): vegan/vegetarian → vegan_food, halal → halal_food */
export const DIET_TO_HELP: Partial<Record<Diet, CanHelp>> = { vegan: "vegan_food", vegetarian: "vegan_food", halal: "halal_food" };

/** 라벨 객체의 key 순서 목록 (칩 렌더링용) */
export const keysOf = <K extends string>(labels: Labels<K>): K[] => Object.keys(labels) as K[];

/** 코드 → 라벨 (모르는 코드는 그대로) */
export function label<K extends string>(labels: Labels<K>, key: K | string, lang: "ko" | "en" = "ko"): string {
  return (labels as Record<string, CodeLabel>)[key]?.[lang] ?? key;
}
export function labels<K extends string>(labels_: Labels<K>, keys: readonly (K | string)[] | null | undefined, lang: "ko" | "en" = "ko"): string[] {
  return (keys ?? []).map((k) => label(labels_, k, lang));
}

/** 버디 요청 요약 칩: 식단 → 알레르기("버섯 알레르기") → 속도 */
export function requestChips(r: { diet?: readonly string[]; allergies?: readonly string[]; pace?: string } | null | undefined, lang: "ko" | "en" = "ko"): string[] {
  if (!r) return [];
  const out = labels(DIET, r.diet, lang);
  out.push(...labels(ALLERGIES, r.allergies, lang).map((a) => (lang === "ko" ? `${a} 알레르기` : `${a} allergy`)));
  if (r.pace === "slow") out.push(label(PACE, "slow", lang));
  return out;
}
