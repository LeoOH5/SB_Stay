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
/** v3.2 버디 등급 (라벨·기준은 codes.ts GRADE·GRADE_RULES) */
export type BuddyGrade = "basic" | "growth" | "top";

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
export interface TourPlace {
  order: number; id: number; name: string; name_en: string;
  /** 좌표가 없으면 null (그 구간 걷는 시간은 빠진다) */
  lat: number | null; lng: number | null;
  /** 이 코스에서 머무는 시간 */
  stay_min: number;
  /** v3.5 장소 대표 사진. 없으면 화면은 색 블록 */
  photo_url?: string | null; photo_credit?: string | null;
}
/** v3.8 걷는 길 출처: route = OpenStreetMap 실제 도보 경로 · estimate = 직선 × 1.3 추정 */
export type LegSource = "route" | "estimate";
/** v3.8 코스 전체: 모든 구간 실제 경로 / 전부 추정 / 섞임 */
export type RouteSource = LegSource | "mixed";
/** [위도, 경도] */
export type LatLng = [number, number] | number[];
/** v3.5 장소 → 다음 장소 걷는 구간 (4 km/h). 좌표가 없으면 walk_m·walk_min null.
 *  v3.8 source = route 면 실제 도보 거리 + path(지도 선, from → to), estimate 면 직선 × 1.3 (path null) */
export interface CourseLeg {
  from_place_id: number; to_place_id: number; walk_m: number | null; walk_min: number | null;
  source?: LegSource | null; path?: LatLng[] | null;
}
/** 무료 AI 산책 코스 (경로·테이블 이름은 tours 그대로). price 는 항상 0, guide 는 null */
export interface Tour {
  id: number; title: string; title_en: string; theme: string; guide: Guide | null;
  /** v3.5 계산값: stay_min_total + walk_min_total 을 10분 단위로 올림 */
  duration_min: number;
  stay_min_total: number; walk_m_total: number; walk_min_total: number;
  /** false = 좌표 없는 장소가 있어 걷는 시간 일부 빠짐 */
  walk_complete: boolean;
  /** v3.8 route = 모든 구간 OpenStreetMap 실제 경로 · estimate = 직선 × 1.3 · mixed = 섞임 (없으면 estimate) */
  route_source?: RouteSource;
  price: number;
  operating_days: string[]; languages: string[]; meeting_point: string; places: TourPlace[]; description?: string;
  /** places 순서대로 n−1개 */
  legs: CourseLeg[];
}
export type Course = Tour;
export interface Place {
  id: number; name: string; name_en: string; lat: number; lng: number; address?: string; hours?: string;
  closed_days?: string[]; fee: number; need_reservation: boolean; stay_min: number; tags: string[];
  photo_url?: string | null; photo_credit?: string | null; // TourAPI 대표 사진 (공공누리 제1유형만)
}

/** 버디 공개 활동 기록 (여행자 이름 없음) — BuddyDetailOut.recent_activities, GET /buddies/{id}/activities */
export interface PublicActivity { date: string; places: string[]; foods?: string | null; photos?: string[] }
export interface Buddy {
  id: number; name: string; university: string; university_id?: number; major: string; year: number; languages: string[];
  interests: string[]; intro: string; avatar: string; available_dates: string[]; rating: number; review_count: number;
  hourly_fee?: number;
  personality: Personality[]; style: WalkStyle[]; can_help: CanHelp[];
  /** 운전 가능 표시만. 차량 이동·유상 운송은 하지 않는다 (여객자동차 운수사업법 제81조) */
  can_drive: boolean;
  /** 후기 세부 점수 평균. 후기가 없으면 null */
  sub_scores: SubScores | null;
  /** 많이 받은 후기 태그 최대 3개 */
  tags_top: ReviewTag[];
  walk_count: number;
  verified: { school_email: boolean; trained: boolean; residence?: boolean };
  /** 공개 배지 (화면은 성장·우수만 표시) */
  grade?: BuddyGrade;
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
  /** v3.8 free 항목: 장소 id 걷는 순서 (걷는 거리가 가장 짧은 순서, 서버 코드가 정함) · 그 사이 걷는 거리·분 */
  place_ids?: number[] | null; walk_m?: number | null; walk_min?: number | null;
}
export interface PlanDay { date: string; items: PlanItem[] }
export interface AiPlan { plan_id: string; reason: string; total_price: number; days: PlanDay[]; warnings: PlanWarning[]; ai?: boolean }
/** questions_left: v3.4 무료 이용자가 질문했을 때 오늘 남은 질문 수 (소개·버디 이용자는 null) */
export interface AiStory { answer: string; sources: { title: string; url?: string }[]; grounded: boolean; questions_left?: number | null }

// ---- v3.4 이용 방식 (AU-09 GET /auth/me/plan) · 코스 완료 설문 (TR-05)
export type PlanKind = "free" | "buddy";
export interface MyPlan { plan: PlanKind; ai_question_limit: number | null; ai_questions_left_today: number | null; ai_questions_used_today: number }
export type SurveyPain = "ads" | "question_limit" | "route_fit" | "no_help" | "none";
export interface CourseSurveyBody { satisfaction: number; pain: SurveyPain; want_buddy: boolean }
export interface CourseSurvey extends CourseSurveyBody { id: number; tour_id: number; plan: PlanKind; created_at: string }
export interface BuddyMatch { reason: string; matches: { buddy_id: number; score: number; reason: string }[] }

// ---- 요청 사항
/** 버디 항목 요청: places 는 place_id 최대 3개, note 는 300자 이내 */
export interface BuddyRequestBody {
  diet: Diet[]; allergies: Allergy[]; pace: Pace; places: number[]; note: string;
  /** '기타' 직접 입력 (≤40자, 한 줄). 비었으면 없음. 매칭(AI-03)에는 쓰지 않는다 */
  diet_other?: string | null; allergy_other?: string | null;
}
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
  item_id: number; date: string; tourist: string;
  /** 정산 대상 = 활동비 + 앨범 (식사 보증금 제외, v3.6) */
  gross: number;
  /** gross 중 앨범(사진 기록) 요금 (0 또는 5,000) */
  album?: number;
  /** 예약 확정 때 고정한 정산율 (0.75 = 75%) */
  payout_rate: number;
  /** 플랫폼 몫 = gross − net */
  fee: number; meal_approved: number; meal_pending: number;
  /** round(gross × payout_rate) */
  net: number;
  status: "confirmed" | "meal_pending";
}
export interface BuddySettlement {
  month: string; pay_date: string; account: string | null;
  /** 지금 등급·정산율 (항목마다는 items[].payout_rate) */
  grade: BuddyGrade; payout_rate: number;
  walks: number; gross: number;
  /** gross 중 앨범 요금 합 (v3.6) */
  album?: number;
  fee: number; net: number;
  meals_approved: number; meals_pending: number; payout: number; items: BuddySettlementItem[];
}
/** 등급 기준값: 한 달 동행 · 누적 후기 · 누적 평점 */
export interface GradeNeed { walks: number; reviews: number; rating: number }
/** GET /buddy/grade · POST /buddy/confirm-active — v3.7 매달 1일, 지난달 동행으로 평가 */
export interface BuddyGradeInfo {
  grade: BuddyGrade; payout_rate: number;
  /** 지금 등급을 정한 평가 달 "YYYY-MM" (아직 평가 전이면 null) */
  evaluated_for: string | null;
  /** 다음 평가일 (다음 달 1일) */
  next_eval_on: string;
  /** month = 평가 달(지난달). 지난달 동행(누적 아님) · 이번 달 지금까지 동행 · 누적 후기 · 누적 평점 */
  stats: { month: string; last_month_walks: number; this_month_walks: number; reviews: number; rating: number | null };
  /** 한 단계 위와 그 기준 (우수면 null) */
  next: { grade: BuddyGrade; payout_rate: number; need: GradeNeed } | null;
  /** 지금 등급을 지키는 기준 (기본이면 null) */
  keep: GradeNeed | null;
  /** 다음 평가까지 승인 후 첫 달 → 기본 */
  first_month: boolean;
  /** "등급은 매달 1일, 지난달 동행으로 다시 정해요. 올라갈 때는 한 단계씩…" */
  note: string;
  /** 30일간 활동이 없어 요청 받기를 멈춤 (등급은 그대로 매달 평가) */
  needs_recheck: boolean; dormant_since: string | null; updated_at: string | null;
}
/** 버디 자격 경로 (v3.7) */
export type Eligibility = "school_email" | "residence";
/** 버디 지원 6단계 — GET /buddy/apply */
export interface BuddyApplyStatus {
  email_verified: boolean; school_email: string | null; university: string | null; age_ok: boolean; code_agreed: boolean;
  quiz_score: number | null; quiz_passed: boolean; profile_done: boolean;
  /** 대한민국 국적 확인 (외국인 유학생은 지원 불가) */
  korean_national: boolean;
  status: BuddyStatus | "none";
  /** v3.7 자격 경로와 1단계 완료 여부, 거주 경로 서류, 사전 교육 */
  eligibility: Eligibility | null; eligible: boolean; school_name: string | null;
  residence_proof_url: string | null; enrollment_proof_url: string | null;
  videos_watched: string[]; videos_total: number; education_done: boolean;
}
/** GET /buddy/apply/education · POST /buddy/apply/education/{id} */
export interface EducationVideo { id: string; title: string; topics: string; duration_sec: number; video_url: string | null; watched: boolean }
export interface EducationOut { videos: EducationVideo[]; watched: number; total: number; done: boolean }
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
  university?: string; university_id?: number | null; year?: number;
  /** 만 나이 (생년월일 없으면 null) */
  age: number | null;
  school_email_verified: boolean; code_agreed: boolean; quiz_score: number | null; report_count: number; can_help: CanHelp[];
  can_drive: boolean; walk_count?: number; rating?: number;
  /** 한국 국적 확인 */
  korean_national: boolean;
  /** 저장된 등급·정산율 (v3.7 매달 1일 평가) */
  grade: BuddyGrade; payout_rate: number;
  /** 평가 달(지난달) "YYYY-MM" · 지난달 동행 · 누적 후기 · 누적 평점 */
  eval_month: string; last_month_walks: number; total_reviews: number; avg_rating: number | null;
  evaluated_for: string | null; approved_on: string | null;
  /** 휴면 (목록·AI 추천에서 빠짐, 등급은 그대로 매달 평가) */
  needs_recheck: boolean;
  /** v3.7 자격 경로 · 거주 경로 서류(/media/… 이면 사진, 아니면 자리 표시) · 사전 교육 */
  eligibility: Eligibility | null; school_name: string | null;
  residence_proof_url: string | null; enrollment_proof_url: string | null;
  videos_watched: number; videos_total: number;
}
export interface AdminCourseRow {
  id: number; title: string; theme: string;
  /** v3.5 계산값 (머무는 시간 + 걷는 시간, 10분 올림) */
  duration_min: number;
  /** false = 좌표 없는 장소가 있어 걷는 시간 일부 빠짐 */
  walk_complete: boolean;
  /** v3.8 route | estimate | mixed */
  route_source?: RouteSource;
  places: string[]; place_count: number;
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
  /** revenue: 숙박 매출 또는 버디 정산 대상(활동비 + 앨범, v3.6) */
  party_type: "university" | "buddy"; party_id: number; target: string; count: number; revenue: number; fee: number;
  /** 버디: revenue 중 앨범 요금 */
  album?: number;
  /** 승인된 식비 (버디만, 수수료 없음) */
  meals: number;
  payout: number; status: string;
  /** 버디: 항목별 고정 정산율의 실효값 (revenue − fee) / revenue */
  payout_rate?: number | null;
}
/** 판매가 − 원가 = 이익. 식사 보증금은 통과 금액이라 판매가에 넣지 않는다 */
export interface SettlementProfit {
  sales: number; sales_dorm: number; sales_buddy: number; sales_album: number;
  /** 대학 지급 (숙박비 × 90%) · 버디 지급료 ((활동비 + 앨범) × 항목별 정산율 70~80%, 식비 제외) · 기타 원가 (카드 수수료 등, 지금은 0) */
  cost_university: number; cost_buddy: number; cost_other: number;
  /** cost_buddy 중 앨범 버디 몫 (v3.6) */
  cost_buddy_album?: number;
  profit: number;
  /** profit / sales (소수 셋째 자리) */
  margin: number;
}
export interface Settlements {
  period?: { from: string; to: string }; total: number; items: SettlementRow[];
  /** 여행자에게 돌려줄 남은 식비 보증금 합 */
  meal_refund_total: number;
  /** 운영자만. 대학 담당자에게는 null (자기 학교 숙박 행만 받는다) */
  profit: SettlementProfit | null;
}
export interface ListResponse<T> { items: T[]; next_cursor: string | null }
