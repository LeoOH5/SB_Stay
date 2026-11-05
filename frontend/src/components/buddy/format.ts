// 버디 화면 공용 포맷·라벨 헬퍼 (B1~B5)
import type { BuddyEarning, Role } from "@/lib/types";

/** 데모 기준일 — 목 데이터가 2027년 1월(겨울방학)이라 "오늘"을 고정한다 */
export const DEMO_TODAY = "2027-01-13";

export const DOW = ["일", "월", "화", "수", "목", "금", "토"];

export function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
export function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** "2027-01-13" → "1/13 (수)" */
export function fmtDate(s: string): string {
  if (!s) return "";
  const d = parseDate(s);
  return `${d.getMonth() + 1}/${d.getDate()} (${DOW[d.getDay()]})`;
}
/** "2027-01-13" → "1/13" */
export function fmtShort(s: string): string {
  if (!s) return "";
  const d = parseDate(s);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
/** "14:00" + 120 → "14:00–16:00" */
export function timeRange(time: string, durationMin: number): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const end = h * 60 + m + durationMin;
  const eh = Math.floor(end / 60) % 24, em = end % 60;
  return `${time}–${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
}

export const LANG_LABEL: Record<string, string> = { ko: "한", en: "영", ja: "일", zh: "중" };
export const langsLabel = (langs: string[]) => langs.map((l) => LANG_LABEL[l] ?? l).join("/");

export const INTEREST_LABEL: Record<string, string> = {
  literature: "한국 문학", walking: "산책", cafe: "카페", independence: "독립운동", photo: "사진", food: "로컬 음식",
  hanok: "한옥", architecture: "건축", craft: "공예", sports: "스포츠", history: "역사", music: "음악",
};
export const interestLabel = (k: string) => INTEREST_LABEL[k] ?? k;
export const interestsLabel = (ks: string[]) => ks.map(interestLabel).join(", ");

export const isProvider = (role?: Role | null) => role === "buddy" || role === "guide";
export const roleLabel = (role?: Role | null) => (role === "guide" ? "해설사" : "버디");

/** GET /buddy/earnings (BD-07) 응답 — 목 형태 기준 */
export interface BuddyEarnings {
  month: string; activities: number; total_fee: number; paid: number; pending: number; items: BuddyEarning[];
}
/** POST /ai/buddy-brief (AI-04) 응답 */
export interface BuddyBrief { brief: string }
/** AU-07 응답 */
export interface CalendarOut { calendar_connected: boolean }
/** BD-04 응답 */
export interface AvailabilityOut { dates: string[] }
