"use client";
// v3 관광객 흐름 보조 — 날짜 문구, 숙박 기간, 버디 고르기 단계 사이 상태(sessionStorage), 예약 오류 문구
import { ApiError } from "@/lib/api";
import type { BuddyRequestBody, CartItem, DormRequest } from "@/lib/types";
import { BOOKING_ERROR, DEFAULT_BUDDY_DATE, DEFAULT_FROM, DEFAULT_TO, addDays, errMsg, nightsBetween, parseDate } from "../format";
import { readSS, writeSS } from "../session";

export const DOW = ["일", "월", "화", "수", "목", "금", "토"];

/** "2027-01-13" → "1월 13일" */
export function koMD(s?: string | null): string {
  if (!s) return "";
  const d = parseDate(s);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
/** "2027-01-13" → "1월 13일 수" */
export function koDay(s?: string | null): string {
  if (!s) return "";
  return `${koMD(s)} ${DOW[parseDate(s).getDay()]}`;
}
/** "2027-01-13" → "13일" */
const dayOnly = (s: string) => `${parseDate(s).getDate()}일`;
/** 같은 달이면 "1월 12일 – 15일", 아니면 "1월 30일 – 2월 2일" */
export function koRange(from?: string, to?: string): string {
  if (!from || !to) return "";
  return parseDate(from).getMonth() === parseDate(to).getMonth() ? `${koMD(from)} – ${dayOnly(to)}` : `${koMD(from)} – ${koMD(to)}`;
}
/** 120 → "2시간", 90 → "1시간 30분" */
export function koDuration(min?: number | null): string {
  const m = min ?? 120;
  const h = Math.floor(m / 60), r = m % 60;
  return h && r ? `${h}시간 ${r}분` : h ? `${h}시간` : `${r}분`;
}
/** v3.5 코스 걸리는 시간: 180 → "약 3시간", 170 → "약 2시간 50분", 50 → "50분" (en: "About 3 hr" · "About 2 hr 50 min" · "50 min") */
export function aboutDuration(min: number, lang: "ko" | "en" = "ko"): string {
  const h = Math.floor(min / 60), r = min % 60;
  if (lang === "en") return h ? `About ${h} hr${r ? ` ${r} min` : ""}` : `${r} min`;
  return h ? `약 ${h}시간${r ? ` ${r}분` : ""}` : `${r}분`;
}
/** 코스 머리 한 줄: "약 3시간 · 4곳" (en "About 3 hr · 4 stops") */
export const courseMeta = (min: number, n: number, lang: "ko" | "en" = "ko") =>
  `${aboutDuration(min, lang)} · ${lang === "en" ? `${n} stop${n === 1 ? "" : "s"}` : `${n}곳`}`;
/** 걷는 거리: 550 → "550m", 1580 → "1,580m" (en "1,580 m") */
const meters = (m: number, lang: "ko" | "en") => `${m.toLocaleString("ko-KR")}${lang === "en" ? " m" : "m"}`;
/** 장소 사이 한 구간: "도보 8분 · 550m" (en "8 min walk · 550 m"). 좌표가 없으면 빠졌다고 알린다 */
export function walkText(leg: { walk_m: number | null; walk_min: number | null } | undefined, lang: "ko" | "en" = "ko"): string {
  if (!leg) return "";
  if (leg.walk_m === null || leg.walk_min === null) return lang === "en" ? "Walking time unknown (no map point)" : "좌표가 없어 걷는 시간 빠짐";
  return lang === "en" ? `${leg.walk_min} min walk · ${meters(leg.walk_m, lang)}` : `도보 ${leg.walk_min}분 · ${meters(leg.walk_m, lang)}`;
}
/** 지도에 찍을 수 있는 장소만 (좌표 없는 장소는 빼고) */
export const hasXY = <T extends { lat: number | null; lng: number | null }>(p: T): p is T & { lat: number; lng: number } => !!p.lat && !!p.lng;
/** 받침 있으면 "과", 없으면 "와" */
export function wa(name: string): string {
  const c = name.charCodeAt(name.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return "와";
  return (c - 0xac00) % 28 ? "과" : "와";
}
/** 받침 있으면 "이", 없으면 "가" */
export function iga(name: string): string {
  const c = name.charCodeAt(name.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return "가";
  return (c - 0xac00) % 28 ? "이" : "가";
}
/** "고려대학교" → "고려대" */
export const univShort = (u?: string | null) => (u ?? "").replace("여자대학교", "여대").replace("대학교", "대").replace("학교", "");

const LANG_KO: Record<string, string> = { ko: "한국어", en: "영어", ja: "일본어", zh: "중국어" };
/** 한국어를 빼고 "영어·일본어" */
export const foreignLangs = (ls: string[]) => ls.filter((l) => l !== "ko").map((l) => LANG_KO[l] ?? l).join("·");
/** 모두 "한국어, 영어, 일본어" */
export const allLangs = (ls: string[]) => ls.map((l) => LANG_KO[l] ?? l).join(", ");

/** from ~ to (둘 다 포함) 날짜 목록 */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 60; d = addDays(d, 1)) out.push(d);
  return out;
}

/** 장바구니의 숙박 항목 (한 곳만) */
export const stayIn = (items: CartItem[]) => items.find((i) => i.type === "dorm" && i.date_from && i.date_to) ?? null;
export const buddiesIn = (items: CartItem[]) => items.filter((i) => i.type === "buddy");
export const inStay = (stay: CartItem | null, d?: string) => !stay || (!!d && stay.date_from! <= d && d <= stay.date_to!);

/** 숙박 화면에서 고른 날짜 (숙박 목록 ↔ 객실 상세) */
export const SS_STAY_DATES = "sbstay.v3.stayDates";
export interface StayDates { from: string; to: string }
export const DEFAULT_STAY: StayDates = { from: DEFAULT_FROM, to: DEFAULT_TO };
export const stayNights = (s: StayDates) => nightsBetween(s.from, s.to);

/** 버디 고르기 단계(상세 → 요청 → 식사·사진) 사이 상태 */
export const SS_BUDDY_DRAFT = "sbstay.v3.buddyDraft";
export interface BuddyDraft {
  buddy_id: number; date: string; time: string; course_id: number | null;
  request: BuddyRequestBody; meal_count: number; album: boolean;
}
export const EMPTY_REQUEST: BuddyRequestBody = { diet: [], allergies: [], pace: "normal", places: [], note: "" };
export function readDraft(buddyId: number): BuddyDraft | null {
  const d = readSS<BuddyDraft | null>(SS_BUDDY_DRAFT, null);
  return d && d.buddy_id === buddyId ? d : null;
}
export function saveDraft(d: BuddyDraft) { writeSS(SS_BUDDY_DRAFT, d); }
export function clearDraft() { writeSS(SS_BUDDY_DRAFT, null); }

/** 마지막으로 적은 버디 요청 (장바구니 버디 항목 → 진행 중인 초안 순) — 버디 추천 needs 용. draft 는 useSS(SS_BUDDY_DRAFT) 값 */
export function lastRequest(items: CartItem[], draft: BuddyDraft | null): BuddyRequestBody | null {
  const fromCart = buddiesIn(items).find((i) => i.request)?.request as BuddyRequestBody | undefined;
  if (fromCart && "diet" in fromCart) return fromCart;
  const r = draft?.request;
  return r && (r.diet.length || r.allergies.length || r.pace === "slow") ? r : null;
}

export const isDormRequest = (r: CartItem["request"]): r is DormRequest => !!r && "late_checkin" in r;
export const isBuddyRequest = (r: CartItem["request"]): r is BuddyRequestBody => !!r && "diet" in r;

/** 버디 기본 날짜: 숙박 기간 안이면 데모 기본 날짜, 아니면 체크인 다음 날 */
export function defaultBuddyDate(from?: string, to?: string): string {
  if (!from || !to) return DEFAULT_BUDDY_DATE;
  if (from <= DEFAULT_BUDDY_DATE && DEFAULT_BUDDY_DATE <= to) return DEFAULT_BUDDY_DATE;
  const next = addDays(from, 1);
  return next <= to ? next : from;
}

/** 예약 오류 → 화면 문구 (BUDDY_REQUIRED · BUDDY_OUT_OF_STAY · COURSE_NOT_BOOKABLE · ONE_STAY) */
export function bookingErr(e: unknown): string {
  if (e instanceof ApiError && BOOKING_ERROR[e.code]) return BOOKING_ERROR[e.code];
  return errMsg(e);
}
