// API 응답 타입 — docs/api-detail/*.md 와 동일한 필드명
export type Role = "tourist" | "buddy" | "guide" | "univ_admin" | "operator";
export type Lang = "ko" | "en";
export type ItemType = "dorm" | "tour" | "buddy";
export type ItemStatus = "requested" | "approved" | "rejected" | "confirmed" | "cancelled";
export type BookingStatus = "requested" | "partially_approved" | "confirmed" | "cancelled";

export interface User {
  id: number; name: string; email: string; role: Role; university_id: number | null;
  language: Lang; avatar_url?: string | null; calendar_connected?: boolean;
}
export interface TokenOut { access_token: string; user: User; needs_role_setup: boolean }

export interface University { id: number; name: string; name_en: string; open_from?: string; open_to?: string }
export interface DormRoom {
  id: number; university: University; building: string; room_type: "single" | "double" | "twin";
  price_per_night: number; open_from: string; open_to: string; available_rooms: number;
  photos: string[]; rules: string[];
}
export interface Guide { id: number; name: string; license: string; languages: string[] }
export interface TourPlace { order: number; id: number; name: string; name_en: string; lat: number; lng: number; stay_min: number }
export interface Tour {
  id: number; title: string; title_en: string; theme: string; guide: Guide; duration_min: number; price: number;
  operating_days: string[]; languages: string[]; meeting_point: string; places: TourPlace[]; description?: string;
}
export interface Place {
  id: number; name: string; name_en: string; lat: number; lng: number; address?: string; hours?: string;
  closed_days?: string[]; fee: number; need_reservation: boolean; stay_min: number; tags: string[];
}
export interface Buddy {
  id: number; name: string; university: string; major: string; year: number; languages: string[];
  interests: string[]; intro: string; avatar: string; available_dates: string[]; rating: number; review_count: number;
  hourly_fee?: number;
}
export interface Package {
  id: number; title: string; title_en: string; description: string; nights: number; total_price: number;
  cover_image?: string; dorm_room_id?: number; tour_id?: number; buddy_profile_id?: number;
}
export interface PlanItem { time: string | null; type: ItemType | "free"; ref_id: number | null; title: string; price: number; meta?: string }
export interface PlanDay { date: string; items: PlanItem[] }
export interface AiPlan { plan_id: string; reason: string; total_price: number; days: PlanDay[] }
export interface AiStory { answer: string; sources: { title: string; url?: string }[]; grounded: boolean }
export interface BuddyMatch { reason: string; matches: { buddy_id: number; score: number; reason: string }[] }

export interface CartItem {
  type: ItemType; ref_id: number; title: string; meta: string; price: number;
  date_from?: string; date_to?: string; date?: string; time?: string; duration_min?: number; guests?: number;
}
export interface Traveler { name: string; nationality: string; email: string; passport_no?: string; emergency_contact?: string; guests?: number; note?: string }
export interface BookingItem {
  id: number; type: ItemType; ref_id: number; title: string; meta: string; status: ItemStatus; price: number;
  date_from?: string; date_to?: string; time?: string; reject_reason?: string | null; google_event_id?: string | null;
}
export interface Booking {
  id: number; code: string; status: BookingStatus; total_price: number; platform_fee: number;
  traveler?: Traveler; items: BookingItem[]; created_at: string; paid_at?: string | null;
}
export interface Review { id: number; rating: number; text: string; author: string; created_at: string }
export interface Notification { id: number; type: string; title: string; body?: string; read_at: string | null; created_at: string }
export interface ContentDoc { key: string; language: Lang; title: string; body: string }

// 버디 측
export interface BuddyRequest {
  item_id: number; booking_code: string; tourist: { name: string; nationality: string; language: string };
  date: string; time: string; duration_min: number; interests: string[]; status: ItemStatus; ai_brief?: string;
}
export interface BuddyEarning { date: string; tourist: string; activity: string; amount: number; status: "pending" | "paid" }

// 어드민
export interface Dashboard {
  period: { from: string; to: string }; bookings: number; pending: number; nights: number;
  dorm_revenue: number; platform_fee: number; fee_rate: number;
  by_status: Record<BookingStatus | string, number>; daily: { date: string; bookings: number; revenue: number }[];
}
export interface AdminBookingRow {
  booking_id: number; item_id: number; code: string; tourist: string; nationality: string; type: ItemType;
  title: string; schedule: string; price: number; status: ItemStatus; university_id?: number;
}
export interface AdminBuddyRow { id: number; name: string; email: string; major: string; languages: string[]; status: "pending" | "approved" | "suspended" }
export interface ListResponse<T> { items: T[]; next_cursor: string | null }
