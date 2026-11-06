// 목 API 라우터 — 경로·응답 형식은 docs/api-detail + docs/v3/CONTRACT.md 와 같다.
// 상태 변경은 메모리에 유지(새로고침 시 초기화). 오류는 실제 API처럼 ApiError(status, code, message)로 던진다.
import { ApiError } from "../errors";
import {
  ALBUM_FEE, ALLERGIES, BUDDY_MIN_AGE, CAN_HELP, courseTimes, DIET, DIET_TO_HELP, FREE_AI_QUESTIONS, MEAL_LIMIT, MEAL_MAX, PACE, PERSONALITY, QUIZ_PASS, QUIZ_TOTAL,
  REPORT_CATEGORY, REPORT_SUSPEND_AT, REQUEST_NOTE_MAX, REQUEST_PLACES_MAX, REVIEW_TAGS, STYLE, SUB_SCORES, SURVEY_PAIN, buddyItemPrice, buddyNet,
  decideGrade, label, payoutBase, platformFee, rateOf, GRADE_NOTE, GRADE_RULES,
} from "../codes";
import type {
  Activity, AdminBookingRow, AdminBuddyRow, AdminCourseRow, AdminMealClaimRow, AdminReportRow, AiPlan, AiStory, Booking, BookingItem, CourseSurvey, MyPlan,
  BuddyApplyStatus, BuddyDetail, BuddyGradeInfo, EducationOut, Eligibility, BuddyMatch, BuddyProfile, BuddyRequest, BuddyRequestBody, BuddySettlement, BuddyStatus, CanHelp,
  CartItem, DormRequest, ItemStatus, ListResponse, MealClaim, PlanDay, PlanItem, PlanWarning, PublicActivity, Report, ReportCategory,
  Review, ReviewTag, SettlementRow, Settlements, SubScores, Traveler, User,
} from "../types";
import * as D from "./data";

const DEFAULT_MONTH = D.TODAY.slice(0, 7);

interface ApplyState {
  school_email: string | null; university: string | null; university_id: number | null; email_verified: boolean; korean_national: boolean;
  birth_date: string | null; code_agreed: boolean; quiz_score: number | null; profile_done: boolean; status: BuddyStatus | "none";
  /** v3.7 자격 경로 · 거주 경로 서류 · 본 교육 영상 */
  eligibility: Eligibility | null; school_name: string | null; residence_proof_url: string | null; enrollment_proof_url: string | null; videos: string[];
}
const ALL_VIDEOS = D.educationVideos.map((v) => v.id);

const state = {
  bookings: structuredClone(D.bookings),
  owner: { ...D.bookingOwner } as Record<number, string>,
  reviewed: new Set<number>(D.reviewedItems),
  reviews: structuredClone(D.reviews),
  buddies: structuredClone(D.buddies),
  buddyStatus: { ...D.buddyStatus } as Record<number, BuddyStatus | "rejected">,
  adminInfo: structuredClone(D.buddyAdminInfo),
  activities: structuredClone(D.activities),
  mealClaims: structuredClone(D.mealClaims),
  reports: structuredClone(D.reports),
  grades: structuredClone(D.buddyGrades),
  rates: { ...D.itemRates } as Record<number, number>,
  notifications: structuredClone(D.notifications),
  availability: new Set<string>(D.buddies[0].available_dates),
  bankAccount: D.BANK_ACCOUNT as string | null,
  apply: {
    "jiwoo@a-univ.ac.kr": { school_email: "jiwoo@a-univ.ac.kr", university: "고려대학교", university_id: 1, email_verified: true, korean_national: true, birth_date: "2004-05-02", code_agreed: true, quiz_score: 9, profile_done: true, status: "approved",
      eligibility: "school_email", school_name: null, residence_proof_url: null, enrollment_proof_url: null, videos: ALL_VIDEOS },
    "gaeun@example.com": { school_email: null, university: "서울시립대학교", university_id: null, email_verified: false, korean_national: true, birth_date: "2004-07-09", code_agreed: true, quiz_score: 9, profile_done: true, status: "pending",
      eligibility: "residence", school_name: "서울시립대학교", residence_proof_url: "residence_proof_gaeun.jpg", enrollment_proof_url: "enrollment_gaeun.jpg", videos: ALL_VIDEOS },
  } as Record<string, ApplyState>,
  calendarConnected: false,
  /** v3.4 무료 이용자 AI 질문 수: "이메일|날짜" → 횟수 */
  aiUsage: {} as Record<string, number>,
  surveys: [] as (CourseSurvey & { email: string })[],
  currentUser: null as User | null,
  nextId: 600,
};

// ------------------------------------------------------------------ 공통 도우미
function fail(status: number, code: string, message: string): never { throw new ApiError(status, code, message); }
const list = <T,>(items: T[]): ListResponse<T> => ({ items, next_cursor: null });
const md = (s?: string | null) => (s ? `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}` : "");
const nights = (from: string, to: string) => Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 86400000));
const addDays = (s: string, n: number) => { const d = new Date(Date.parse(s) + n * 86400000); return d.toISOString().slice(0, 10); };
/** 목업 세계의 '지금' = TODAY 날짜 + 실제 시각 (정렬이 시드 데이터와 맞게) */
const nowIso = () => `${D.TODAY}T${new Date().toISOString().slice(11)}`;
const isOk = (s: ItemStatus) => s === "approved" || s === "confirmed";
/** 받침 있으면 "과", 없으면 "와" (지우와 · 서연과) */
const wa = (name: string) => { const c = name.charCodeAt(name.length - 1); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0 ? "과" : "와"; };
const ROOM: Record<string, string> = { single: "1인실", double: "2인실", twin: "트윈룸" };

/** 새로고침하면 목업 상태가 비므로, 저장된 로그인 사용자로 역할을 판단 */
function storedUser(): User | null {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("sbstay.user") ?? "null") as User | null; } catch { return null; }
}
const me = () => state.currentUser ?? storedUser();
const myEmail = () => me()?.email ?? "emma@example.com";
const myBuddyId = () => D.buddyIdByEmail[me()?.email ?? ""] ?? 31;

const buddyOf = (id: number) => state.buddies.find((b) => b.id === id);
const dormOf = (id: number) => D.dorms.find((d) => d.id === id);
const courseOf = (id?: number | null) => (id == null ? undefined : D.tours.find((t) => t.id === id));
const statusOf = (id: number) => state.buddyStatus[id] ?? "pending";
const gradeOf = (id: number): D.GradeRow => (state.grades[id] ??= { grade: "basic", approved_on: null, evaluated_for: null, last_month_walks: 0, this_month_walks: 0, reviews: 0, rating: null, needs_recheck: false, dormant_since: null });
/** 공개 목록·AI 추천에 나오는 버디: 승인 + 휴면 아님 */
const listed = (id: number) => statusOf(id) === "approved" && !gradeOf(id).needs_recheck;
const withGrade = <T extends { id: number }>(bd: T) => ({ ...bd, grade: gradeOf(bd.id).grade });
const activityOf = (it: BookingItem) => it.price - (it.meal_count ?? 0) * MEAL_LIMIT - (it.album ? ALBUM_FEE : 0);
/** 확정 때 고정한 정산율, 아직이면 버디의 지금 정산율 */
const rateFor = (it: BookingItem) => state.rates[it.id] ?? rateOf(gradeOf(it.ref_id).grade);

function findItem(itemId: number): { b: Booking; it: BookingItem } | null {
  for (const b of state.bookings) { const it = b.items.find((i) => i.id === itemId); if (it) return { b, it }; }
  return null;
}
/** v3.6: 새로 받는 사진 값은 /uploads 가 준 주소만 (목업은 blob:, 백엔드는 /media/) */
const photosOk = (v: unknown) => v == null || (Array.isArray(v) && v.every((u) => typeof u === "string" && (u.startsWith("blob:") || u.startsWith("/media/"))));
const claimsOf = (itemId: number) => state.mealClaims.filter((c) => c.item_id === itemId);
const sumClaims = (itemId: number, statuses: string[]) => claimsOf(itemId).filter((c) => statuses.includes(c.status)).reduce((s, c) => s + c.amount, 0);

// ------------------------------------------------------------------ v3.4 이용 방식 (backend services/free_tier.py 와 같은 규칙)
/** 결제했고 취소되지 않은 예약에 살아 있는 버디 항목이 있으면 buddy. 관광객이 아니면 제한 없음(buddy) */
function planOf(): MyPlan["plan"] {
  const u = me();
  if (!u) return "free";
  if (u.role !== "tourist") return "buddy";
  const email = myEmail();
  const paid = state.bookings.some((bk) => state.owner[bk.id] === email && !!bk.paid_at && bk.status !== "cancelled"
    && bk.items.some((i) => i.type === "buddy" && ["requested", "approved", "confirmed"].includes(i.status)));
  return paid ? "buddy" : "free";
}
const usageKey = () => `${myEmail()}|${D.TODAY}`;
function myPlan(): MyPlan {
  if (planOf() === "buddy") return { plan: "buddy", ai_question_limit: null, ai_questions_left_today: null, ai_questions_used_today: 0 };
  const used = state.aiUsage[usageKey()] ?? 0;
  return { plan: "free", ai_question_limit: FREE_AI_QUESTIONS, ai_questions_left_today: Math.max(FREE_AI_QUESTIONS - used, 0), ai_questions_used_today: used };
}

// ------------------------------------------------------------------ 예약 파생 필드
function decorateItem(it: BookingItem): BookingItem {
  const out: BookingItem = { ...it };
  if (it.type === "buddy") {
    const mc = it.meal_count ?? 0;
    out.meal_count = mc;
    out.meal_deposit = mc * MEAL_LIMIT;
    out.meal_used = sumClaims(it.id, ["requested", "approved"]);
    out.meal_approved = sumClaims(it.id, ["approved"]);
    out.meal_refund = out.meal_deposit - out.meal_approved;
    out.album = it.album ?? false;
    out.album_photos = out.album ? state.activities.filter((a) => a.item_id === it.id).reduce((s, a) => s + a.photos.length, 0) : 0;
    out.course_title = courseOf(it.course_id)?.title ?? null;
    out.course_id = it.course_id ?? null;
    out.request = it.request ?? null;
  }
  out.reviewed = state.reviewed.has(it.id);
  out.can_review = isOk(it.status) && !!it.date_from && it.date_from <= D.TODAY && !out.reviewed;
  return out;
}
const decorate = (b: Booking): Booking => ({ ...structuredClone(b), items: b.items.map(decorateItem) });

function recompute(b: Booking) {
  const active = b.items.filter((i) => i.status !== "cancelled");
  if (active.length === 0) b.status = "cancelled";
  else if (active.every((i) => isOk(i.status))) b.status = "confirmed";
  else if (active.some((i) => isOk(i.status))) b.status = "partially_approved";
  else b.status = "requested";
}
function recalcTotals(b: Booking) {
  const live = b.items.filter((i) => i.status !== "cancelled" && i.status !== "rejected");
  b.total_price = live.reduce((s, i) => s + i.price, 0);
  const buddies = live.filter((i) => i.type === "buddy");
  b.platform_fee = platformFee(live.filter((i) => i.type === "dorm").reduce((s, i) => s + i.price, 0), buddies.map((i) => ({ activity: activityOf(i), rate: rateFor(i), album: !!i.album })));
}

function notify(title: string, type = "info") {
  state.notifications.unshift({ id: state.nextId++, type, title, read_at: null, created_at: nowIso() });
}

function decideItem(itemId: number, action: "approve" | "reject", reason?: string) {
  const f = findItem(itemId);
  if (!f) fail(404, "NOT_FOUND", "예약 항목 없음");
  const { b, it } = f!;
  if (it.status !== "requested") fail(409, "CONFLICT", "이미 결정된 항목");
  it.status = action === "approve" ? (it.type === "buddy" ? "confirmed" : "approved") : "rejected";
  it.reject_reason = action === "reject" ? reason ?? null : null;
  if (it.type === "buddy" && action === "approve" && state.calendarConnected) it.google_event_id = "evt_" + itemId;
  if (it.type === "buddy" && it.status === "confirmed") { state.rates[it.id] ??= rateOf(gradeOf(it.ref_id).grade); recalcTotals(b); } // 확정 때 정산율 고정
  recompute(b);
  notify(`${it.title} · ${it.status === "rejected" ? "거절됨" : it.type === "buddy" ? "수락됨" : "승인됨"}`, `item_${it.status}`);
  return it;
}

// ------------------------------------------------------------------ 예약 생성 규칙 (CONTRACT §4)
const isStr = (v: unknown): v is string => typeof v === "string";
function validateBuddyRequest(r: unknown): BuddyRequestBody | null {
  if (r == null) return null;
  const x = r as Partial<BuddyRequestBody>;
  const bad = (m: string) => fail(422, "VALIDATION", m);
  const diet = x.diet ?? [], allergies = x.allergies ?? [], places = x.places ?? [];
  if (!Array.isArray(diet) || diet.some((d) => !(d in DIET))) bad("먹지 않는 것 값이 올바르지 않아요");
  if (!Array.isArray(allergies) || allergies.some((a) => !(a in ALLERGIES))) bad("알레르기 값이 올바르지 않아요");
  const pace = x.pace ?? "normal";
  if (!(pace in PACE)) bad("걷는 속도 값이 올바르지 않아요");
  if (!Array.isArray(places) || places.length > REQUEST_PLACES_MAX) bad(`더 보고 싶은 곳은 ${REQUEST_PLACES_MAX}곳까지예요`);
  const note = x.note ?? "";
  if (!isStr(note) || note.length > REQUEST_NOTE_MAX) bad(`메모는 ${REQUEST_NOTE_MAX}자까지예요`);
  return { diet: [...diet], allergies: [...allergies], pace, places: places.map(Number), note };
}
function normalizeDormRequest(r: unknown): DormRequest | null {
  if (r == null) return null;
  const x = r as Partial<DormRequest>;
  return { late_checkin: !!x.late_checkin, quiet_room: !!x.quiet_room, low_floor: !!x.low_floor };
}

function buildItems(raw: CartItem[], baseId: number): BookingItem[] {
  if (!Array.isArray(raw) || raw.length === 0) fail(422, "VALIDATION", "항목이 비어 있어요");
  for (const r of raw) {
    const t = (r as { type: string }).type;
    if (t === "tour" || t === "course") fail(422, "COURSE_NOT_BOOKABLE", "산책 코스는 무료라 예약하지 않아요. 버디를 고를 때 같이 걸을 코스로 골라 주세요.");
    if (t !== "dorm" && t !== "buddy") fail(422, "VALIDATION", `알 수 없는 항목 유형: ${t}`);
  }
  const dormsIn = raw.filter((r) => r.type === "dorm");
  const buddiesIn = raw.filter((r) => r.type === "buddy");
  if (dormsIn.length > 1) fail(422, "ONE_STAY", "숙박은 한 번에 한 곳만 신청할 수 있어요");
  const stay = dormsIn[0];
  if (stay) {
    if (!stay.date_from || !stay.date_to || stay.date_to <= stay.date_from) fail(422, "VALIDATION", "숙박 날짜를 확인해 주세요");
    if (buddiesIn.length === 0) fail(422, "BUDDY_REQUIRED", "기숙사 숙박에는 버디가 1명 필요해요");
    for (const bd of buddiesIn) {
      const d = bd.date ?? bd.date_from ?? "";
      if (!(stay.date_from! <= d && d <= stay.date_to!)) fail(422, "BUDDY_OUT_OF_STAY", `버디 날짜가 숙박 기간(${md(stay.date_from)} – ${md(stay.date_to)}) 안이어야 해요`);
    }
  }
  return raw.map((r, k): BookingItem => {
    const id = baseId * 10 + k;
    if (r.type === "dorm") {
      const room = dormOf(r.ref_id) ?? fail(404, "NOT_FOUND", "객실 없음");
      const n = nights(r.date_from!, r.date_to!);
      return { id, type: "dorm", ref_id: room.id, title: `${room.university.name} ${room.building} ${ROOM[room.room_type]}`, meta: `${md(r.date_from)} – ${md(r.date_to)} · ${n}박`, status: "requested", price: room.price_per_night * n, date_from: r.date_from, date_to: r.date_to, request: normalizeDormRequest(r.request) };
    }
    const bd = buddyOf(r.ref_id) ?? fail(404, "NOT_FOUND", "버디 없음");
    if (statusOf(bd.id) !== "approved") fail(409, "BUDDY_UNAVAILABLE", `${bd.name} 버디는 지금 요청을 받지 않아요`);
    if (gradeOf(bd.id).needs_recheck) fail(409, "BUDDY_RESTING", "지금은 요청을 받지 않는 버디예요. 다른 버디를 골라 주세요");
    const date = r.date ?? r.date_from;
    if (!date) fail(422, "VALIDATION", "버디 날짜를 골라 주세요");
    const meal = r.meal_count ?? 0;
    if (!Number.isInteger(meal) || meal < 0 || meal > MEAL_MAX) fail(422, "VALIDATION", `식사는 0~${MEAL_MAX}회까지예요`);
    if (r.course_id != null && !courseOf(r.course_id)) fail(422, "VALIDATION", "코스를 찾을 수 없어요");
    const dur = r.duration_min ?? 120, time = r.time ?? "14:00", album = !!r.album;
    return { id, type: "buddy", ref_id: bd.id, title: `${bd.name}${wa(bd.name)} 동네 걷기`, meta: `${md(date)} ${time} · ${dur / 60}시간`, status: "requested",
      price: buddyItemPrice(bd.hourly_fee ?? 15000, dur, meal, album), date_from: date, time, duration_min: dur,
      request: validateBuddyRequest(r.request), course_id: r.course_id ?? null, course_title: courseOf(r.course_id)?.title ?? null, meal_count: meal, meal_deposit: meal * MEAL_LIMIT, album };
  });
}

// ------------------------------------------------------------------ 버디 측 파생
function stayOf(b: Booking) {
  const d = b.items.find((i) => i.type === "dorm" && i.status !== "cancelled");
  return d ? { title: d.title, date_from: d.date_from ?? "", date_to: d.date_to ?? "" } : null;
}
function briefFor(it: BookingItem): string {
  const r = it.request as BuddyRequestBody | null | undefined;
  const parts: string[] = [];
  const needs = [...(r?.diet ?? []).map((d) => label(DIET, d)), ...(r?.allergies ?? []).map((a) => `${label(ALLERGIES, a)} 알레르기`)];
  if (needs.length) parts.push(`${needs.join(", ")} 요청이 있어요. 식당에서 꼭 확인해 주세요.`);
  if (r?.pace === "slow") parts.push("언덕은 천천히, 중간에 쉬어 가세요.");
  const c = courseOf(it.course_id);
  if (c) parts.push(`같이 걸을 코스는 ${c.title} — ${c.places.map((p) => p.name).join(" → ")}.`);
  else if (r?.places?.length) parts.push(`더 보고 싶은 곳: ${r.places.map((id) => D.places.find((p) => p.id === id)?.name ?? id).join(", ")}.`);
  return parts.join(" ") || "관심사를 먼저 물어보고 동선을 같이 정해 보세요.";
}
/** v3.8 AI-04 추천 동선 (목업): 코스 장소 + 더 가 보고 싶은 곳(최대 3). 목업은 순서를 다시 정하지 않고 추정 거리만 붙인다 */
function briefRoute(it: BookingItem) {
  const r = it.request as BuddyRequestBody | null | undefined;
  const c = courseOf(it.course_id);
  const stops = [...(c ? [...c.places].sort((x, y) => x.order - y.order).map((p) => ({ id: p.id, name: p.name, name_en: p.name_en, lat: p.lat, lng: p.lng, course: true })) : [])];
  for (const id of (r?.places ?? []).slice(0, 3)) {
    const p = D.places.find((x) => x.id === id);
    if (p && !stops.some((s) => s.id === id)) stops.push({ id: p.id, name: p.name, name_en: p.name_en, lat: p.lat, lng: p.lng, course: false });
  }
  const t = courseTimes(stops.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, stay_min: 0 })));
  return {
    route: stops.map((s, i) => ({ place_id: s.id, name: s.name, name_en: s.name_en, lat: s.lat, lng: s.lng, from_course: s.course,
      walk_m_from_prev: i ? t.legs[i - 1].walk_m : null, walk_min_from_prev: i ? t.legs[i - 1].walk_min : null, source: i ? t.legs[i - 1].source : null, path: null })),
    route_walk_m: t.walk_m_total, route_walk_min: t.walk_min_total, route_source: t.route_source,
  };
}
function toBuddyRequest(b: Booking, it: BookingItem): BuddyRequest {
  const tv = b.traveler;
  return {
    item_id: it.id, booking_id: b.id, booking_code: b.code,
    tourist: { name: tv?.name ?? "", nationality: D.NATIONALITY_KO[tv?.nationality ?? ""] ?? tv?.nationality ?? "", language: D.TOURIST_LANG[tv?.nationality ?? ""] ?? "영어" },
    date: it.date_from ?? "", time: it.time ?? "", duration_min: it.duration_min ?? 120, interests: D.TOURIST_INTERESTS[b.id] ?? [], status: it.status,
    ai_brief: briefFor(it), price: it.price, request: (it.request as BuddyRequestBody | null) ?? null, course_id: it.course_id ?? null, course_title: courseOf(it.course_id)?.title ?? null,
    meal_count: it.meal_count ?? 0, album: it.album ?? false, stay: stayOf(b), meal_claims: claimsOf(it.id).filter((c) => c.status !== "rejected").length,
  };
}
function buddyItems(buddyId: number) {
  const out: { b: Booking; it: BookingItem }[] = [];
  for (const b of state.bookings) for (const it of b.items) if (it.type === "buddy" && it.ref_id === buddyId) out.push({ b, it });
  return out;
}

function buddySettlement(buddyId: number, month: string): BuddySettlement {
  const rows = buddyItems(buddyId).filter(({ it }) => it.status === "confirmed" && (it.date_from ?? "").startsWith(month)).sort((a, b) => (a.it.date_from ?? "").localeCompare(b.it.date_from ?? ""));
  const items = rows.map(({ b, it }) => {
    // v3.6: 정산 대상 = 활동비 + 앨범 (식사 보증금 제외)
    const album = it.album ? ALBUM_FEE : 0;
    const gross = payoutBase(activityOf(it), !!it.album);
    const payout_rate = rateFor(it), net = buddyNet(gross, payout_rate);
    const meal_approved = sumClaims(it.id, ["approved"]), meal_pending = sumClaims(it.id, ["requested"]);
    return { item_id: it.id, date: it.date_from ?? "", tourist: b.traveler?.name ?? "", gross, album, payout_rate, fee: gross - net, meal_approved, meal_pending, net, status: (meal_pending > 0 ? "meal_pending" : "confirmed") as "confirmed" | "meal_pending" };
  });
  const sum = (k: "gross" | "album" | "fee" | "net" | "meal_approved" | "meal_pending") => items.reduce((s, i) => s + i[k], 0);
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m + 1, 0));
  const masked = buddyId === 31 && state.bankAccount ? state.bankAccount.replace(/(\d{3})-(\d{3})-(\d{3})(\d{3})/, "$1-***-***$4") : null;
  const g = gradeOf(buddyId).grade;
  return { month, pay_date: last.toISOString().slice(0, 10), account: masked, grade: g, payout_rate: rateOf(g), walks: items.length, gross: sum("gross"), album: sum("album"), fee: sum("fee"), net: sum("net"), meals_approved: sum("meal_approved"), meals_pending: sum("meal_pending"), payout: sum("net") + sum("meal_approved"), items };
}

function toMealClaim(c: D.MealClaimRow): MealClaim {
  const f = findItem(c.item_id);
  return { id: c.id, item_id: c.item_id, booking_code: f?.b.code ?? "", tourist: f?.b.traveler?.name ?? "", date: c.date, place: c.place, items: c.items, amount: c.amount, limit: MEAL_LIMIT, over_limit: c.amount > MEAL_LIMIT, status: c.status, reason: c.reason, created_at: c.created_at, receipt_url: c.receipt_url };
}
function toAdminMealClaim(c: D.MealClaimRow): AdminMealClaimRow {
  const f = findItem(c.item_id);
  const deposit = (f?.it.meal_count ?? 0) * MEAL_LIMIT;
  const otherApproved = claimsOf(c.item_id).filter((x) => x.id !== c.id && x.status === "approved").reduce((s, x) => s + x.amount, 0);
  const r = f?.it.request as BuddyRequestBody | null | undefined;
  const summary = [...(r?.diet ?? []).map((d) => label(DIET, d)), ...(r?.allergies ?? []).map((a) => `${label(ALLERGIES, a)} 알레르기`)].join(", ");
  return { ...toMealClaim(c), buddy_name: buddyOf(c.buddy_id)?.name ?? "", deposit, deposit_left: deposit - otherApproved, request_summary: summary || "없음" };
}
function toActivity(a: D.ActivityRow): Activity {
  return { id: a.id, item_id: a.item_id, date: a.date, places: a.places, foods: a.foods, note: a.note, photos: a.photos, created_at: a.created_at, tourist: a.item_id ? findItem(a.item_id)?.b.traveler?.name ?? null : null };
}
const publicActivities = (buddyId: number, n: number): PublicActivity[] =>
  state.activities.filter((a) => a.buddy_id === buddyId && a.date <= D.TODAY).sort((a, b) => b.date.localeCompare(a.date)).slice(0, n).map((a) => ({ date: a.date, places: a.places, foods: a.foods, photos: a.photos }));

const reportCount = (buddyId: number) => state.reports.filter((r) => r.buddy_id === buddyId && r.status !== "dismissed").length;
function toReport(r: D.ReportRow): Report {
  return { id: r.id, booking_item_id: r.booking_item_id, buddy_id: r.buddy_id, category: r.category, text: r.text, photo_url: r.photo_url, status: r.status, action: r.action, auto_suspended: r.auto_suspended, created_at: r.created_at, resolved_at: r.resolved_at };
}
function toAdminReport(r: D.ReportRow): AdminReportRow {
  const bd = buddyOf(r.buddy_id);
  const st = statusOf(r.buddy_id);
  return { ...toReport(r), buddy_name: bd?.name ?? "", buddy_university: bd?.university ?? "", reporter: r.reporter, booking_code: r.booking_item_id ? findItem(r.booking_item_id)?.b.code ?? null : null, count_for_buddy: reportCount(r.buddy_id), buddy_status: st === "rejected" ? "suspended" : st };
}

function toAdminBuddy(id: number): AdminBuddyRow | null {
  const bd = buddyOf(id), info = state.adminInfo[id], st = statusOf(id);
  if (!bd || !info || st === "rejected") return null;
  return { id, name: bd.name, email: info.email, major: bd.major, year: bd.year, university: bd.university, university_id: bd.university_id, languages: bd.languages, status: st,
    age: info.age, school_email_verified: info.school_email_verified, code_agreed: info.code_agreed, quiz_score: info.quiz_score, report_count: reportCount(id), can_help: bd.can_help, can_drive: bd.can_drive, walk_count: bd.walk_count, rating: bd.rating,
    korean_national: info.korean_national ?? true, eligibility: info.eligibility, school_name: info.school_name ?? null,
    residence_proof_url: info.residence_proof_url ?? null, enrollment_proof_url: info.enrollment_proof_url ?? null, videos_watched: info.videos_watched, videos_total: D.educationVideos.length,
    ...gradeCols(id) };
}
function gradeCols(id: number) {
  const g = gradeOf(id);
  return { grade: g.grade, payout_rate: rateOf(g.grade), eval_month: D.EVAL_MONTH, last_month_walks: g.last_month_walks, total_reviews: g.reviews, avg_rating: g.rating,
    evaluated_for: g.evaluated_for, approved_on: g.approved_on, needs_recheck: g.needs_recheck };
}
/** GET /buddy/grade — v3.7 매달 1일, 지난달 동행으로 평가 */
function gradeInfo(id: number): BuddyGradeInfo {
  const g = gradeOf(id);
  const need = (code: string) => { const r = GRADE_RULES.find((x) => x.grade === code)!; return { walks: r.walks, reviews: r.reviews, rating: r.rating }; };
  const i = GRADE_RULES.findIndex((r) => r.grade === g.grade);
  const nx = i > 0 ? GRADE_RULES[i - 1] : null;
  return { grade: g.grade, payout_rate: rateOf(g.grade), evaluated_for: g.evaluated_for, next_eval_on: D.NEXT_EVAL_ON,
    stats: { month: D.EVAL_MONTH, last_month_walks: g.last_month_walks, this_month_walks: g.this_month_walks, reviews: g.reviews, rating: g.rating },
    next: nx ? { grade: nx.grade, payout_rate: nx.rate, need: need(nx.grade) } : null,
    keep: g.grade !== "basic" ? need(g.grade) : null,
    first_month: !g.approved_on || g.approved_on > `${D.TODAY.slice(0, 7)}-01`, note: GRADE_NOTE,
    needs_recheck: g.needs_recheck, dormant_since: g.dormant_since, updated_at: D.GRADE_UPDATED };
}

function adminBookingRows(): AdminBookingRow[] {
  const rows: AdminBookingRow[] = [];
  for (const b of state.bookings) for (const it of b.items) {
    const univ = it.type === "dorm" ? dormOf(it.ref_id)?.university.id : buddyOf(it.ref_id)?.university_id;
    const schedule = it.type === "dorm" ? `${md(it.date_from)} – ${md(it.date_to)}` : `${md(it.date_from)} ${it.time ?? ""}`.trim();
    rows.push({ booking_id: b.id, item_id: it.id, code: b.code, tourist: b.traveler?.name ?? "", nationality: D.NATIONALITY_KO[b.traveler?.nationality ?? ""] ?? b.traveler?.nationality ?? "", type: it.type, title: it.title, schedule, price: it.price, status: it.status, university_id: univ });
  }
  return rows;
}

function applyStateFor(email: string): ApplyState {
  return (state.apply[email] ??= { school_email: null, university: null, university_id: null, email_verified: false, korean_national: false, birth_date: null, code_agreed: false, quiz_score: null, profile_done: false, status: "none",
    eligibility: null, school_name: null, residence_proof_url: null, enrollment_proof_url: null, videos: [] });
}
const eligibleOf = (s: ApplyState) => (s.eligibility === "residence" ? !!(s.residence_proof_url && s.enrollment_proof_url) : s.email_verified);
function educationOut(s: ApplyState): EducationOut {
  const videos = D.educationVideos.map((v) => ({ ...v, video_url: null, watched: s.videos.includes(v.id) }));
  const watched = videos.filter((v) => v.watched).length;
  return { videos, watched, total: videos.length, done: watched === videos.length };
}
function ageOn(birth: string, today: string): number {
  const [by, bm, bd] = birth.split("-").map(Number), [ty, tm, td] = today.split("-").map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}
function applyOut(s: ApplyState): BuddyApplyStatus {
  return { email_verified: s.email_verified, korean_national: s.korean_national, school_email: s.school_email, university: s.university, age_ok: !!s.birth_date && ageOn(s.birth_date, D.TODAY) >= BUDDY_MIN_AGE, code_agreed: s.code_agreed, quiz_score: s.quiz_score, quiz_passed: (s.quiz_score ?? 0) >= QUIZ_PASS, profile_done: s.profile_done, status: s.status,
    eligibility: s.eligibility, eligible: eligibleOf(s), school_name: s.school_name, residence_proof_url: s.residence_proof_url, enrollment_proof_url: s.enrollment_proof_url,
    videos_watched: ALL_VIDEOS.filter((v) => s.videos.includes(v)), videos_total: ALL_VIDEOS.length, education_done: ALL_VIDEOS.every((v) => s.videos.includes(v)) };
}
function univByEmail(email: string) {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return D.universities.find((u) => (u.email_domains ?? []).some((d) => domain === d || domain.endsWith("." + d)));
}

function buddyProfile(id: number): BuddyProfile {
  const bd = buddyOf(id)!;
  const st = statusOf(id);
  return { ...structuredClone(withGrade(bd)), available_dates: id === 31 ? [...state.availability].sort() : bd.available_dates, status: st === "rejected" ? "pending" : st, bank_account: id === 31 && state.bankAccount ? state.bankAccount.replace(/(\d{3})-(\d{3})-(\d{3})(\d{3})/, "$1-***-***$4") : null, school_email: state.adminInfo[id]?.email ?? null };
}

// ------------------------------------------------------------------ AI
function makePlan(b: Record<string, unknown>): AiPlan {
  const ci = isStr(b.check_in) ? b.check_in : "2027-01-12";
  const co = isStr(b.check_out) && b.check_out > ci ? b.check_out : addDays(ci, 3);
  const n = nights(ci, co);
  const room = dormOf(10)!;
  const dates = Array.from({ length: n + 1 }, (_, i) => addDays(ci, i));
  const walkDay = dates[Math.min(1, dates.length - 1)];
  const course = courseOf(3)!;
  // 숙소와 같은 대학 버디 우선, 그날 가능한 사람
  const cand = state.buddies.filter((x) => listed(x.id) && x.university_id === room.university.id).sort((a, c) => (a.id === 31 ? -1 : c.id === 31 ? 1 : 0));
  const bd = cand.find((x) => (x.id === 31 ? state.availability.has(walkDay) : x.available_dates.includes(walkDay))) ?? cand[0];
  const warnings: PlanWarning[] = [];
  const days: PlanDay[] = dates.map((date) => ({ date, items: [] as PlanItem[] }));
  days[0].items.push({ time: "15:00", type: "dorm", ref_id: room.id, title: `${room.building} 체크인`, price: room.price_per_night * n, meta: `${room.university.name} ${ROOM[room.room_type]}, ${n}박` });
  const walk = days.find((d) => d.date === walkDay)!;
  let total = room.price_per_night * n;
  if (bd) {
    const price = buddyItemPrice(bd.hourly_fee ?? 15000, 120);
    total += price;
    walk.items.push({ time: "14:00", type: "buddy", ref_id: bd.id, title: `버디 ${bd.name}${wa(bd.name)} ${course.title.replace("의 성북동 산책", " 산책")} 코스`, price, meta: `2시간 · ${course.places.map((p) => p.name).join(", ")}`, course_id: course.id, duration_min: 120 });
  } else warnings.push("NO_BUDDY");
  walk.items.push({ time: "14:00", type: "course", ref_id: course.id, title: course.title, price: 0, meta: `무료 코스 · 장소 ${course.places.length}곳` });
  if (days.length > 3) days[2].items.push({ time: null, type: "free", ref_id: null, title: "정릉과 성북선잠박물관", price: 0, meta: "자유 일정 · AI 제안" });
  days[days.length - 1].items.push({ time: "11:00", type: "free", ref_id: null, title: "체크아웃", price: 0, meta: "11:00" });
  const budget = Number(b.budget ?? 0);
  if (budget > 0 && total > budget) warnings.push("OVER_BUDGET");
  return { plan_id: "pl_" + Math.random().toString(36).slice(2, 7), reason: `문학과 독립운동에 맞췄어요. ${md(walkDay)} 오후에 ${bd ? `같은 학교 버디 ${bd.name}${wa(bd.name)} ` : ""}${course.title} 코스를 걸어요. 장소마다 AI가 이야기를 들려줘요.`, total_price: total, days, warnings, ai: false };
}

function buddyMatch(b: Record<string, unknown>): BuddyMatch {
  const arr = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
  const interests = arr(b.interests), personality = arr(b.personality), style = arr(b.style);
  // 요청 식단 → 필요한 도움 (vegan/vegetarian → vegan_food, halal → halal_food)
  const needs = [...new Set([...(arr(b.needs) as CanHelp[]), ...arr(b.diet).map((d) => DIET_TO_HELP[d as keyof typeof DIET_TO_HELP]).filter((v): v is CanHelp => !!v)])];
  const univ = b.university_id != null ? Number(b.university_id) : null;
  const date = isStr(b.date) ? b.date : null;
  const scored = state.buddies.filter((x) => listed(x.id) && (!date || x.available_dates.includes(date))).map((x) => {
    let s = 0.6 + Math.min(2, x.interests.filter((i) => interests.includes(i)).length) * 0.05;
    const reasons: string[] = [];
    const fit = Math.min(2, x.personality.filter((p) => personality.includes(p)).length + x.style.filter((p) => style.includes(p)).length);
    s += fit * 0.05;
    if (fit) reasons.push([...x.personality.filter((p) => personality.includes(p)).map((p) => label(PERSONALITY, p)), ...x.style.filter((p) => style.includes(p)).map((p) => label(STYLE, p))].slice(0, 2).join(", "));
    if (needs.length && needs.every((n) => x.can_help.includes(n))) { s += 0.1; reasons.push(needs.map((n) => `${label(CAN_HELP, n)} 가능`).join(", ")); }
    if (univ && x.university_id === univ) { s += 0.1; reasons.push("같은 대학 숙소"); }
    if (!reasons.length) reasons.push(`${x.major} · 평점 ${x.rating}`);
    return { buddy_id: x.id, score: Math.min(0.99, Math.round(s * 100) / 100), reason: reasons.join(" · ") };
  }).sort((a, c) => c.score - a.score).slice(0, 3);
  return { reason: "요청 사항·성향·같은 대학 순으로 골랐어요", matches: scored };
}

// ------------------------------------------------------------------ 라우터
export async function mockHandlers(method: string, path: string, body?: unknown, query?: Record<string, string | number | undefined>): Promise<unknown> {
  const b = (body ?? {}) as Record<string, unknown>;
  const q = (k: string) => (query?.[k] === undefined || query?.[k] === "" ? undefined : String(query[k]));
  const m = (re: RegExp) => path.match(re);
  let x: RegExpMatchArray | null;
  const role = me()?.role;
  const requireOperator = () => { if (role && role !== "operator") fail(403, "FORBIDDEN", "운영팀 계정만 볼 수 있어요"); };

  // ---- v3.6 사진 올리기: 서버 없이 이 브라우저에서만 보이는 object URL
  if (method === "POST" && path === "/uploads") {
    if (!me()) fail(401, "UNAUTHORIZED", "로그인한 뒤 사진을 올릴 수 있어요");
    const file = b.file;
    if (!(file instanceof Blob)) fail(422, "VALIDATION", "사진 파일이 없어요");
    const f = file as Blob;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) fail(415, "UNSUPPORTED_TYPE", "JPG · PNG · WebP 사진만 올릴 수 있어요");
    if (f.size > 10 * 1024 * 1024) fail(413, "FILE_TOO_LARGE", "사진은 10MB까지 올릴 수 있어요");
    return { url: URL.createObjectURL(f), content_type: f.type, size: f.size };
  }

  // ---- 인증
  if (method === "POST" && path === "/auth/google") { const u = D.users["emma@example.com"]; state.currentUser = u; return { access_token: "mock", user: u, needs_role_setup: false }; }
  if (method === "POST" && path === "/auth/login") {
    const u = D.users[String(b.email)];
    if (!u || b.password !== "demo1234") fail(401, "UNAUTHORIZED", "이메일 또는 비밀번호가 맞지 않습니다");
    state.currentUser = u; return { access_token: "mock", user: u, needs_role_setup: false };
  }
  if (method === "POST" && path === "/auth/signup") { const u: User = { id: state.nextId++, name: String(b.name ?? "New User"), email: String(b.email), role: "tourist", university_id: null, language: (b.language as "ko" | "en") ?? "en" }; state.currentUser = u; return { access_token: "mock", user: u, needs_role_setup: true }; }
  if (method === "GET" && path === "/auth/me/plan") { if (!me()) fail(401, "UNAUTHORIZED", "로그인이 필요합니다"); return myPlan(); }
  if (method === "GET" && path === "/auth/me") { const u = me(); if (!u) fail(401, "UNAUTHORIZED", "로그인이 필요합니다"); return u; }
  if (method === "PATCH" && (path === "/auth/me" || path === "/users/me")) { const u = me(); if (u) { state.currentUser = { ...u, ...(b as Partial<User>) }; } return state.currentUser; }
  if (method === "PATCH" && path === "/users/me/role") {
    const r = String(b.role);
    if (!["tourist", "buddy", "univ_admin", "operator"].includes(r)) fail(422, "VALIDATION", "역할은 tourist | buddy | univ_admin | operator 중 하나예요");
    const u = me(); if (u) state.currentUser = { ...u, role: r as User["role"] }; return state.currentUser;
  }
  if (method === "POST" && path === "/auth/google/calendar") { state.calendarConnected = true; if (state.currentUser) state.currentUser.calendar_connected = true; return { calendar_connected: true }; }
  if (method === "DELETE" && path === "/auth/google/calendar") { state.calendarConnected = false; if (state.currentUser) state.currentUser.calendar_connected = false; return { calendar_connected: false }; }

  // ---- 홈·콘텐츠
  if (method === "GET" && path === "/packages") return list(D.packages);
  if ((x = m(/^\/contents\/(\w+)$/)) && method === "GET") { const lang = q("lang") ?? "ko"; return D.contents.find((c) => c.key === x![1] && c.language === lang) ?? D.contents.find((c) => c.key === x![1]) ?? fail(404, "NOT_FOUND", "콘텐츠 없음"); }

  // ---- 숙박
  if (method === "GET" && path === "/universities") return list(D.universities);
  if (method === "GET" && path === "/dorms") return list(D.dorms.filter((d) => !q("university_id") || d.university.id === Number(q("university_id"))));
  if ((x = m(/^\/dorms\/(\d+)$/)) && method === "GET") return dormOf(Number(x[1])) ?? fail(404, "NOT_FOUND", "객실 없음");

  // ---- 코스(tours)·장소
  if (method === "GET" && path === "/tours") return list(D.tours.filter((t) => (!q("theme") || t.theme === q("theme")) && (!q("language") || t.languages.includes(q("language")!))));
  if ((x = m(/^\/tours\/(\d+)\/reviews$/)) && method === "GET") return list<Review>([]);
  if ((x = m(/^\/tours\/(\d+)\/survey$/)) && method === "POST") {
    if (!me()) fail(401, "UNAUTHORIZED", "로그인이 필요합니다");
    if (role !== "tourist") fail(403, "FORBIDDEN", "권한이 없습니다");
    const tourId = Number(x[1]);
    if (!courseOf(tourId)) fail(404, "NOT_FOUND", "코스를 찾을 수 없습니다");
    const sat = Number(b.satisfaction);
    if (!Number.isInteger(sat) || sat < 1 || sat > 5) fail(422, "VALIDATION", "만족도는 1~5예요");
    if (!(String(b.pain) in SURVEY_PAIN)) fail(422, "VALIDATION", "불편했던 점을 골라 주세요");
    const row: CourseSurvey = { id: state.nextId++, tour_id: tourId, satisfaction: sat, pain: b.pain as CourseSurvey["pain"], want_buddy: !!b.want_buddy, plan: planOf(), created_at: nowIso() };
    state.surveys.push({ ...row, email: myEmail() });
    return row;
  }
  if ((x = m(/^\/tours\/(\d+)$/)) && method === "GET") return courseOf(Number(x[1])) ?? fail(404, "NOT_FOUND", "코스 없음");
  if ((x = m(/^\/places\/(\d+)$/)) && method === "GET") return D.places.find((p) => p.id === Number(x![1])) ?? fail(404, "NOT_FOUND", "장소 없음");
  if (method === "GET" && path === "/places") return list(D.places);

  // ---- 버디 (관광객 측, approved 만)
  if (method === "GET" && path === "/buddies") {
    const has = (k: string, vals: string[]) => { const v = q(k); return !v || v.split(",").some((s) => vals.includes(s)); };
    return list(state.buddies.filter((bd) => listed(bd.id)
      && has("language", bd.languages) && has("interest", bd.interests) && has("personality", bd.personality) && has("style", bd.style) && has("can_help", bd.can_help)
      && (!q("date") || (bd.id === 31 ? state.availability.has(q("date")!) : bd.available_dates.includes(q("date")!)))
      && (!q("university_id") || bd.university_id === Number(q("university_id")))).map((bd) => withGrade(bd.id === 31 ? { ...bd, available_dates: [...state.availability].sort() } : bd)));
  }
  if ((x = m(/^\/buddies\/(\d+)\/reviews$/)) && method === "GET") return list(state.reviews[`buddy:${x[1]}`] ?? []);
  if ((x = m(/^\/buddies\/(\d+)\/activities$/)) && method === "GET") return list(publicActivities(Number(x[1]), 10));
  if ((x = m(/^\/buddies\/(\d+)$/)) && method === "GET") {
    const id = Number(x[1]);
    const bd = buddyOf(id);
    if (!bd || statusOf(id) !== "approved") fail(404, "NOT_FOUND", "버디 없음");
    const out: BuddyDetail = { ...structuredClone(withGrade(bd!)), available_dates: id === 31 ? [...state.availability].sort() : bd!.available_dates, recent_activities: publicActivities(id, 3), reviews: state.reviews[`buddy:${id}`] ?? [] };
    return out;
  }

  // ---- AI
  if (method === "POST" && path === "/ai/plan") return makePlan(b);
  if (method === "POST" && path === "/ai/story") {
    const s = D.stories[Number(b.place_id)];
    if (!s) return { answer: "자료에 없는 장소예요.", sources: [], grounded: false } satisfies AiStory;
    const qq = String(b.question ?? "").toLowerCase().trim();
    if (!qq) return { answer: s.intro, sources: s.sources, grounded: true } satisfies AiStory;
    // v3.4 무료 이용자는 질문 하루 3번 (장소 소개는 세지 않음)
    let left: number | null = null;
    if (planOf() === "free") {
      const used = state.aiUsage[usageKey()] ?? 0;
      if (used >= FREE_AI_QUESTIONS) fail(429, "AI_LIMIT", `무료 코스에서는 AI에게 하루 ${FREE_AI_QUESTIONS}번까지 물어볼 수 있어요. 내일 다시 물어보거나, 버디와 함께 걸으면 제한 없이 물어볼 수 있어요`);
      state.aiUsage[usageKey()] = used + 1;
      left = FREE_AI_QUESTIONS - used - 1;
    }
    const hit = s.qa.find((p) => qq.includes(p.q.split(" ")[0]) || qq.includes("north") || qq.includes("북"));
    return hit ? ({ answer: hit.a, sources: s.sources, grounded: true, questions_left: left } satisfies AiStory) : ({ answer: "자료에 없는 내용이에요. 다른 질문을 해 보거나 버디에게 같이 찾아보자고 해 보세요.", sources: s.sources, grounded: false, questions_left: left } satisfies AiStory);
  }
  if (method === "POST" && path === "/ai/buddy-match") return buddyMatch(b);
  if (method === "POST" && path === "/ai/buddy-brief") { const f = findItem(Number(b.item_id)); return { brief: f ? briefFor(f.it) : "관심사를 먼저 물어보고 동선을 같이 정해 보세요.", ...(f ? briefRoute(f.it) : {}) }; }

  // ---- 예약
  if (method === "POST" && path === "/bookings") {
    const traveler = b.traveler as Traveler | undefined;
    if (!traveler?.name || !traveler.email) fail(422, "VALIDATION", "여행자 정보를 입력해 주세요");
    const id = state.nextId++;
    const items = buildItems((b.items as CartItem[]) ?? [], id);
    const booking: Booking = { id, code: `SB-2027-${String(id).padStart(4, "0")}`, status: "requested", total_price: 0, platform_fee: 0, traveler, created_at: nowIso(), items };
    recalcTotals(booking);
    recompute(booking);
    state.bookings.unshift(booking);
    state.owner[id] = me()?.email ?? traveler!.email;
    notify(`예약 신청 접수 · ${booking.code}`, "booking_requested");
    return decorate(booking);
  }
  if (method === "GET" && path === "/bookings/me") {
    const mine = state.bookings.filter((bk) => state.owner[bk.id] === myEmail());
    const scope = q("scope");
    const end = (bk: Booking) => bk.items.reduce((mx, i) => ((i.date_to ?? i.date_from ?? "") > mx ? (i.date_to ?? i.date_from ?? "") : mx), "");
    const pick = scope === "upcoming" ? mine.filter((bk) => bk.status !== "cancelled" && end(bk) >= D.TODAY) : scope === "past" ? mine.filter((bk) => bk.status === "cancelled" || end(bk) < D.TODAY) : mine;
    return list(pick.map(decorate));
  }
  if ((x = m(/^\/bookings\/(\d+)\/items\/(\d+)\/replace-buddy$/)) && method === "POST") {
    const bk = state.bookings.find((v) => v.id === Number(x![1])) ?? fail(404, "NOT_FOUND", "예약 없음");
    const it = bk.items.find((i) => i.id === Number(x![2])) ?? fail(404, "NOT_FOUND", "예약 항목 없음");
    if (it.type !== "buddy") fail(422, "VALIDATION", "버디 항목만 바꿀 수 있어요");
    if (!["requested", "rejected", "confirmed"].includes(it.status) || (it.status === "confirmed" && (it.date_from ?? "") <= D.TODAY)) fail(409, "CONFLICT", "이 버디 항목은 바꿀 수 없어요");
    const date = isStr(b.date) ? b.date : it.date_from!;
    const time = isStr(b.time) ? b.time : it.time;
    const stay = bk.items.find((i) => i.type === "dorm" && i.status !== "cancelled" && i.status !== "rejected");
    if (stay && !(stay.date_from! <= date && date <= stay.date_to!)) fail(422, "BUDDY_OUT_OF_STAY", `버디 날짜가 숙박 기간(${md(stay.date_from)} – ${md(stay.date_to)}) 안이어야 해요`);
    const [nu] = buildItems([{ type: "buddy", ref_id: Number(b.buddy_id), title: "", meta: "", price: 0, date, time, duration_min: it.duration_min ?? 120, request: it.request, course_id: it.course_id, meal_count: it.meal_count, album: it.album }], state.nextId++);
    if (it.status !== "rejected") it.status = "cancelled";
    bk.items.push(nu);
    recalcTotals(bk);
    recompute(bk);
    notify(`버디 바꾸기 요청 · ${nu.title} ${md(date)}`, "item_requested");
    return decorate(bk);
  }
  if ((x = m(/^\/bookings\/(\d+)\/items\/(\d+)$/)) && method === "PATCH") { decideItem(Number(x[2]), b.action as "approve" | "reject", b.reason as string | undefined); return decorateItem(findItem(Number(x[2]))!.it); }
  if ((x = m(/^\/bookings\/(\d+)\/cancel$/)) && method === "POST") {
    const bk = state.bookings.find((v) => v.id === Number(x![1])) ?? fail(404, "NOT_FOUND", "예약 없음");
    bk.items.forEach((i) => (i.status = "cancelled")); bk.status = "cancelled"; bk.cancelled_at = nowIso();
    return decorate(bk);
  }
  if ((x = m(/^\/bookings\/(\d+)\/pay$/)) && method === "POST") { const bk = state.bookings.find((v) => v.id === Number(x![1])); if (bk) bk.paid_at = nowIso(); return { status: "paid", paid_at: bk?.paid_at }; }
  if ((x = m(/^\/bookings\/(\d+)\/checkin-guide$/)) && method === "GET") {
    const bk = state.bookings.find((v) => v.id === Number(x![1]));
    const d = bk?.items.find((i) => i.type === "dorm");
    const room = d ? dormOf(d.ref_id) : undefined;
    return { building: room ? `${room.university.name} ${room.building}` : "고려대학교 프런티어관", address: "서울 성북구", checkin: "15:00", checkout: "11:00", wifi: "KU-GUEST", steps: ["1층 안내데스크에서 이름 확인", "여권 제시 후 출입카드 수령", "배정된 방으로 이동"], emergency: ["대학 담당자 02-000-0000", "운영팀 02-0000-0000", "112 / 119 / 1330"] };
  }
  if ((x = m(/^\/bookings\/(\d+)\/reviews$/)) && method === "POST") {
    const bk = state.bookings.find((v) => v.id === Number(x![1])) ?? fail(404, "NOT_FOUND", "예약 없음");
    const it = bk.items.find((i) => i.id === Number(b.item_id)) ?? fail(422, "VALIDATION", "후기를 남길 항목을 골라 주세요");
    const rating = Number(b.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) fail(422, "VALIDATION", "별점은 1~5예요");
    if (!isOk(it.status) || !it.date_from || it.date_from > D.TODAY) fail(409, "TRIP_NOT_DONE", "여행이 끝난 뒤에 후기를 남길 수 있어요");
    if (state.reviewed.has(it.id)) fail(409, "ALREADY_REVIEWED", "이미 후기를 남겼어요");
    const sub = (b.sub_scores ?? null) as SubScores | null;
    if (sub && Object.entries(sub).some(([k, v]) => !(k in SUB_SCORES) || !(Number(v) >= 1 && Number(v) <= 5))) fail(422, "VALIDATION", "세부 점수는 1~5예요");
    const tags = Array.isArray(b.tags) ? (b.tags as string[]) : null;
    if (tags && tags.some((t) => !(t in REVIEW_TAGS))) fail(422, "VALIDATION", "후기 태그가 올바르지 않아요");
    const review: Review = { id: state.nextId++, rating, text: String(b.text ?? ""), author: (bk.traveler?.name ?? "").split(" ")[0], created_at: D.TODAY, sub_scores: sub, tags: tags as ReviewTag[] | null };
    state.reviewed.add(it.id);
    if (it.type === "buddy") {
      const key = `buddy:${it.ref_id}`;
      (state.reviews[key] ??= []).unshift(review);
      const bd = buddyOf(it.ref_id);
      if (bd) { bd.rating = Math.round(((bd.rating * bd.review_count + rating) / (bd.review_count + 1)) * 10) / 10; bd.review_count += 1; }
    }
    return review;
  }
  if ((x = m(/^\/bookings\/(\d+)\/album$/)) && method === "GET") {
    const bk = state.bookings.find((v) => v.id === Number(x![1])) ?? fail(404, "NOT_FOUND", "예약 없음");
    const items = bk.items.filter((i) => i.type === "buddy" && i.album).map((i) => {
      const acts = state.activities.filter((a) => a.item_id === i.id);
      return { item_id: i.id, buddy_name: buddyOf(i.ref_id)?.name ?? "", date: i.date_from ?? "", places: acts.flatMap((a) => a.places), photos: acts.flatMap((a) => a.photos) };
    });
    return { items };
  }
  if ((x = m(/^\/bookings\/(\d+)\/chat$/)) && method === "GET") return list([{ id: 1, sender: "buddy", text: "내일 2시에 정문에서 봐요!", translated_text: "See you at the main gate at 2 tomorrow!", created_at: "2027-01-12T20:00:00Z" }, { id: 2, sender: "tourist", text: "See you there 😊", translated_text: "거기서 봐요 😊", created_at: "2027-01-12T20:05:00Z" }]);
  if ((x = m(/^\/bookings\/(\d+)$/)) && method === "GET") {
    const bk = state.bookings.find((v) => v.id === Number(x![1])) ?? fail(404, "NOT_FOUND", "예약 없음");
    const out = decorate(bk);
    if (role === "buddy") { // BK-03: 버디는 이름·국적·인원만, 자기 항목만
      const bid = myBuddyId();
      out.traveler = { name: bk.traveler?.name ?? "", nationality: bk.traveler?.nationality ?? "", guests: bk.traveler?.guests ?? 1 } as Traveler;
      out.items = out.items.filter((i) => i.type === "buddy" && i.ref_id === bid);
    }
    return out;
  }
  if (method === "GET" && path === "/notifications") return list(role === "buddy" ? D.buddyNotifications : state.notifications);

  // ---- 신고
  if (method === "POST" && path === "/reports") {
    const f = findItem(Number(b.booking_item_id)) ?? fail(404, "NOT_FOUND", "예약 항목 없음");
    if (f.it.type !== "buddy") fail(422, "VALIDATION", "버디 항목만 신고할 수 있어요");
    if (state.owner[f.b.id] !== myEmail()) fail(403, "FORBIDDEN", "내 예약만 신고할 수 있어요");
    const category = String(b.category) as ReportCategory;
    if (!(category in REPORT_CATEGORY)) fail(422, "VALIDATION", "신고 유형을 골라 주세요");
    const text = String(b.text ?? "").trim();
    if (!text) fail(422, "VALIDATION", "무슨 일이 있었는지 적어 주세요");
    if (isStr(b.photo_url) && !photosOk([b.photo_url])) fail(422, "PHOTO_URL", "사진은 앱에서 올린 것만 쓸 수 있어요 (POST /uploads)");
    const row: D.ReportRow = { id: state.nextId++, booking_item_id: f.it.id, reporter: f.b.traveler?.name ?? "", buddy_id: f.it.ref_id, category, text, photo_url: isStr(b.photo_url) ? b.photo_url : null, status: "open", action: null, auto_suspended: false, created_at: nowIso(), resolved_at: null };
    state.reports.unshift(row);
    if (reportCount(row.buddy_id) >= REPORT_SUSPEND_AT && statusOf(row.buddy_id) === "approved") { state.buddyStatus[row.buddy_id] = "suspended"; row.auto_suspended = true; }
    return toReport(row);
  }

  // ---- 버디 본인 (/buddy/*)
  if (method === "GET" && path === "/buddy/apply") return applyOut(applyStateFor(myEmail()));
  if (method === "POST" && path === "/buddy/apply/email") {
    const email = String(b.email ?? "").trim().toLowerCase();
    const u = univByEmail(email) ?? fail(422, "NOT_SEONGBUK_SCHOOL", "성북구 대학 메일이 아니에요. 학교 메일(ac.kr)로 다시 입력해 주세요");
    return { sent: true, university: u.name, dev_code: D.OTP_CODE };
  }
  if (method === "POST" && path === "/buddy/apply/verify") {
    const email = String(b.email ?? "").trim().toLowerCase();
    const u = univByEmail(email) ?? fail(422, "NOT_SEONGBUK_SCHOOL", "성북구 대학 메일이 아니에요");
    if (String(b.code ?? "") !== D.OTP_CODE) fail(422, "BAD_CODE", "인증번호가 맞지 않아요");
    if (b.korean_national !== true) fail(422, "NOT_KOREAN_NATIONAL", "한국 국적 학생만 버디로 활동할 수 있어요");
    const birth = String(b.birth_date ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) fail(422, "VALIDATION", "생년월일을 입력해 주세요");
    if (ageOn(birth, D.TODAY) < BUDDY_MIN_AGE) fail(422, "TOO_YOUNG", `만 ${BUDDY_MIN_AGE}세 이상만 버디로 활동할 수 있어요`);
    const s = applyStateFor(myEmail());
    Object.assign(s, { school_email: email, university: u.name, university_id: u.id, email_verified: true, korean_national: true, birth_date: birth, status: s.status === "none" ? "pending" : s.status, eligibility: "school_email", school_name: null });
    const cu = me(); if (cu) state.currentUser = { ...cu, university_id: u.id, birth_date: birth };
    return applyOut(s);
  }
  if (method === "POST" && path === "/buddy/apply/residence") {
    // v3.7 성북구 거주 경로: 주소 증빙 + 재학 증명 사진(/uploads 주소). 운영자가 승인 때 확인
    const name = String(b.school_name ?? "").trim();
    if (name.length < 2) fail(422, "VALIDATION", "다니는 대학 이름을 적어 주세요");
    if (!isStr(b.residence_proof_url) || !isStr(b.enrollment_proof_url) || !photosOk([b.residence_proof_url, b.enrollment_proof_url])) fail(422, "PHOTO_URL", "사진은 앱에서 올린 것만 쓸 수 있어요 (POST /uploads)");
    if (b.korean_national !== true) fail(422, "NOT_KOREAN_NATIONAL", "한국 국적 학생만 버디로 활동할 수 있어요");
    const birth = String(b.birth_date ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) fail(422, "VALIDATION", "생년월일을 입력해 주세요");
    if (ageOn(birth, D.TODAY) < BUDDY_MIN_AGE) fail(422, "TOO_YOUNG", `만 ${BUDDY_MIN_AGE}세 이상만 버디로 활동할 수 있어요`);
    const s = applyStateFor(myEmail());
    const u = D.universities.find((x) => x.name === name);
    Object.assign(s, { eligibility: "residence", school_name: name, university: name, university_id: u?.id ?? null, korean_national: true, birth_date: birth,
      residence_proof_url: b.residence_proof_url, enrollment_proof_url: b.enrollment_proof_url, status: s.status === "none" ? "pending" : s.status });
    return applyOut(s);
  }
  const needEligible = () => { const s = applyStateFor(myEmail()); if (!eligibleOf(s)) fail(409, "CONFLICT", "자격 확인(학교 메일 인증 또는 성북구 거주 확인)을 먼저 해 주세요"); return s; };
  if (method === "POST" && path === "/buddy/apply/agree") { const s = needEligible(); s.code_agreed = true; return applyOut(s); }
  if (method === "GET" && path === "/buddy/apply/education") return educationOut(applyStateFor(myEmail()));
  if ((x = m(/^\/buddy\/apply\/education\/([a-z_]+)$/)) && method === "POST") {
    if (!ALL_VIDEOS.includes(x[1])) fail(404, "NOT_FOUND", "없는 교육 영상이에요");
    const s = needEligible();
    if (!s.videos.includes(x[1])) s.videos = ALL_VIDEOS.filter((v) => v === x![1] || s.videos.includes(v));
    return educationOut(s);
  }
  const needEducation = () => { const s = needEligible(); if (!ALL_VIDEOS.every((v) => s.videos.includes(v))) fail(409, "EDUCATION_NOT_DONE", "교육 영상을 모두 본 뒤에 퀴즈를 풀 수 있어요"); return s; };
  const shownQuiz = () => D.quiz.filter((qq) => D.QUIZ_SHOWN.includes(qq.id));
  if (method === "GET" && path === "/buddy/apply/quiz") { needEducation(); return { questions: shownQuiz().map(({ id, text, options }) => ({ id, text, options })) }; }
  if (method === "POST" && path === "/buddy/apply/quiz") {
    const answers = (b.answers ?? {}) as Record<string, number>;
    const s = needEducation();
    const score = shownQuiz().filter((qq) => Number(answers[qq.id]) === qq.answer).length;
    s.quiz_score = Math.max(s.quiz_score ?? 0, score);
    return { score, total: QUIZ_TOTAL, passed: score >= QUIZ_PASS };
  }
  if (method === "GET" && path === "/buddy/requests") return list(buddyItems(myBuddyId()).map(({ b: bk, it }) => toBuddyRequest(bk, it)).filter((r) => !q("status") || r.status === q("status")).sort((a, c) => (a.status === "requested" ? 0 : 1) - (c.status === "requested" ? 0 : 1) || c.date.localeCompare(a.date)));
  if (method === "GET" && path === "/buddy/schedule") return list(buddyItems(myBuddyId()).filter(({ it }) => it.status === "confirmed").map(({ b: bk, it }) => toBuddyRequest(bk, it)).sort((a, c) => a.date.localeCompare(c.date)));
  if (method === "GET" && path === "/buddy/availability") return { dates: [...state.availability].sort() };
  if (method === "PUT" && path === "/buddy/availability") { state.availability = new Set((b.dates as string[]) ?? []); return { dates: [...state.availability].sort() }; }
  if (method === "GET" && path === "/buddy/grade") return gradeInfo(myBuddyId());
  if (method === "POST" && path === "/buddy/confirm-active") { if (role && role !== "buddy") fail(403, "FORBIDDEN", "권한이 없습니다"); Object.assign(gradeOf(myBuddyId()), { needs_recheck: false, dormant_since: null }); return gradeInfo(myBuddyId()); }
  if (method === "GET" && path === "/buddy/profile") return buddyProfile(myBuddyId());
  if (method === "PUT" && path === "/buddy/profile") {
    const bd = buddyOf(myBuddyId())!;
    const { bank_account, ...rest } = b as Record<string, unknown> & { bank_account?: string };
    const allowed = ["major", "year", "languages", "interests", "intro", "avatar", "hourly_fee", "personality", "style", "can_help", "can_drive"] as const;
    for (const k of allowed) if (k in rest) (bd as unknown as Record<string, unknown>)[k] = rest[k];
    if (isStr(bank_account)) state.bankAccount = bank_account;
    applyStateFor(myEmail()).profile_done = true;
    return buddyProfile(bd.id);
  }
  if (method === "GET" && path === "/buddy/earnings") {
    const month = q("month") ?? DEFAULT_MONTH;
    const s = buddySettlement(myBuddyId(), month);
    const items = s.items.map((i) => ({ booking_item_id: i.item_id, date: i.date, tourist: `${i.tourist.split(" ")[0]} · ${D.NATIONALITY_KO[findItem(i.item_id)?.b.traveler?.nationality ?? ""] ?? ""}`, activity: `${courseOf(findItem(i.item_id)?.it.course_id)?.title ?? "동네 걷기"} 2h`, amount: i.net, status: (month < DEFAULT_MONTH ? "paid" : "pending") as "paid" | "pending" }));
    const total = items.reduce((t, i) => t + i.amount, 0);
    return { month, period: month, activities: items.length, total_fee: total, paid: items.filter((i) => i.status === "paid").reduce((t, i) => t + i.amount, 0), pending: items.filter((i) => i.status === "pending").reduce((t, i) => t + i.amount, 0), items };
  }
  if (method === "GET" && path === "/buddy/settlement") return buddySettlement(myBuddyId(), q("month") ?? DEFAULT_MONTH);
  if (method === "GET" && path === "/buddy/meal-claims") return list(state.mealClaims.filter((c) => c.buddy_id === myBuddyId() && (!q("item_id") || c.item_id === Number(q("item_id")))).sort((a, c) => c.created_at.localeCompare(a.created_at)).map(toMealClaim));
  if (method === "POST" && path === "/buddy/meal-claims") {
    const f = findItem(Number(b.item_id)) ?? fail(404, "NOT_FOUND", "예약 항목 없음");
    if (f.it.type !== "buddy" || f.it.ref_id !== myBuddyId()) fail(403, "FORBIDDEN", "내 동행 항목만 청구할 수 있어요");
    if (f.it.status !== "confirmed") fail(409, "NOT_CONFIRMED", "확정된 동행만 식비를 청구할 수 있어요");
    const mc = f.it.meal_count ?? 0;
    if (mc <= 0) fail(409, "NO_MEAL", "이 동행에는 식사 옵션이 없어요");
    if (claimsOf(f.it.id).filter((c) => c.status !== "rejected").length >= mc) fail(409, "MEAL_COUNT_EXCEEDED", `식사는 ${mc}회까지 청구할 수 있어요`);
    const amount = Number(b.amount);
    if (!Number.isInteger(amount) || amount <= 0) fail(422, "VALIDATION", "금액을 입력해 주세요");
    if (!String(b.place ?? "").trim()) fail(422, "VALIDATION", "가게 이름을 입력해 주세요");
    if (isStr(b.receipt_url) && !photosOk([b.receipt_url])) fail(422, "PHOTO_URL", "사진은 앱에서 올린 것만 쓸 수 있어요 (POST /uploads)");
    const row: D.MealClaimRow = { id: state.nextId++, item_id: f.it.id, buddy_id: myBuddyId(), date: f.it.date_from ?? D.TODAY, place: String(b.place).trim(), items: String(b.items ?? ""), amount, receipt_url: isStr(b.receipt_url) ? b.receipt_url : null, status: "requested", reason: null, created_at: nowIso() };
    state.mealClaims.unshift(row);
    return toMealClaim(row);
  }
  if (method === "GET" && path === "/buddy/activities") return list(state.activities.filter((a) => a.buddy_id === myBuddyId()).sort((a, c) => c.date.localeCompare(a.date)).map(toActivity));
  if (method === "POST" && path === "/buddy/activities") {
    const itemId = b.item_id == null ? null : Number(b.item_id);
    if (itemId != null) { const f = findItem(itemId); if (!f || f.it.type !== "buddy" || f.it.ref_id !== myBuddyId()) fail(403, "FORBIDDEN", "내 동행 항목만 기록할 수 있어요"); }
    const places = Array.isArray(b.places) ? (b.places as unknown[]).map(String).filter(Boolean) : [];
    if (!isStr(b.date) || places.length === 0) fail(422, "VALIDATION", "날짜와 다녀온 곳을 입력해 주세요");
    if (!photosOk(b.photos)) fail(422, "PHOTO_URL", "사진은 앱에서 올린 것만 쓸 수 있어요 (POST /uploads)");
    const row: D.ActivityRow = { id: state.nextId++, buddy_id: myBuddyId(), item_id: itemId, date: b.date as string, places, foods: isStr(b.foods) ? b.foods : null, note: isStr(b.note) ? b.note : null, photos: Array.isArray(b.photos) ? (b.photos as unknown[]).map(String) : [], created_at: nowIso() };
    state.activities.unshift(row);
    return toActivity(row);
  }

  // ---- 어드민
  if (method === "GET" && path === "/admin/dashboard") return D.dashboard;
  if (method === "GET" && path === "/admin/bookings") return list(adminBookingRows().filter((r) => (!q("type") || r.type === q("type")) && (!q("status") || r.status === q("status")) && (role !== "univ_admin" || !me()?.university_id || r.university_id === me()?.university_id)));
  if (method === "GET" && path === "/admin/buddies") {
    requireOperator(); // v3.3: 버디 승인·목록은 운영팀만
    return list(Object.keys(state.adminInfo).map(Number).map(toAdminBuddy).filter((r): r is AdminBuddyRow => !!r && (!q("status") || r.status === q("status"))));
  }
  if (method === "POST" && path === "/admin/buddies/recompute-grades") {
    requireOperator();
    // v3.7 매달 1일 평가: 이번 달 평가(지난달 동행)를 아직 안 한 버디만. 휴면이어도 평가한다
    const changed = Object.keys(state.grades).map(Number).filter((id) => {
      const g = state.grades[id];
      if (g.evaluated_for === D.EVAL_MONTH) return false;
      const first = !g.approved_on || g.approved_on > `${D.EVAL_MONTH}-01`;
      const nx = decideGrade(g.grade, first, g.last_month_walks, g.reviews, g.rating);
      g.evaluated_for = D.EVAL_MONTH;
      if (nx === g.grade) return false;
      g.grade = nx;
      return true;
    });
    return list(changed.map(toAdminBuddy).filter((r): r is AdminBuddyRow => !!r));
  }
  if ((x = m(/^\/admin\/buddies\/(\d+)$/)) && method === "PATCH") {
    requireOperator();
    const id = Number(x[1]);
    const row = toAdminBuddy(id) ?? fail(404, "NOT_FOUND", "버디 없음");
    const action = String(b.action);
    if (action === "approve") {
      const elig = row.eligibility === "residence"
        ? [!row.residence_proof_url && "성북구 주소 증빙", !row.enrollment_proof_url && "재학 증명"]
        : [!row.school_email_verified && "자격 확인(성북구 대학 메일 또는 성북구 거주)"];
      const missing = [...elig, !row.korean_national && "한국 국적 확인", (row.age ?? 0) < BUDDY_MIN_AGE && `만 ${BUDDY_MIN_AGE}세`, !row.code_agreed && "약속 동의",
        row.videos_watched < row.videos_total && `교육 영상 ${row.videos_watched}/${row.videos_total}`, (row.quiz_score ?? 0) < QUIZ_PASS && `퀴즈 ${row.quiz_score ?? 0}/${QUIZ_TOTAL} (${QUIZ_PASS}점 이상)`].filter(Boolean);
      if (missing.length) fail(409, "NOT_READY", `아직 안 된 항목: ${missing.join(", ")}`);
      state.buddyStatus[id] = "approved";
      gradeOf(id).approved_on ??= D.TODAY;
    } else if (action === "suspend") state.buddyStatus[id] = "suspended";
    else if (action === "unsuspend") state.buddyStatus[id] = "approved";
    else if (action === "reject") state.buddyStatus[id] = "rejected";
    else fail(422, "VALIDATION", "action 은 approve | suspend | unsuspend | reject");
    return toAdminBuddy(id) ?? { id, status: "rejected" };
  }
  if (method === "GET" && path === "/admin/users") return list(Object.values(D.users));
  if (method === "GET" && path === "/admin/settlements") {
    if (role !== "operator" && role !== "univ_admin") fail(403, "FORBIDDEN", "관리자 계정만 볼 수 있어요");
    const month = q("month") ?? DEFAULT_MONTH;
    const univRows: SettlementRow[] = [
      { party_type: "university", party_id: 1, target: "고려대학교 프런티어관", count: 18, revenue: 1890000, fee: 189000, meals: 0, payout: 1701000, status: "pending" },
      { party_type: "university", party_id: 2, target: "국민대학교 생활관", count: 6, revenue: 630000, fee: 63000, meals: 0, payout: 567000, status: "pending" },
    ];
    const buddyRows: SettlementRow[] = [31, 35].map((id) => {
      const s = buddySettlement(id, month);
      return { party_type: "buddy", party_id: id, target: `버디 ${buddyOf(id)?.name ?? ""}`, count: s.walks, revenue: s.gross, album: s.album, fee: s.fee, meals: s.meals_approved, payout: s.payout, status: s.meals_pending > 0 ? "meal_pending" : "pending",
        payout_rate: s.gross ? Math.round((s.net / s.gross) * 1000) / 1000 : null };
    });
    const items = [...univRows, ...buddyRows];
    let refund = 0;
    for (const { it } of state.bookings.flatMap((bk) => bk.items.map((i) => ({ it: i })))) {
      if (it.type !== "buddy" || it.status !== "confirmed" || !(it.date_from ?? "").startsWith(month) || (it.date_from ?? "") > D.TODAY) continue;
      if (sumClaims(it.id, ["requested"]) > 0) continue;
      refund += (it.meal_count ?? 0) * MEAL_LIMIT - sumClaims(it.id, ["approved"]);
    }
    // 판매가 − 원가 = 이익 (원가 = 대학 지급 90% · 버디 지급 = (활동비 + 앨범) × 항목별 정산율, 식비·보증금은 통과 금액이라 뺀다)
    // v3.6: 버디 행 revenue 에 앨범이 들어간다 → 판매가는 활동비(sales_buddy)와 앨범(sales_album)으로 나누고, 앨범 버디 몫은 cost_buddy_album
    const part = (t: SettlementRow["party_type"], k: "revenue" | "fee" | "album") => items.filter((r) => r.party_type === t).reduce((s, r) => s + (r[k] ?? 0), 0);
    const albumItems = [31, 35].flatMap((id) => buddyItems(id)).filter(({ it }) => it.album && it.status === "confirmed" && (it.date_from ?? "").startsWith(month));
    const albumSales = part("buddy", "album");
    const albumCost = albumItems.reduce((s, { it }) => s + buddyNet(payoutBase(activityOf(it), true), rateFor(it)) - buddyNet(activityOf(it), rateFor(it)), 0);
    const salesDorm = part("university", "revenue"), salesBuddy = part("buddy", "revenue") - albumSales;
    const costUni = salesDorm - part("university", "fee"), costBuddy = part("buddy", "revenue") - part("buddy", "fee");
    const sales = salesDorm + salesBuddy + albumSales, profitAmt = sales - costUni - costBuddy;
    const profit = { sales, sales_dorm: salesDorm, sales_buddy: salesBuddy, sales_album: albumSales, cost_university: costUni, cost_buddy: costBuddy, cost_buddy_album: albumCost, cost_other: 0, profit: profitAmt, margin: sales ? Math.round((profitAmt / sales) * 1000) / 1000 : 0 };
    if (role === "univ_admin") { // 대학 담당자: 자기 학교 숙박 행만, 수익 구조 없음
      const mine = univRows.filter((r) => r.party_id === (me()?.university_id ?? 1));
      return { period: { from: `${month}-01`, to: `${month}-31` }, total: mine.reduce((s, r) => s + r.revenue, 0), items: mine, meal_refund_total: 0, profit: null } satisfies Settlements;
    }
    const out: Settlements = { period: { from: `${month}-01`, to: `${month}-31` }, total: items.reduce((s, r) => s + r.revenue + r.meals, 0), items, meal_refund_total: refund, profit };
    return out;
  }
  if (method === "GET" && path === "/admin/meal-claims") { requireOperator(); return list(state.mealClaims.filter((c) => !q("status") || c.status === q("status")).sort((a, c) => c.created_at.localeCompare(a.created_at)).map(toAdminMealClaim)); }
  if ((x = m(/^\/admin\/meal-claims\/(\d+)$/)) && method === "PATCH") {
    requireOperator();
    const c = state.mealClaims.find((v) => v.id === Number(x![1])) ?? fail(404, "NOT_FOUND", "청구 없음");
    if (c.status !== "requested") fail(409, "CONFLICT", "이미 처리한 청구예요");
    if (b.action === "approve") c.status = "approved";
    else if (b.action === "reject") { c.status = "rejected"; c.reason = isStr(b.reason) ? b.reason : null; }
    else fail(422, "VALIDATION", "action 은 approve | reject");
    return toAdminMealClaim(c);
  }
  if (method === "GET" && path === "/admin/reports") { requireOperator(); return list(state.reports.filter((r) => !q("status") || r.status === q("status")).sort((a, c) => c.created_at.localeCompare(a.created_at)).map(toAdminReport)); }
  if ((x = m(/^\/admin\/reports\/(\d+)$/)) && method === "PATCH") {
    requireOperator();
    const r = state.reports.find((v) => v.id === Number(x![1])) ?? fail(404, "NOT_FOUND", "신고 없음");
    const action = String(b.action);
    if (!["warn", "suspend", "unsuspend", "dismiss"].includes(action)) fail(422, "VALIDATION", "action 은 warn | suspend | unsuspend | dismiss");
    r.status = action === "dismiss" ? "dismissed" : "resolved";
    r.action = action; r.resolved_at = nowIso();
    if (action === "suspend") state.buddyStatus[r.buddy_id] = "suspended";
    if (action === "unsuspend") state.buddyStatus[r.buddy_id] = "approved";
    return toAdminReport(r);
  }
  if (method === "GET" && path === "/admin/dorms") return list(D.dorms);
  if (method === "POST" && path === "/admin/dorms") return { id: state.nextId++, ...b };
  if ((x = m(/^\/admin\/dorms\/(\d+)$/)) && method === "PATCH") return { id: Number(x[1]), ...b };
  if ((x = m(/^\/admin\/universities\/(\d+)$/)) && method === "PATCH") return { id: Number(x[1]), ...b };
  if (method === "GET" && path === "/admin/tours") {
    requireOperator();
    const walks = (id: number) => state.bookings.flatMap((bk) => bk.items).filter((i) => i.type === "buddy" && i.course_id === id && i.status !== "cancelled").length;
    return list<AdminCourseRow>(D.tours.map((t) => ({ id: t.id, title: t.title, theme: t.theme, duration_min: t.duration_min, walk_complete: t.walk_complete, route_source: t.route_source ?? "estimate", places: t.places.map((p) => p.name), place_count: t.places.length, story_ready: t.places.filter((p) => !!D.stories[p.id]).length, buddy_walks: walks(t.id) })));
  }

  return fail(404, "NOT_FOUND", `mock: ${method} ${path} 핸들러 없음`);
}
