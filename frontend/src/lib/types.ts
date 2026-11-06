// API 응답 타입 — docs/api-detail/*.md + docs/v3/CONTRACT.md 와 같은 필드명
// v3: 해설사(guide) 역할 삭제, 예약 항목은 dorm | buddy, 투어(tours)는 무료 AI 산책 코스.
export type Role = "tourist" | "buddy" | "univ_admin" | "operator";
export type Lang = "ko" | "en";
/** 예약(장바구니·예약 항목) 유형. 코스는 예약 항목이 아니다 (type="tour" → 422 COURSE_NOT_BOOKABLE) */
export type ItemType = "dorm" | "buddy";
export type ItemStatus = "requested" | "approved" | "rejected" | "confirmed" | "cancelled";
export type BookingStatus = "requested" | "partially_approved" | "confirmed" | "cancelled";

// ---- 코드값 (CONTRACT §3, 라벨은 src/lib/codes.ts)
export type Diet = "vegan" | "vegetarian" | "halal" | "no_pork" | "no_beef" | "no_alcohol";
export type Allergy = "mushroom" | "nuts" | "seafood" | "dairy" | "egg" | "gluten";
export type Pace = "slow" | "normal";
export type DormRequestKey = "late_checkin" | "quiet_room" | "low_floor";
export type Personality = "calm" | "lively" | "listener" | "humor";
export type WalkStyle = "slow_walk" | "explore" | "cafe_break" | "photo_walk";
export type CanHelp = "vegan_food" | "halal_food" | "photo" | "subway" | "shopping";
export type SubScoreKey = "kind" | "talk" | "punctual" | "local";
export type SubScores = Record<SubScoreKey, number>;
export type ReviewTag = "fun_talk" | "knows_food" | "good_photos" | "cares_requests" | "easy_guide";
export type ReportCategory = "no_show" | "rude" | "money" | "unsafe" | "other";
export type ReportStatus = "open" | "resolved" | "dismissed";
export type ReportAction = "warn" | "suspend" | "unsuspend" | "dismiss";
export type MealClaimStatus = "requested" | "approved" | "rejected";
export type BuddyStatus = "pending" | "approved" | "suspended";
export type PlanWarning = "NO_BUDDY" | "OVER_BUDGET";

export interface User {
  id: number; name: string; email: string; role: Role; university_id: number | null;
  language: Lang; avatar_url?: string | null; calendar_connected?: boolean; birth_date?: string | null;
}
export interface TokenOut { access_token: string; user: User; needs_role_setup: boolean }

export interface University { id: number; name: string; name_en: string; open_from?: string; open_to?: string; email_domains?: string[] | null }
export interface DormRoom {
  id: number; university: University; building: string; room_type: "single" | "double" | "twin";
  price_per_night: number; open_from: string; open_to: string; available_rooms: number;
  photos: string[]; rules: string[];
}
/** 레거시: 코스에 남아 있을 수 있는 해설사 정보 (v3에서는 항상 null) */
export interface Guide { id: number; name: string; license: string; languages: string[] }
export interface TourPlace { order: number; id: number; name: string; name_en: string; lat: number; lng: number; stay_min: number }
/** 무료 AI 산책 코스 (경로·테이블 이름은 tours 그대로). price 는 항상 0, guide 는 null */
export interface Tour {
  id: number; title: string; title_en: string; theme: string; guide: Guide | null; duration_min: number; price: number;
  operating_days: string[]; languages: string[]; meeting_point: string; places: TourPlace[]; description?: string;
}
export type Course = Tour;
export interface Place {
  id: number; name: string; name_en: string; lat: number; lng: number; address?: string; hours?: string;
  closed_days?: string[]; fee: number; need_reservation: boolean; stay_min: number; tags: string[];
}

/** 버디 공개 활동 기록 (여행자 이름 없음) — BuddyDetailOut.recent_activities, GET /buddies/{id}/activities */
export interface PublicActivity { date: string; places: string[]; foods?: string | null; photos?: string[] }
export interface Buddy {
  id: number; name: string; university: string; university_id?: number; major: string; year: number; languages: string[];
  interests: string[]; intro: string; avatar: string; available_dates: string[]; rating: number; review_count: number;
  hourly_fee?: number;
  personality: Personality[]; style: WalkStyle[]; can_help: CanHelp[];
  /** 후기 세부 점수 평균. 후기가 없으면 null */
  sub_scores: SubScores | null;
  /** 많이 받은 후기 태그 최대 3개 */
  tags_top: ReviewTag[];
  walk_count: number;
  verified: { school_email: boolean; trained: boolean };
  /** BD-02 상세에서만 (최대 3개) */
  recent_activities?: PublicActivity[];
  reviews?: Review[];
}
export type BuddyDetail = Buddy & { recent_activities: PublicActivity[] };
/** PUT /buddy/profile 응답·GET /buddy/profile */
export type BuddyProfile = Buddy & { status?: BuddyStatus; bank_account?: string | null; school_email?: string | null };

export interface Package {
  id: number; title: string; title_en: string; description: string; nights: number; total_price: number;
  cover_image?: string; dorm_room_id?: number; tour_id?: number; buddy_profile_id?: number;
}
export interface PlanItem {
  time: string | null; type: ItemType | "course" | "free"; ref_id: number | null; title: string; price: number; meta?: string;
  /** buddy 항목: 같이 걸을 코스 */
  course_id?: number | null;
  duration_min?: number | null;
}
export interface PlanDay { date: string; items: PlanItem[] }
export interface AiPlan { plan_id: string; reason: string; total_price: number; days: PlanDay[]; warnings: PlanWarning[]; ai?: boolean }
export interface AiStory { answer: string; sources: { title: string; url?: string }[]; grounded: boolean }
export interface BuddyMatch { reason: string; matches: { buddy_id: number; score: number; reason: string }[] }

// ---- 요청 사항
/** 버디 항목 요청: places 는 place_id 최대 3개, note 는 300자 이내 */
export interface BuddyRequestBody { diet: Diet[]; allergies: Allergy[]; pace: Pace; places: number[]; note: string }
export type DormRequest = Record<DormRequestKey, boolean>;
export type ItemRequest = BuddyRequestBody | DormRequest;

/** 장바구니 항목 = POST /bookings items[] (BookingItemIn). price 는 화면 표시용 항목 총액 */
export interface CartItem {
  type: ItemType; ref_id: number; title: string; meta: string;
  /** 항목 총액. buddy = hourly_fee×시간 + (album ? ALBUM_FEE : 0) + meal_count×MEAL_LIMIT */
  price: number;
  date_from?: string; date_to?: string; date?: string; time?: string; duration_min?: number; guests?: number;
  request?: BuddyRequestBody | DormRequest | null;
  /** buddy 항목 */
  course_id?: number | null; course_title?: string | null; meal_count?: number; album?: boolean;
  /** buddy 항목 표시용: 시간당 활동비 (가격 다시 계산할 때) */
  hourly_fee?: number;
  /** buddy 항목 표시용: 버디 대학 (같은 학교 안내) */
  university_id?: number;
}
export interface Traveler { name: string; nationality: string; email: string; passport_no?: string; emergency_contact?: string; guests?: number; note?: string }
export interface BookingItem {
  id: number; type: ItemType; ref_id: number; title: string; meta: string; status: ItemStatus; price: number;
  date_from?: string; date_to?: string; time?: string; duration_min?: number | null;
  reject_reason?: string | null; google_event_id?: string | null;
  request?: BuddyRequestBody | DormRequest | null;
  course_id?: number | null; course_title?: string | null;
  meal_count?: number;
  /** meal_count × MEAL_LIMIT */
  meal_deposit?: number;
  /** 식비 청구 중 requested + approved 합 */
  meal_used?: number;
  /** approved 합 */
  meal_approved?: number;
  /** meal_deposit − meal_approved (여행 끝나기 전엔 예정액) */
  meal_refund?: number;
  album?: boolean;
  album_photos?: number;
  reviewed?: boolean;
  /** confirmed && date_from ≤ 오늘 && 후기 없음 */
  can_review?: boolean;
}
export interface Booking {
  id: number; code: string; status: BookingStatus; total_price: number; platform_fee: number;
  traveler?: Traveler; items: BookingItem[]; created_at: string; paid_at?: string | null; cancelled_at?: string | null;
  payment?: PaymentSummary | null;
}
export interface PaymentSummary {
  order_id: string; status: "READY" | "DONE" | "CANCELED" | "PARTIAL_CANCELED" | "FAILED"; amount: number; method: string | null;
  approved_at: string | null; receipt_url: string | null; canceled_amount: number; provider: "toss" | "paypal" | "mock";
  currency: "KRW" | "USD"; foreign_amount: string | null;
}
export interface Review {
  id: number; rating: number; text: string; author: string; created_at: string;
  sub_scores?: SubScores | null; tags?: ReviewTag[] | null;
}
/** POST /bookings/{id}/reviews body */
export interface ReviewIn { item_id: number; rating: number; text?: string; sub_scores?: SubScores; tags?: ReviewTag[] }
/** GET /bookings/{id}/album */
export interface AlbumItem { item_id: number; buddy_name: string; date: string; places: string[]; photos: string[] }
export interface Album { items: AlbumItem[] }
export interface Notification { id: number; type: string; title: string; body?: string; read_at: string | null; created_at: string }
export interface ContentDoc { key: string; language: Lang; title: string; body: string }

// ---- 신고 (POST /reports)
export interface ReportIn { booking_item_id: number; category: ReportCategory; text: string; photo_url?: string | null }
export interface Report {
  id: number; booking_item_id: number | null; buddy_id: number; category: ReportCategory; text: string; photo_url: string | null;
  status: ReportStatus; action: string | null; auto_suspended: boolean; created_at: string; resolved_at?: string | null;
}

// ---- 버디 측
export interface BuddyRequest {
  item_id: number; booking_id: number; booking_code: string; tourist: { name: string; nationality: string; language: string };
  date: string; time: string; duration_min: number; interests: string[]; status: ItemStatus; ai_brief?: string;
  price?: number;
  /** 본인 항목 요청 사항 (식단·알레르기·속도·장소·메모) */
  request?: BuddyRequestBody | null;
  course_id?: number | null; course_title?: string | null;
  meal_count?: number; album?: boolean;
  /** 같은 예약의 숙박 (화면 보조, 없을 수 있음) */
  stay?: { title: string; date_from: string; date_to: string } | null;
  /** 이 항목에 올린 식비 청구 수 (화면 보조, 없을 수 있음) */
  meal_claims?: number;
}
export interface BuddyEarning { date: string; tourist: string; activity: string; amount: number; status: "pending" | "paid"; booking_item_id?: number }
export interface BuddyEarnings { month: string; period?: string; activities: number; total_fee: number; paid: number; pending: number; items: BuddyEarning[] }

/** 식비 청구 — POST/GET /buddy/meal-claims */
export interface MealClaimIn { item_id: number; place: string; items: string; amount: number; receipt_url?: string | null }
export interface MealClaim {
  id: number; item_id: number; booking_code: string; tourist: string; date: string; place: string; items: string; amount: number;
  /** 1회 한도 (MEAL_LIMIT) */
  limit: number;
  /** amount > limit */
  over_limit: boolean;
  status: MealClaimStatus; reason: string | null; created_at: string; receipt_url?: string | null;
}
/** 활동 기록 — POST/GET /buddy/activities */
export interface ActivityIn { item_id?: number | null; date: string; places: string[]; foods?: string; note?: string; photos?: string[] }
export interface Activity {
  id: number; item_id: number | null; date: string; places: string[]; foods: string | null; note: string | null; photos: string[];
  created_at: string; tourist?: string | null;
}
/** GET /buddy/settlement?month= */
export interface BuddySettlementItem {
  item_id: number; date: string; tourist: string; gross: number; fee: number; meal_approved: number; meal_pending: number; net: number;
  status: "confirmed" | "meal_pending";
}
export interface BuddySettlement {
  month: string; pay_date: string; account: string | null; walks: number; gross: number; fee: number; net: number;
  meals_approved: number; meals_pending: number; payout: number; items: BuddySettlementItem[];
}
/** 버디 지원 5단계 — GET /buddy/apply */
export interface BuddyApplyStatus {
  email_verified: boolean; school_email: string | null; university: string | null; age_ok: boolean; code_agreed: boolean;
  quiz_score: number | null; quiz_passed: boolean; profile_done: boolean;
  status: BuddyStatus | "none";
}
export interface BuddyApplyEmailOut { sent: boolean; university: string; dev_code?: string | null }
export interface QuizQuestion { id: number; text: string; options: string[] }
export interface QuizResult { score: number; total: number; passed: boolean }

// ---- 어드민
export interface Dashboard {
  period: { from: string; to: string }; bookings: number; pending: number; nights: number;
  dorm_revenue: number; platform_fee: number; fee_rate: number;
  by_status: Record<BookingStatus | string, number>; daily: { date: string; bookings: number; revenue: number }[];
}
export interface AdminBookingRow {
  booking_id: number; item_id: number; code: string; tourist: string; nationality: string; type: ItemType;
  title: string; schedule: string; price: number; status: ItemStatus; university_id?: number;
}
export interface AdminBuddyRow {
  id: number; name: string; email: string; major: string; languages: string[]; status: BuddyStatus;
  university?: string; university_id?: number; year?: number;
  /** 만 나이 (생년월일 없으면 null) */
  age: number | null;
  school_email_verified: boolean; code_agreed: boolean; quiz_score: number | null; report_count: number; can_help: CanHelp[];
  walk_count?: number; rating?: number;
}
export interface AdminCourseRow {
  id: number; title: string; theme: string; duration_min: number; places: string[]; place_count: number;
  /** 이야기 자료가 있는 장소 수 */
  story_ready: number;
  /** 이 코스를 고른 버디 항목 수 */
  buddy_walks: number;
}
export interface AdminMealClaimRow extends MealClaim {
  buddy_name: string; deposit: number; deposit_left: number; request_summary: string;
}
export interface AdminReportRow {
  id: number; created_at: string; buddy_id: number; buddy_name: string; buddy_university: string; reporter: string; booking_code: string | null;
  category: ReportCategory; text: string; photo_url: string | null; count_for_buddy: number; status: ReportStatus; action: string | null;
  auto_suspended: boolean; buddy_status: BuddyStatus;
}
export interface SettlementRow {
  party_type: "university" | "buddy"; party_id: number; target: string; count: number; revenue: number; fee: number;
  /** 승인된 식비 (버디만, 수수료 없음) */
  meals: number;
  payout: number; status: string;
}
export interface Settlements {
  period?: { from: string; to: string }; total: number; items: SettlementRow[];
  /** 여행자에게 돌려줄 남은 식비 보증금 합 */
  meal_refund_total: number;
}
export interface ListResponse<T> { items: T[]; next_cursor: string | null }
