// 목 API 라우터 — 경로·응답 형식은 docs/api-detail 과 동일. 상태 변경은 메모리에 유지(새로고침 시 초기화).
import type { AiPlan, AiStory, Booking, BuddyMatch, CartItem, ItemStatus, ListResponse, Traveler, User } from "../types";
import * as D from "./data";

const state = {
  bookings: structuredClone(D.bookings),
  buddyRequests: structuredClone(D.buddyRequests),
  adminBookings: structuredClone(D.adminBookings),
  adminBuddies: structuredClone(D.adminBuddies),
  notifications: structuredClone(D.notifications),
  availability: new Set<string>(D.buddies[0].available_dates),
  calendarConnected: false,
  currentUser: null as User | null,
  nextId: 600,
};

const err = (status: number, code: string, message: string) => Object.assign(new Error(message), { status, code });
const list = <T,>(items: T[]): ListResponse<T> => ({ items, next_cursor: null });

function recompute(b: Booking) {
  const ok = (s: ItemStatus) => s === "approved" || s === "confirmed";
  if (b.items.every((i) => ok(i.status))) b.status = "confirmed";
  else if (b.items.every((i) => i.status === "cancelled")) b.status = "cancelled";
  else if (b.items.some((i) => ok(i.status))) b.status = "partially_approved";
  else b.status = "requested";
}

function decideItem(itemId: number, action: "approve" | "reject", reason?: string) {
  for (const b of state.bookings) {
    const it = b.items.find((i) => i.id === itemId);
    if (it) {
      if (it.status !== "requested") throw err(409, "CONFLICT", "이미 결정된 항목");
      it.status = action === "approve" ? "approved" : "rejected";
      it.reject_reason = reason ?? null;
      if (it.type === "buddy" && action === "approve") { it.status = "confirmed"; if (state.calendarConnected) it.google_event_id = "evt_" + itemId; }
      recompute(b);
      state.notifications.unshift({ id: state.nextId++, type: `item_${it.status}`, title: `${it.title} · ${it.status === "rejected" ? "거절됨" : "승인됨"}`, read_at: null, created_at: new Date().toISOString() });
    }
  }
  const r = state.buddyRequests.find((r) => r.item_id === itemId);
  if (r) r.status = action === "approve" ? "confirmed" : "rejected";
  const a = state.adminBookings.find((r) => r.item_id === itemId);
  if (a) a.status = action === "approve" ? (a.type === "buddy" ? "confirmed" : "approved") : "rejected";
}

export async function mockHandlers(method: string, path: string, body?: unknown, query?: Record<string, string | number | undefined>): Promise<unknown> {
  const b = (body ?? {}) as Record<string, unknown>;
  const m = (re: RegExp) => path.match(re);
  let x: RegExpMatchArray | null;

  // ---- 인증
  if (method === "POST" && path === "/auth/google") { const u = D.users["emma@example.com"]; state.currentUser = u; return { access_token: "mock", user: u, needs_role_setup: false }; }
  if (method === "POST" && path === "/auth/login") {
    const u = D.users[String(b.email)];
    if (!u || b.password !== "demo1234") throw err(401, "UNAUTHORIZED", "이메일 또는 비밀번호가 맞지 않습니다");
    state.currentUser = u; return { access_token: "mock", user: u, needs_role_setup: false };
  }
  if (method === "POST" && path === "/auth/signup") { const u: User = { id: 99, name: String(b.name ?? "New User"), email: String(b.email), role: "tourist", university_id: null, language: (b.language as "ko" | "en") ?? "en" }; state.currentUser = u; return { access_token: "mock", user: u, needs_role_setup: false }; }
  if (method === "GET" && path === "/auth/me") { if (!state.currentUser) throw err(401, "UNAUTHORIZED", "로그인이 필요합니다"); return state.currentUser; }
  if (method === "PATCH" && path === "/auth/me") { if (state.currentUser) Object.assign(state.currentUser, b); return state.currentUser; }
  if (method === "PATCH" && path === "/users/me") { if (state.currentUser) Object.assign(state.currentUser, b); return state.currentUser; }
  if (method === "PATCH" && path === "/users/me/role") { if (state.currentUser) state.currentUser.role = b.role as User["role"]; return state.currentUser; }
  if (method === "POST" && path === "/auth/google/calendar") { state.calendarConnected = true; if (state.currentUser) state.currentUser.calendar_connected = true; return { calendar_connected: true }; }
  if (method === "DELETE" && path === "/auth/google/calendar") { state.calendarConnected = false; if (state.currentUser) state.currentUser.calendar_connected = false; return { calendar_connected: false }; }

  // ---- 홈·콘텐츠
  if (method === "GET" && path === "/packages") return list(D.packages);
  if ((x = m(/^\/contents\/(\w+)$/)) && method === "GET") { const lang = String(query?.lang ?? "ko"); return D.contents.find((c) => c.key === x![1] && c.language === lang) ?? D.contents.find((c) => c.key === x![1]) ?? err(404, "NOT_FOUND", "콘텐츠 없음"); }

  // ---- 숙박
  if (method === "GET" && path === "/universities") return list(D.universities);
  if (method === "GET" && path === "/dorms") return list(D.dorms.filter((d) => !query?.university_id || d.university.id === Number(query.university_id)));
  if ((x = m(/^\/dorms\/(\d+)$/)) && method === "GET") return D.dorms.find((d) => d.id === Number(x![1])) ?? err(404, "NOT_FOUND", "객실 없음");

  // ---- 투어·장소
  if (method === "GET" && path === "/tours") return list(D.tours.filter((t) => (!query?.theme || t.theme === query.theme) && (!query?.language || t.languages.includes(String(query.language)))));
  if ((x = m(/^\/tours\/(\d+)\/reviews$/)) && method === "GET") return list(D.reviews[`tour:${x[1]}`] ?? []);
  if ((x = m(/^\/tours\/(\d+)$/)) && method === "GET") return D.tours.find((t) => t.id === Number(x![1])) ?? err(404, "NOT_FOUND", "코스 없음");
  if ((x = m(/^\/places\/(\d+)$/)) && method === "GET") return D.places.find((p) => p.id === Number(x![1])) ?? err(404, "NOT_FOUND", "장소 없음");

  // ---- 버디 (관광객 측)
  if (method === "GET" && path === "/buddies") return list(D.buddies.filter((bd) => (!query?.language || bd.languages.includes(String(query.language))) && (!query?.date || bd.available_dates.includes(String(query.date))) && (!query?.interest || bd.interests.includes(String(query.interest)))));
  if ((x = m(/^\/buddies\/(\d+)\/reviews$/)) && method === "GET") return list(D.reviews[`buddy:${x[1]}`] ?? []);
  if ((x = m(/^\/buddies\/(\d+)$/)) && method === "GET") return D.buddies.find((bd) => bd.id === Number(x![1])) ?? err(404, "NOT_FOUND", "버디 없음");

  // ---- AI
  if (method === "POST" && path === "/ai/plan") {
    const plan: AiPlan = { plan_id: "pl_" + Math.random().toString(36).slice(2, 5), reason: "문학·독립운동 관심에 맞춰 한용운·이태준이 살던 성북동 코스를 넣었어요. 숙소에서 걸어서 20분.", total_price: 155000,
      days: [
        { date: "2027-01-12", items: [{ time: "15:00", type: "dorm", ref_id: 10, title: "A대학교 국제관 체크인", price: 105000, meta: "숙박 · 2인실 · ₩35,000/박 · 3박" }] },
        { date: "2027-01-13", items: [{ time: "10:00", type: "tour", ref_id: 3, title: "문인의 성북동 산책", price: 20000, meta: "투어 · 해설사 · 2시간" }, { time: "14:00", type: "buddy", ref_id: 31, title: "버디와 캠퍼스·동네 걷기", price: 30000, meta: "버디 지우 · 한/영/일" }] },
        { date: "2027-01-14", items: [{ time: null, type: "free", ref_id: null, title: "정릉 · 선잠박물관 추천", price: 0, meta: "자유 일정 · AI 제안" }] },
        { date: "2027-01-15", items: [{ time: "11:00", type: "free", ref_id: null, title: "체크아웃", price: 0, meta: "숙박" }] },
      ] };
    return plan;
  }
  if (method === "POST" && path === "/ai/story") {
    const s = D.stories[Number(b.place_id)];
    if (!s) return { answer: "자료에 없는 장소예요.", sources: [], grounded: false } satisfies AiStory;
    const q = String(b.question ?? "").toLowerCase().trim();
    if (!q) return { answer: s.intro, sources: s.sources, grounded: true } satisfies AiStory;
    const hit = s.qa.find((p) => q.includes(p.q.split(" ")[0]) || q.includes("north") || q.includes("북"));
    return hit ? ({ answer: hit.a, sources: s.sources, grounded: true } satisfies AiStory) : ({ answer: "자료에 없는 내용이에요. 해설사에게 물어봐 주세요.", sources: s.sources, grounded: false } satisfies AiStory);
  }
  if (method === "POST" && path === "/ai/buddy-match") return { reason: "문학 관심·영어 가능한 순으로 골랐어요", matches: [{ buddy_id: 31, score: 0.92, reason: "시 전공, 영어 토론 동아리" }, { buddy_id: 32, score: 0.81, reason: "성북동 답사 동아리" }, { buddy_id: 33, score: 0.74, reason: "교환학생 버디 경험 2회" }] } satisfies BuddyMatch;
  if (method === "POST" && path === "/ai/buddy-brief") return { brief: "오전에 심우장·수연산방 투어를 들었어요. 시집 이야기로 시작하면 좋아요." };

  // ---- 예약
  if (method === "POST" && path === "/bookings") {
    const items = (b.items as CartItem[]) ?? [];
    const id = state.nextId++;
    const booking: Booking = { id, code: `SB-2027-${String(id).padStart(4, "0")}`, status: "requested", total_price: items.reduce((s, i) => s + i.price, 0), platform_fee: 0, traveler: b.traveler as Traveler, created_at: new Date().toISOString(),
      items: items.map((i, k) => ({ id: id * 10 + k, type: i.type, ref_id: i.ref_id, title: i.title, meta: i.meta, price: i.price, status: i.type === "tour" ? "confirmed" : "requested", date_from: i.date_from ?? i.date, date_to: i.date_to, time: i.time })) };
    booking.platform_fee = Math.round(booking.total_price * 0.1);
    recompute(booking);
    state.bookings.unshift(booking);
    for (const it of booking.items) {
      state.adminBookings.unshift({ booking_id: id, item_id: it.id, code: booking.code, tourist: booking.traveler?.name ?? "", nationality: booking.traveler?.nationality ?? "", type: it.type, title: it.title, schedule: it.meta, price: it.price, status: it.status, university_id: 1 });
      if (it.type === "buddy") state.buddyRequests.unshift({ item_id: it.id, booking_id: id, booking_code: booking.code, tourist: { name: booking.traveler?.name ?? "", nationality: booking.traveler?.nationality ?? "", language: "영어" }, date: it.date_from ?? "", time: it.time ?? "", duration_min: 120, interests: ["한국 문학"], status: "requested", ai_brief: "새 요청이에요. 관심사 기준으로 동선을 준비해 보세요." });
    }
    return booking;
  }
  if (method === "GET" && path === "/bookings/me") return list(state.bookings);
  if ((x = m(/^\/bookings\/(\d+)\/items\/(\d+)$/)) && method === "PATCH") { decideItem(Number(x[2]), b.action as "approve" | "reject", b.reason as string | undefined); return state.bookings.find((bk) => bk.id === Number(x![1]))?.items.find((i) => i.id === Number(x![2])) ?? { ok: true }; }
  if ((x = m(/^\/bookings\/(\d+)\/cancel$/)) && method === "POST") {
    const id = Number(x![1]);
    const bk = state.bookings.find((bk) => bk.id === id);
    if (bk) { bk.items.forEach((i) => (i.status = "cancelled")); bk.status = "cancelled"; }
    const rows = state.adminBookings.filter((r) => r.booking_id === id);
    if (!bk && rows.length === 0) throw err(404, "NOT_FOUND", "예약 없음");
    rows.forEach((r) => (r.status = "cancelled"));
    state.buddyRequests.filter((r) => rows.some((a) => a.item_id === r.item_id)).forEach((r) => (r.status = "cancelled"));
    return bk ?? { id, status: "cancelled" };
  }
  if ((x = m(/^\/bookings\/(\d+)\/pay$/)) && method === "POST") { const bk = state.bookings.find((bk) => bk.id === Number(x![1])); if (bk) bk.paid_at = new Date().toISOString(); return { status: "paid", paid_at: bk?.paid_at }; }
  if ((x = m(/^\/bookings\/(\d+)\/checkin-guide$/)) && method === "GET") return { building: "A대학교 국제관", address: "서울 성북구", checkin: "15:00", checkout: "11:00", wifi: "AUNIV-GUEST", steps: ["국제관 1층 안내데스크에서 이름 확인", "여권 제시 후 출입카드 수령", "3층 방 배정"], emergency: ["대학 담당자 02-000-0000", "운영자 010-0000-0000", "112 / 119 / 1330"] };
  if ((x = m(/^\/bookings\/(\d+)\/reviews$/)) && method === "POST") return { id: state.nextId++, ...b, created_at: new Date().toISOString() };
  if ((x = m(/^\/bookings\/(\d+)\/chat$/)) && method === "GET") return list([{ id: 1, sender: "buddy", text: "내일 2시에 정문에서 봐요!", translated_text: "See you at the main gate at 2 tomorrow!", created_at: "2027-01-12T20:00:00Z" }, { id: 2, sender: "tourist", text: "See you there 😊", translated_text: "거기서 봐요 😊", created_at: "2027-01-12T20:05:00Z" }]);
  if ((x = m(/^\/bookings\/(\d+)$/)) && method === "GET") return state.bookings.find((bk) => bk.id === Number(x![1])) ?? err(404, "NOT_FOUND", "예약 없음");
  if (method === "GET" && path === "/notifications") return list(state.notifications);

  // ---- 버디 측
  if (method === "GET" && path === "/buddy/requests") return list(state.buddyRequests.filter((r) => !query?.status || r.status === query.status));
  if (method === "GET" && path === "/buddy/schedule") return list(state.buddyRequests.filter((r) => r.status === "confirmed"));
  if (method === "GET" && path === "/buddy/availability") return { dates: [...state.availability].sort() };
  if (method === "PUT" && path === "/buddy/availability") { state.availability = new Set((b.dates as string[]) ?? []); return { dates: [...state.availability].sort() }; }
  if (method === "GET" && path === "/buddy/profile") return D.buddies[0];
  if (method === "PUT" && path === "/buddy/profile") return { ...D.buddies[0], ...b };
  if (method === "GET" && path === "/buddy/earnings") return { month: "2027-01", activities: 8, total_fee: 240000, paid: 150000, pending: 90000, items: D.buddyEarnings };

  // ---- 어드민
  if (method === "GET" && path === "/admin/dashboard") return D.dashboard;
  if (method === "GET" && path === "/admin/bookings") return list(state.adminBookings.filter((r) => (!query?.type || r.type === query.type) && (!query?.status || r.status === query.status)));
  if (method === "GET" && path === "/admin/buddies") return list(state.adminBuddies.filter((r) => !query?.status || r.status === query.status));
  if ((x = m(/^\/admin\/buddies\/(\d+)$/)) && method === "PATCH") { const r = state.adminBuddies.find((r) => r.id === Number(x![1])); if (r) r.status = b.action === "approve" ? "approved" : "suspended"; return r; }
  if (method === "GET" && path === "/admin/users") return list(Object.values(D.users));
  if (method === "GET" && path === "/admin/settlements") return { total: 3105000, items: [{ target: "A대학교 국제관", count: 18, revenue: 1890000, fee: 189000, payout: 1701000, status: "지급 예정 2/28" }, { target: "B대학교 생활관", count: 6, revenue: 630000, fee: 63000, payout: 567000, status: "지급 예정 2/28" }, { target: "해설사 박해설", count: 9, revenue: 180000, fee: 18000, payout: 162000, status: "지급 완료" }] };
  if (method === "GET" && path === "/admin/dorms") return list(D.dorms);
  if (method === "POST" && path === "/admin/dorms") return { id: state.nextId++, ...b };
  if ((x = m(/^\/admin\/dorms\/(\d+)$/)) && method === "PATCH") return { id: Number(x[1]), ...b };
  if ((x = m(/^\/admin\/universities\/(\d+)$/)) && method === "PATCH") return { id: Number(x[1]), ...b };
  if (method === "GET" && path === "/admin/tours") return list(D.tours);

  throw err(404, "NOT_FOUND", `mock: ${method} ${path} 핸들러 없음`);
}
