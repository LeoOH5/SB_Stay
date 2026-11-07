// 관광객 화면 공용 상수·포맷 함수 (날짜·라벨·오류 메시지)
import { ApiError } from "@/lib/api";
import { curLang, tr } from "@/lib/i18n";
import type { BookingItem, CartItem, ItemType, Role } from "@/lib/types";

// 데모 기본 날짜 (겨울방학 개방 기간 2027-01-05 ~ 02-20)
export const DEFAULT_FROM = "2027-01-12";
export const DEFAULT_TO = "2027-01-15";
/** 버디와 걷는 기본 날짜 (숙박 기간 안) */
export const DEFAULT_BUDDY_DATE = "2027-01-13";
/** @deprecated v3: 코스는 예약 항목이 아니다. DEFAULT_BUDDY_DATE 를 쓴다 */
export const DEFAULT_TOUR_DATE = DEFAULT_BUDDY_DATE;
// "예정/지난" 구분 기준일 — 데모 시나리오(2027년 1월 여행) 기준. 실제 API는 scope 쿼리로 서버가 나눈다.
export const DEMO_TODAY = "2027-01-14";

export const SS_PLAN = "sbstay.plan";
/** AI-01 일정을 만들 때 고른 값 (T12에서 다른 버디를 찾을 때 AI-03에 그대로 넘긴다) */
export const SS_PLAN_INPUT = "sbstay.planInput";
/** T12에서 직접 고른 버디 — plan_id 가 같은 일정에만 적용 */
export const SS_PLAN_BUDDY = "sbstay.planBuddy";
export const SS_TRAVELER = "sbstay.traveler";

/** 언어 따라 바뀌는 라벨 표 — 예전처럼 LABEL[key] 로 그대로 쓴다 (ko 값은 그대로, en 값은 영어) */
export function biRecord<K extends string>(ko: Record<K, string>, en: Partial<Record<K, string>>): Record<K, string> {
  return new Proxy(ko, {
    get: (t, p) => (typeof p === "string" && curLang() === "en" && p in en ? (en as Record<string, string>)[p] : (t as Record<string | symbol, unknown>)[p]),
  }) as Record<K, string>;
}
const MON_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** 1 → "Jan" */
export const monEn = (m: number) => MON_EN[(m - 1 + 12) % 12];
export const dowEn = (i: number) => DOW_EN[i];

export function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
export function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function addDays(s: string, n: number): string {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}
/** "2027-01-12" → "1/12" (en: "Jan 12") */
export function md(s?: string | null): string {
  if (!s) return "";
  const [, m, d] = s.split("-");
  return curLang() === "en" ? `${monEn(Number(m))} ${Number(d)}` : `${Number(m)}/${Number(d)}`;
}
/** "2027-01-12" → "2027.1.12" (en: "Jan 12, 2027") */
export function ymd(s?: string | null): string {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  return curLang() === "en" ? `${monEn(Number(m))} ${Number(d)}, ${y}` : `${y}.${Number(m)}.${Number(d)}`;
}
export const DOW_KO = ["일", "월", "화", "수", "목", "금", "토"];
export const DOW_KEY = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
/** "2027-01-12" → "1/12 (화)" (en: "Tue, Jan 12") */
export function dayLabel(s: string): string {
  const w = parseDate(s).getDay();
  return curLang() === "en" ? `${DOW_EN[w]}, ${md(s)}` : `${md(s)} (${DOW_KO[w]})`;
}
export function dowKey(s: string): string {
  return DOW_KEY[parseDate(s).getDay()];
}
export function nightsBetween(from: string, to: string): number {
  return Math.max(0, Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86400000));
}
/** ISO datetime → "1/6 09:00" */
export function dateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${curLang() === "en" ? `${monEn(d.getMonth() + 1)} ${d.getDate()}` : `${d.getMonth() + 1}/${d.getDate()}`} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export const DAY_LABEL: Record<string, string> = biRecord<string>(
  { mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토", sun: "일" },
  { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" },
);
export const daysLabel = (days: string[]) => days.map((d) => DAY_LABEL[d] ?? d).join(curLang() === "en" ? ", " : "·");

export const LANG_SHORT: Record<string, string> = biRecord<string>({ ko: "한", en: "영", ja: "일", zh: "중" }, { ko: "KO", en: "EN", ja: "JA", zh: "ZH" });
export const LANG_CODE: Record<string, string> = { ko: "KO", en: "EN", ja: "JA", zh: "ZH" };
export const langsShort = (ls: string[]) => ls.map((l) => LANG_SHORT[l] ?? l).join("/");
export const langsCode = (ls: string[]) => ls.map((l) => LANG_CODE[l] ?? l.toUpperCase()).join("/");

export const ROOM_LABEL: Record<string, string> = biRecord<string>({ single: "1인실", double: "2인실", twin: "트윈룸" }, { single: "Single room", double: "Double room", twin: "Twin room" });

/** { key, label } 칩 목록 — label 은 읽을 때 지금 언어로 */
const chip = (key: string, ko: string, en: string) => ({ key, get label() { return tr(ko, en); } });

// T2 관심사 칩 → AI-01 interests 값
export const INTERESTS: { key: string; label: string }[] = [
  chip("literature", "한국 문학", "Korean literature"),
  chip("independence", "독립운동", "Independence movement"),
  chip("royal", "왕릉·궁", "Royal tombs"),
  chip("hanok", "한옥", "Hanok"),
  chip("food", "로컬 음식", "Local food"),
  chip("craft", "공예", "Crafts"),
];
// T7 테마 필터 칩 → TR-01 theme 값
export const THEMES: { key: string; label: string }[] = [
  chip("literature", "문학", "Literature"),
  chip("independence", "독립운동", "Independence"),
  chip("royal", "왕릉·성곽", "Royal tomb & wall"),
  chip("hanok", "한옥·사찰", "Hanok & temple"),
];
export const THEME_LABEL: Record<string, string> = biRecord<string>(
  { literature: "문학", independence: "독립운동", royal: "왕릉·성곽", hanok: "한옥·사찰" },
  { literature: "Literature", independence: "Independence", royal: "Royal tomb & wall", hanok: "Hanok & temple" },
);
// 버디 관심사 태그 라벨
export const INTEREST_LABEL: Record<string, string> = biRecord<string>({
  literature: "한국 문학", walking: "산책", cafe: "카페", independence: "독립운동사", photo: "사진", food: "로컬 음식",
  craft: "공예", hanok: "한옥", architecture: "건축", sports: "운동", royal: "왕릉·궁",
}, {
  literature: "Korean literature", walking: "Walking", cafe: "Cafés", independence: "Independence history", photo: "Photos", food: "Local food",
  craft: "Crafts", hanok: "Hanok", architecture: "Architecture", sports: "Sports", royal: "Royal tombs",
});
export const interestsLabel = (ls: string[]) => ls.map((i) => INTEREST_LABEL[i] ?? i).join(", ");

/** 항목 유형 라벨. tour 는 v3에서 예약 항목이 아니라 무료 산책 "코스" */
export const TYPE_LABEL: Record<ItemType | "tour" | "course", string> = biRecord<ItemType | "tour" | "course">(
  { dorm: "숙박", buddy: "버디", tour: "코스", course: "코스" },
  { dorm: "Stay", buddy: "Buddy", tour: "Walk", course: "Walk" },
);
export const ROLE_LABEL: Record<Role, string> = biRecord<Role>(
  { tourist: "관광객", buddy: "버디", univ_admin: "대학 담당자", operator: "운영자" },
  { tourist: "Traveler", buddy: "Buddy", univ_admin: "University staff", operator: "Operator" },
);

/** 역할별 첫 화면 */
export const homeFor = (r: Role): string => (r === "tourist" ? "/home" : r === "buddy" ? "/buddy" : "/admin");

/** v3.9 로그인 화면 주소 — 로그인 뒤 돌아올 곳(지금 주소)을 ?next= 로 넘긴다 */
export const loginHref = (next?: string | null, base = "/login"): string => (next ? `${base}?next=${encodeURIComponent(next)}` : base);
/** 지금 보고 있는 주소 (경로 + 쿼리). 클릭 순간에 읽는다 */
export const herePath = (): string => (typeof window === "undefined" ? "" : window.location.pathname + window.location.search);

/**
 * v3.9 로그인·가입·역할 선택 뒤 갈 곳.
 * ?next= 가 이 사이트 안의 상대 경로("/"로 시작, "//"·"\" 없음)이고 역할 영역에 맞으면 그곳, 아니면 fallback(역할별 첫 화면).
 * 관광객은 /admin·/buddy 밖, 버디는 /buddy 안, 대학 담당자·운영자는 /admin 안만. 로그인·가입 화면으로는 돌려보내지 않는다.
 */
export function afterLogin(role: Role, next: string | null | undefined, fallback: string = homeFor(role)): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  const path = next.split(/[?#]/)[0];
  const under = (p: string) => path === p || path.startsWith(`${p}/`);
  if (under("/login") || under("/signup")) return fallback;
  const ok = role === "tourist" ? !under("/admin") && !under("/buddy") : role === "buddy" ? under("/buddy") : under("/admin");
  return ok ? next : fallback;
}

/** 예약 항목 상태 라벨 (버디 requested → 수락 대기 / confirmed → 수락됨, 숙박 requested → 승인 대기) */
export function itemStatusLabel(it: Pick<BookingItem, "type" | "status">): string | undefined {
  if (it.status === "requested") return it.type === "buddy" ? tr("수락 대기", "Awaiting buddy") : tr("승인 대기", "Awaiting approval");
  if (it.status === "confirmed" && it.type === "buddy") return tr("수락됨", "Accepted");
  return statusLabelEn(it.status);
}

/** 예약 오류 코드 → 화면 문구 (CONTRACT §4) */
export const BOOKING_ERROR: Record<string, string> = biRecord<string>({
  BUDDY_REQUIRED: "기숙사 숙박에는 버디가 1명 필요해요.",
  BUDDY_OUT_OF_STAY: "버디 날짜가 숙박 기간 안이어야 해요.",
  ONE_STAY: "숙박은 한 번에 한 곳만 신청할 수 있어요.",
  COURSE_NOT_BOOKABLE: "산책 코스는 무료라 예약하지 않아도 돼요. 버디를 고를 때 같이 걸을 코스로 골라 주세요.",
}, {
  BUDDY_REQUIRED: "A dorm stay needs at least one buddy.",
  BUDDY_OUT_OF_STAY: "The buddy date must be within your stay.",
  ONE_STAY: "You can book only one stay at a time.",
  COURSE_NOT_BOOKABLE: "Walks are free, so no booking is needed. Pick one as the walk to do with your buddy.",
});

/** 장바구니 항목 메타 한 줄 */
export function cartMeta(i: CartItem): string {
  const en = curLang() === "en";
  if (i.type === "dorm" && i.date_from && i.date_to) {
    const n = nightsBetween(i.date_from, i.date_to);
    return en ? `${md(i.date_from)} – ${md(i.date_to)} · ${n} night${n === 1 ? "" : "s"} · University approval needed` : `${md(i.date_from)} – ${md(i.date_to)} · ${n}박 · 대학 승인 필요`;
  }
  if (i.type === "buddy") {
    const extras = en
      ? [i.meal_count ? `${i.meal_count} meal${i.meal_count === 1 ? "" : "s"}` : "", i.album ? "Photo record" : ""].filter(Boolean).join(" · ")
      : [i.meal_count ? `식사 ${i.meal_count}회` : "", i.album ? "앨범" : ""].filter(Boolean).join(" · ");
    const h = (i.duration_min ?? 120) / 60;
    return en
      ? `${md(i.date)} ${i.time ?? ""} · ${h} hr${extras ? ` · ${extras}` : ""} · Buddy must accept`
      : `${md(i.date)} ${i.time ?? ""} · ${h}시간${extras ? ` · ${extras}` : ""} · 버디 수락 필요`;
  }
  return i.meta;
}

/** API/목 오류 → 메시지 */
export function errMsg(e: unknown): string {
  if (e instanceof ApiError) return `${e.message} (${e.code})`;
  if (e instanceof Error) return e.message;
  return tr("오류가 발생했어요", "Something went wrong");
}
/** 목 핸들러는 404를 throw 대신 Error 객체로 돌려주는 경우가 있어 결과를 검사한다 */
export async function okv<T>(p: Promise<T>): Promise<T> {
  const v = await p;
  if (v instanceof Error) throw v;
  return v;
}

// ---- 기숙사 건물 이름·이용 규칙 영어 (서버 데이터에 영어 필드가 없어 시드 문구 기준으로 바꾼다. 없는 문구는 그대로) ----
const BUILDING_EN: Record<string, string> = {
  "프런티어관": "Frontier Hall", "CJ인터내셔널하우스": "CJ International House", "안암인터내셔널하우스": "Anam International House",
  "정릉생활관": "Jeongneung Residence Hall", "길음생활관": "Gireum Residence Hall", "성미관": "Seongmi Hall", "성미료": "Seongmi Dorm",
  "상상빌리지": "Sangsang Village", "생활관 3동": "Residence Hall 3", "제1생활관(목화관)": "Residence Hall 1 (Mokhwa)", "제2생활관": "Residence Hall 2", "천장관": "Cheonjang Hall",
};
const RULE_EN: Record<string, string> = {
  "23:00 이후 정숙": "Quiet after 23:00", "공동취사장·세탁실 이용": "Shared kitchen and laundry", "공용 세탁실 이용": "Shared laundry room",
  "국제학생 기숙사": "International student dorm", "국제학생 기숙사, 공용 라운지": "International student dorm, shared lounge",
  "여권 정보는 예약 시점에만 입력": "Passport details are entered only when you book", "여성 전용": "Women only",
  "여성 전용, 국제학생과 같은 건물": "Women only, same building as international students", "여성 전용, 캠퍼스 밖 (종암로)": "Women only, off campus (Jongam-ro)",
  "여성 전용, 피트니스룸·스터디룸": "Women only, gym and study room", "연습실 이용은 별도 신청": "Practice rooms need a separate request",
  "외부인 출입 불가, 23:00 이후 정숙": "No outside visitors, quiet after 23:00", "체크인 15:00 / 체크아웃 11:00": "Check-in 15:00 / Check-out 11:00",
  "취사 금지": "No cooking in rooms", "취사 금지, 공용 주방 이용": "No cooking in rooms, use the shared kitchen", "캠퍼스 밖 기숙사, 셔틀 이용": "Off-campus dorm, shuttle available",
};
/** 기숙사 건물 이름 — en 이면 영어 이름 */
export const buildingName = (b: string): string => (curLang() === "en" ? BUILDING_EN[b] ?? b : b);
/** 기숙사 이용 규칙 한 줄 — en 이면 영어 */
export const ruleText = (r: string): string => (curLang() === "en" ? RULE_EN[r] ?? r : r);

// ---- 대학 이름·예약 항목 이름·상태 영어 (서버가 한국어로 저장한 값을 보여 줄 때만 바꾼다) ----
const UNIV_EN: Record<string, string> = {
  "고려대학교": "Korea University", "국민대학교": "Kookmin University", "성신여자대학교": "Sungshin Women's University", "한성대학교": "Hansung University",
  "서경대학교": "Seokyeong University", "동덕여자대학교": "Dongduk Women's University", "한국예술종합학교": "Korea National University of Arts",
  "고려대": "Korea Univ.", "국민대": "Kookmin Univ.", "성신여대": "Sungshin Univ.", "한성대": "Hansung Univ.", "서경대": "Seokyeong Univ.", "동덕여대": "Dongduk Univ.", "한예종": "K-Arts",
};
const ROOM_KO_EN: Record<string, string> = { "1인실": "single room", "2인실": "double room", "4인실": "quad room" };
/** 대학 이름 — en 이면 영어 (모르는 이름은 그대로) */
export const univLabel = (u?: string | null): string => (curLang() === "en" ? UNIV_EN[u ?? ""] ?? (u ?? "") : (u ?? ""));
/** 예약 항목 이름 — en 이면 "고려대학교 프런티어관 2인실" → "Korea University Frontier Hall double room", "지우와 동네 걷기" → "Neighborhood walk with 지우" */
export function itemTitle(title: string): string {
  if (curLang() !== "en") return title;
  const walk = title.match(/^(.+?)(와|과) 동네 걷기$/);
  if (walk) return `Neighborhood walk with ${walk[1]}`;
  return title.split(" ").map((w) => UNIV_EN[w] ?? BUILDING_EN[w] ?? ROOM_KO_EN[w] ?? w).join(" ");
}
const STATUS_EN: Record<string, string> = {
  requested: "Requested", approved: "Approved", rejected: "Declined", confirmed: "Confirmed", cancelled: "Cancelled", partially_approved: "Partly approved",
  pending: "Pending", paid: "Paid", completed: "Completed",
};
/** StatusPill 라벨 — en 이면 영어, ko 면 undefined(기본 한국어 라벨) */
export const statusLabelEn = (status: string): string | undefined => (curLang() === "en" ? STATUS_EN[status] ?? status : undefined);
