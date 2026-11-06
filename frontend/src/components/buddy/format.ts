// 버디 화면 공용 포맷·라벨 헬퍼 (B1~B5)
import type { BuddyEarning, Role } from "@/lib/types";

/** 데모 기준일 — 목 데이터가 2027년 1월(겨울방학)이라 "오늘"을 고정한다 */
export const DEMO_TODAY = "2027-01-14";

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

export const isProvider = (role?: Role | null) => role === "buddy";
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- v3: 공급자는 버디뿐 (해설사 역할 삭제)
export const roleLabel = (_role?: Role | null) => "버디";

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

/** "2027-01-13" → "1월 13일" */
export function krDate(s?: string | null): string {
  if (!s) return "";
  const d = parseDate(s);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
/** "2027-01-13" → "1월 13일 수" */
export function krDateDow(s: string): string {
  const d = parseDate(s);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${DOW[d.getDay()]}`;
}
/** 같은 달이면 "1월 12일 – 15일" */
export function krRange(from: string, to: string): string {
  if (!to || to === from) return krDate(from);
  return from.slice(0, 7) === to.slice(0, 7) ? `${krDate(from)} – ${parseDate(to).getDate()}일` : `${krDate(from)} – ${krDate(to)}`;
}
/** "14:00" + 120 → "14:00 – 16:00" */
export const timeSpan = (time: string, durationMin: number) => timeRange(time, durationMin).replace("–", " – ");
/** "2027-01" → "2027년 1월" */
export const monthLabel = (m: string) => `${m.slice(0, 4)}년 ${Number(m.slice(5, 7))}월`;
export const prevMonth = (m: string) => { const [y, mo] = m.split("-").map(Number); return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`; };

/** 언어 코드 → 한국어 이름 */
export const LANG_NAME: Record<string, string> = { ko: "한국어", en: "영어", ja: "일본어", zh: "중국어" };
export const langsName = (ls: string[]) => ls.map((l) => LANG_NAME[l] ?? l).join("·");

const batchim = (name: string) => { const c = name.charCodeAt(name.length - 1); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0; };
/** 받침 있으면 "과", 없으면 "와" */
export const wa = (name: string) => (batchim(name) ? "과" : "와");
