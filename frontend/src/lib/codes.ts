// v3 코드값 라벨 + 숫자 규칙 — docs/v3/CONTRACT.md §1·§3
// 화면은 ko/en 라벨을 고르고, API 에는 key 만 보낸다.
import type {
  Allergy, BuddyGrade, CanHelp, CourseLeg, Diet, DormRequestKey, Eligibility, Pace, Personality, ReportCategory, ReviewTag, RouteSource, SubScoreKey, SurveyPain, WalkStyle,
} from "./types";

// ---- 숫자 규칙 (§1)
/** 숙박 수수료율 (대학 90% · 플랫폼 10%). 버디 활동비는 등급 정산율(GRADE_RULES)을 쓴다 */
export const PLATFORM_FEE_RATE = 0.1;
/** 식사 1회 한도 (2인). 보증금 = 횟수 × MEAL_LIMIT */
export const MEAL_LIMIT = 20000;
/** 버디 항목 1개당 식사 최대 횟수 */
export const MEAL_MAX = 4;
/** 여행 앨범(사진 기록) 옵션. v3.6: 활동비처럼 버디 정산율로 나눈다 */
export const ALBUM_FEE = 5000;
/** 신고(기각 제외) 누적 시 자동 정지 */
export const REPORT_SUSPEND_AT = 2;
export const QUIZ_PASS = 8;
export const QUIZ_TOTAL = 10;
export const BUDDY_MIN_AGE = 19;
/** 버디 지원 자격 (B01 로그인 · B06 지원 1단계) — 외국인 유학생은 시간제 취업 허가 문제로 지원 불가.
 *  v3.7: 성북구 대학에 다니거나, 성북구에 사는 대학생(어느 대학이든) */
export const BUDDY_ELIGIBILITY = "성북구 대학 재학생 또는 성북구에 사는 대학생, 대한민국 국적, 만 19세 이상";
/** 자격 경로 라벨 (A03 '자격 경로') */
export const ELIGIBILITY: Record<Eligibility, { ko: string; en: string }> = {
  school_email: { ko: "대학 메일", en: "University email" },
  residence: { ko: "성북구 거주", en: "Seongbuk resident" },
};
export const KOREAN_NATIONAL_NOTE = "외국인 유학생은 시간제 취업 허가 문제로 지원할 수 없어요";
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
/** 정산율을 곱하는 금액 = 활동비 + 앨범 (v3.6). 식사 보증금은 통과 금액이라 뺀다 */
export const payoutBase = (activity: number, album = false) => activity + (album ? ALBUM_FEE : 0);
/** 수수료 = 숙박 × 10% + Σ (활동비 + 앨범) × (1 − 버디 정산율). 식사 보증금에는 수수료 없음 (v3.6: 앨범도 정산율로 나눈다) */
export function platformFee(dormTotal: number, buddyItems: { activity: number; rate: number; album?: boolean }[]): number {
  return Math.round(dormTotal * PLATFORM_FEE_RATE) + buddyItems.reduce((s, b) => { const base = payoutBase(b.activity, b.album); return s + base - buddyNet(base, b.rate); }, 0);
}

// ---- 버디 등급·정산율 (backend app/core/rules.py 와 같음) — v3.7 매달 1일, 지난달 동행으로 평가
/** 등급 기준 (높은 등급부터). walks = 지난달 완료 동행(누적 아님), reviews·rating = 누적. 예약 확정 때 정산율 고정 */
export const GRADE_RULES: { grade: BuddyGrade; rating: number; walks: number; reviews: number; rate: number }[] = [
  { grade: "top", rating: 4.5, walks: 7, reviews: 5, rate: 0.8 },
  { grade: "growth", rating: 4.3, walks: 4, reviews: 3, rate: 0.75 },
  { grade: "basic", rating: 0, walks: 0, reviews: 0, rate: 0.7 },
];
export const BASE_PAYOUT_RATE = 0.7;
export const GRADE_NOTE = "등급은 매달 1일, 지난달 동행으로 다시 정해요. 올라갈 때는 한 단계씩, 내려갈 때는 조건에 맞는 등급으로 바로 가요.";
/** 운영 기간 중 이만큼 활동이 없으면 휴면 (요청 받기 멈춤, 등급과는 상관없음) */
export const DORMANT_DAYS = 30;
/** 버디 몫 = round((활동비 + 앨범) × 정산율) — 금액은 payoutBase() */
export const buddyNet = (activity: number, rate: number) => Math.round(activity * rate);
/** 지금 등급 + 지난달 실적 → 새 등급 (backend grades.decide). 첫 달은 기본, 오를 때 한 단계씩, 내릴 때 바로 */
export function decideGrade(current: BuddyGrade, firstMonth: boolean, walks: number, reviews: number, rating: number | null): BuddyGrade {
  if (firstMonth) return "basic";
  const meets = (g: BuddyGrade) => { const r = GRADE_RULES.find((x) => x.grade === g)!; return walks >= r.walks && reviews >= r.reviews && rating != null && rating >= r.rating; };
  if (current !== "basic" && meets("top")) return "top";
  return meets("growth") ? "growth" : "basic";
}
export const rateOf = (grade: BuddyGrade) => GRADE_RULES.find((g) => g.grade === grade)?.rate ?? BASE_PAYOUT_RATE;
/** 0.75 → "75%" */
export const pct = (rate: number) => `${Math.round(rate * 100)}%`;

// ---- 라벨 (§3)
export interface CodeLabel { ko: string; en: string }
type Labels<K extends string> = Record<K, CodeLabel>;

export const GRADE: Labels<BuddyGrade> = {
  basic: { ko: "기본", en: "Basic" },
  growth: { ko: "성장", en: "Rising" },
  top: { ko: "우수", en: "Top" },
};

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

// ---- v3.4 무료 AI 산책 코스 (backend app/core/rules.py 와 같게)
/** 무료 이용자가 하루에 AI에게 할 수 있는 질문 수 (장소 소개는 세지 않음) */
export const FREE_AI_QUESTIONS = 3;
/** 광고 화면 기다리는 시간(초). 이야기는 그동안 이미 불러온다 — 일부러 늦추는 대기는 없다 */
export const AD_SECONDS = 5;
export const SURVEY_PAIN: Labels<SurveyPain> = {
  ads: { ko: "광고가 귀찮았어요", en: "The ads" },
  question_limit: { ko: "질문 3번이 모자랐어요", en: "Only 3 questions a day" },
  route_fit: { ko: "동선이 내 숙소·시간과 안 맞았어요", en: "The route didn't fit my stay or time" },
  no_help: { ko: "길을 잃었을 때 물어볼 사람이 없었어요", en: "No one to ask when I was lost" },
  none: { ko: "딱히 없었어요", en: "Nothing really" },
};
/** 무료 코스 광고 자리 — 모두 지어낸 예시 광고(실제 가게·행사 아님) */
export const SAMPLE_ADS: { title: string; body: string; place: string }[] = [
  { title: "골목 끝 찻집 '한모금'", body: "대추차 한 잔에 쑥떡 하나를 같이 드려요. 산책하다 쉬어 가세요.", place: "성북동 골목 · 예시 광고" },
  { title: "겨울 한옥 손뜨개 모임", body: "토요일 오후, 한옥 마루에서 목도리를 같이 떠요. 처음이어도 괜찮아요.", place: "성북동 한옥 · 예시 광고" },
  { title: "성곽길 아래 빵집 '돌담제과'", body: "아침 8시에 갓 구운 단팥빵이 나와요. 코스 출발 전에 들러 보세요.", place: "성곽길 입구 · 예시 광고" },
];

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

// ---- v3.5 코스 걷는 시간 (백엔드 app/services/courses.py 와 같은 계산). 1.3·4 km/h 는 추정값
/** 직선거리 × 130% = 실제 걷는 길 (골목·언덕을 돌아가는 몫, 추정) */
export const WALK_DETOUR_PERCENT = 130;
/** 걷는 속도 4 km/h (추정) */
export const WALK_M_PER_HOUR = 4000;
/** 코스 전체 시간은 10분 단위로 올린다 */
export const DURATION_STEP_MIN = 10;
type XY = { id: number; lat: number | null; lng: number | null; stay_min: number };
/** 두 좌표 사이 직선거리(m, 하버사인) */
export function straightM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = Math.PI / 180, p1 = lat1 * r, p2 = lat2 * r, dp = p2 - p1, dl = (lng2 - lng1) * r;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}
/** 순서대로 놓인 장소 → 구간(walk_m 10 m 반올림, walk_min 올림)과 합계. 좌표가 없으면 그 구간은 null.
 *  v3.8 목업에는 저장한 실제 경로가 없어 모든 구간이 추정(source "estimate", route_source "estimate") */
export function courseTimes(stops: XY[]): {
  stay_min_total: number; walk_m_total: number; walk_min_total: number; duration_min: number; walk_complete: boolean;
  route_source: RouteSource; legs: CourseLeg[];
} {
  const legs: CourseLeg[] = stops.slice(1).map((b, i) => {
    const a = stops[i];
    if (!a.lat || !a.lng || !b.lat || !b.lng) return { from_place_id: a.id, to_place_id: b.id, walk_m: null, walk_min: null, source: null, path: null };
    const route = Math.floor((Math.round(straightM(a.lat, a.lng, b.lat, b.lng)) * WALK_DETOUR_PERCENT + 50) / 100);
    return { from_place_id: a.id, to_place_id: b.id, walk_m: Math.floor((route + 5) / 10) * 10, walk_min: Math.ceil((route * 60) / WALK_M_PER_HOUR), source: "estimate", path: null };
  });
  const stay = stops.reduce((s, p) => s + p.stay_min, 0);
  const walkMin = legs.reduce((s, l) => s + (l.walk_min ?? 0), 0);
  return {
    stay_min_total: stay, walk_m_total: legs.reduce((s, l) => s + (l.walk_m ?? 0), 0), walk_min_total: walkMin,
    duration_min: Math.ceil((stay + walkMin) / DURATION_STEP_MIN) * DURATION_STEP_MIN,
    walk_complete: legs.every((l) => l.walk_m !== null), route_source: "estimate", legs,
  };
}
