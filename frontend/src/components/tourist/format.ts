// 관광객 화면 공용 상수·포맷 함수 (날짜·라벨·오류 메시지)
import { ApiError } from "@/lib/api";
import type { BookingItem, CartItem, ItemType, Role } from "@/lib/types";

// 데모 기본 날짜 (겨울방학 개방 기간 2027-01-05 ~ 02-20)
export const DEFAULT_FROM = "2027-01-12";
export const DEFAULT_TO = "2027-01-15";
export const DEFAULT_TOUR_DATE = "2027-01-13";
// "예정/지난" 구분 기준일 — 데모 시나리오(2027년 1월 여행) 기준. 실제 API는 scope 쿼리로 서버가 나눈다.
export const DEMO_TODAY = "2027-01-10";

export const SS_PLAN = "sbstay.plan";
export const SS_TRAVELER = "sbstay.traveler";

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
/** "2027-01-12" → "1/12" */
export function md(s?: string | null): string {
  if (!s) return "";
  const [, m, d] = s.split("-");
  return `${Number(m)}/${Number(d)}`;
}
/** "2027-01-12" → "2027.1.12" */
export function ymd(s?: string | null): string {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  return `${y}.${Number(m)}.${Number(d)}`;
}
export const DOW_KO = ["일", "월", "화", "수", "목", "금", "토"];
export const DOW_KEY = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
/** "2027-01-12" → "1/12 (화)" */
export function dayLabel(s: string): string {
  return `${md(s)} (${DOW_KO[parseDate(s).getDay()]})`;
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
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export const DAY_LABEL: Record<string, string> = { mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토", sun: "일" };
export const daysLabel = (days: string[]) => days.map((d) => DAY_LABEL[d] ?? d).join("·");

export const LANG_SHORT: Record<string, string> = { ko: "한", en: "영", ja: "일", zh: "중" };
export const LANG_CODE: Record<string, string> = { ko: "KO", en: "EN", ja: "JA", zh: "ZH" };
export const langsShort = (ls: string[]) => ls.map((l) => LANG_SHORT[l] ?? l).join("/");
export const langsCode = (ls: string[]) => ls.map((l) => LANG_CODE[l] ?? l.toUpperCase()).join("/");

export const ROOM_LABEL: Record<string, string> = { single: "1인실", double: "2인실", twin: "트윈룸" };

// T2 관심사 칩 → AI-01 interests 값
export const INTERESTS: { key: string; label: string }[] = [
  { key: "literature", label: "한국 문학" },
  { key: "independence", label: "독립운동" },
  { key: "royal", label: "왕릉·궁" },
  { key: "hanok", label: "한옥" },
  { key: "food", label: "로컬 음식" },
  { key: "craft", label: "공예" },
];
// T7 테마 필터 칩 → TR-01 theme 값
export const THEMES: { key: string; label: string }[] = [
  { key: "literature", label: "문학" },
  { key: "independence", label: "독립운동" },
  { key: "royal", label: "왕릉·성곽" },
  { key: "hanok", label: "한옥·사찰" },
];
export const THEME_LABEL: Record<string, string> = Object.fromEntries(THEMES.map((t) => [t.key, t.label]));
// 버디 관심사 태그 라벨
export const INTEREST_LABEL: Record<string, string> = {
  literature: "한국 문학", walking: "산책", cafe: "카페", independence: "독립운동사", photo: "사진", food: "로컬 음식",
  craft: "공예", hanok: "한옥", architecture: "건축", sports: "운동", royal: "왕릉·궁",
};
export const interestsLabel = (ls: string[]) => ls.map((i) => INTEREST_LABEL[i] ?? i).join(", ");

export const TYPE_LABEL: Record<ItemType, string> = { dorm: "숙박", tour: "투어", buddy: "버디" };
export const ROLE_LABEL: Record<Role, string> = { tourist: "관광객", buddy: "버디", guide: "해설사", univ_admin: "대학 담당자", operator: "운영자" };

/** 역할별 첫 화면 */
export const homeFor = (r: Role): string => (r === "tourist" ? "/home" : r === "buddy" || r === "guide" ? "/buddy" : "/admin");

/** 예약 항목 상태 라벨 (버디 requested → 수락 대기, 숙박 requested → 승인 대기) */
export function itemStatusLabel(it: Pick<BookingItem, "type" | "status">): string | undefined {
  if (it.status === "requested") return it.type === "buddy" ? "수락 대기" : "승인 대기";
  return undefined;
}

/** 장바구니 항목 메타 한 줄 */
export function cartMeta(i: CartItem): string {
  if (i.type === "dorm" && i.date_from && i.date_to) return `${md(i.date_from)} – ${md(i.date_to)} · ${nightsBetween(i.date_from, i.date_to)}박 · 대학 승인 필요`;
  if (i.type === "tour") return `${md(i.date)} ${i.time ?? ""} · 즉시 확정`;
  if (i.type === "buddy") return `${md(i.date)} ${i.time ?? ""} · 버디 수락 필요`;
  return i.meta;
}

/** API/목 오류 → 메시지 */
export function errMsg(e: unknown): string {
  if (e instanceof ApiError) return `${e.message} (${e.code})`;
  if (e instanceof Error) return e.message;
  return "오류가 발생했어요";
}
/** 목 핸들러는 404를 throw 대신 Error 객체로 돌려주는 경우가 있어 결과를 검사한다 */
export async function okv<T>(p: Promise<T>): Promise<T> {
  const v = await p;
  if (v instanceof Error) throw v;
  return v;
}
