// 목 데이터 — docs/api-detail 의 Response 예시와 같은 형태. 날짜는 2027년 1월(겨울방학), 가격은 가정값.
import type { AdminBookingRow, AdminBuddyRow, Booking, Buddy, BuddyEarning, BuddyRequest, ContentDoc, Dashboard, DormRoom, Notification, Package, Place, Review, Tour, University, User } from "../types";

export const universities: University[] = [
  { id: 1, name: "A대학교", name_en: "A University", open_from: "2027-01-05", open_to: "2027-02-20" },
  { id: 2, name: "B대학교", name_en: "B University", open_from: "2027-01-05", open_to: "2027-02-20" },
];

export const users: Record<string, User> = {
  "emma@example.com": { id: 1, name: "Emma Clark", email: "emma@example.com", role: "tourist", university_id: null, language: "en" },
  "yuki@example.com": { id: 2, name: "Yuki Sato", email: "yuki@example.com", role: "tourist", university_id: null, language: "en" },
  "jiwoo@a-univ.ac.kr": { id: 3, name: "지우", email: "jiwoo@a-univ.ac.kr", role: "buddy", university_id: 1, language: "ko", calendar_connected: false },
  "guide.park@example.com": { id: 4, name: "박해설", email: "guide.park@example.com", role: "guide", university_id: null, language: "ko" },
  "admin@a-univ.ac.kr": { id: 5, name: "A대학교 국제관 담당자", email: "admin@a-univ.ac.kr", role: "univ_admin", university_id: 1, language: "ko" },
  "operator@sbstay.app": { id: 6, name: "운영자", email: "operator@sbstay.app", role: "operator", university_id: null, language: "ko" },
};

export const dorms: DormRoom[] = [
  { id: 10, university: universities[0], building: "국제관", room_type: "double", price_per_night: 35000, open_from: "2027-01-05", open_to: "2027-02-20", available_rooms: 12, photos: [], rules: ["체크인 15:00 / 체크아웃 11:00", "취사 금지, 공용 주방 이용", "외부인 출입 불가, 23:00 이후 정숙", "여권 정보는 예약 시점에만 입력 (최소 수집)"] },
  { id: 11, university: universities[0], building: "국제관", room_type: "single", price_per_night: 40000, open_from: "2027-01-05", open_to: "2027-02-20", available_rooms: 9, photos: [], rules: ["체크인 15:00 / 체크아웃 11:00", "취사 금지", "23:00 이후 정숙"] },
  { id: 12, university: universities[1], building: "생활관", room_type: "double", price_per_night: 30000, open_from: "2027-01-05", open_to: "2027-02-20", available_rooms: 20, photos: [], rules: ["체크인 15:00 / 체크아웃 11:00", "공용 세탁실 이용"] },
];

export const places: Place[] = [
  { id: 101, name: "최순우 옛집", name_en: "Choi Sunu House", lat: 37.5939, lng: 127.0103, address: "성북구 성북로15길 9", hours: "10:00–16:00", closed_days: ["mon"], fee: 0, need_reservation: false, stay_min: 20, tags: ["literature", "hanok"] },
  { id: 102, name: "수연산방", name_en: "Suyeon Sanbang", lat: 37.5947, lng: 127.0076, address: "성북구 성북로26길 8", hours: "11:30–18:00", closed_days: ["mon"], fee: 0, need_reservation: false, stay_min: 30, tags: ["literature", "cafe"] },
  { id: 103, name: "심우장", name_en: "Simujang", lat: 37.5942, lng: 127.0063, address: "성북구 성북로29길 24", hours: "09:00–18:00", closed_days: [], fee: 0, need_reservation: false, stay_min: 25, tags: ["independence", "literature"] },
  { id: 104, name: "길상사", name_en: "Gilsangsa Temple", lat: 37.5998, lng: 127.0048, address: "성북구 선잠로5길 68", hours: "04:00–20:00", closed_days: [], fee: 0, need_reservation: false, stay_min: 40, tags: ["temple", "walk"] },
  { id: 105, name: "정릉", name_en: "Jeongneung Royal Tomb", lat: 37.6023, lng: 127.0083, address: "성북구 아리랑로19길 116", hours: "09:00–17:30", closed_days: ["mon"], fee: 1000, need_reservation: false, stay_min: 50, tags: ["royal", "unesco"] },
  { id: 106, name: "선잠박물관", name_en: "Seonjam Museum", lat: 37.5945, lng: 127.0098, address: "성북구 성북로 96", hours: "10:00–18:00", closed_days: ["mon"], fee: 1000, need_reservation: false, stay_min: 40, tags: ["royal", "museum"] },
  { id: 107, name: "한양도성 북악구간", name_en: "Hanyangdoseong (Bugak)", lat: 37.5969, lng: 126.9985, address: "성북구 성북동", hours: "07:00–17:00", closed_days: [], fee: 0, need_reservation: false, stay_min: 60, tags: ["wall", "walk"] },
];

export const tours: Tour[] = [
  { id: 3, title: "문인의 성북동 산책", title_en: "Writers' Seongbuk Walk", theme: "literature", guide: { id: 21, name: "박해설", license: "관광통역안내사", languages: ["ko", "en"] }, duration_min: 120, price: 20000, operating_days: ["sat", "sun"], languages: ["en", "ko"], meeting_point: "한성대입구역 5번 출구", description: "최순우 옛집에서 길상사까지, 근대 문인들의 집과 글을 따라 걷는 코스.", places: [{ order: 1, id: 101, name: "최순우 옛집", name_en: "Choi Sunu House", lat: 37.5939, lng: 127.0103, stay_min: 20 }, { order: 2, id: 102, name: "수연산방", name_en: "Suyeon Sanbang", lat: 37.5947, lng: 127.0076, stay_min: 30 }, { order: 3, id: 103, name: "심우장", name_en: "Simujang", lat: 37.5942, lng: 127.0063, stay_min: 25 }, { order: 4, id: 104, name: "길상사", name_en: "Gilsangsa Temple", lat: 37.5998, lng: 127.0048, stay_min: 40 }] },
  { id: 4, title: "독립운동가의 길", title_en: "Independence Trail", theme: "independence", guide: { id: 22, name: "김해설", license: "관광통역안내사", languages: ["ko", "en"] }, duration_min: 120, price: 20000, operating_days: ["sun"], languages: ["en"], meeting_point: "한성대입구역 6번 출구", description: "심우장과 만해기념관, 독립운동의 흔적이 남은 성북동 골목.", places: [{ order: 1, id: 103, name: "심우장", name_en: "Simujang", lat: 37.5942, lng: 127.0063, stay_min: 30 }, { order: 2, id: 107, name: "한양도성 북악구간", name_en: "Hanyangdoseong (Bugak)", lat: 37.5969, lng: 126.9985, stay_min: 60 }] },
  { id: 5, title: "정릉과 성곽길", title_en: "Royal Tomb & Fortress Wall", theme: "royal", guide: { id: 23, name: "이해설", license: "문화관광해설사", languages: ["ko", "en"] }, duration_min: 180, price: 25000, operating_days: ["sat"], languages: ["ko", "en"], meeting_point: "정릉 매표소", description: "조선 왕릉 정릉과 한양도성 북악구간을 걷는 역사 코스.", places: [{ order: 1, id: 105, name: "정릉", name_en: "Jeongneung Royal Tomb", lat: 37.6023, lng: 127.0083, stay_min: 50 }, { order: 2, id: 106, name: "선잠박물관", name_en: "Seonjam Museum", lat: 37.5945, lng: 127.0098, stay_min: 40 }, { order: 3, id: 107, name: "한양도성 북악구간", name_en: "Hanyangdoseong (Bugak)", lat: 37.5969, lng: 126.9985, stay_min: 60 }] },
  { id: 6, title: "길상사와 한옥 골목", title_en: "Gilsangsa & Hanok Alleys", theme: "hanok", guide: { id: 21, name: "박해설", license: "관광통역안내사", languages: ["ko", "en"] }, duration_min: 120, price: 20000, operating_days: ["sat", "sun"], languages: ["en"], meeting_point: "한성대입구역 5번 출구", description: "길상사에서 성북동 한옥 골목, 선잠박물관까지.", places: [{ order: 1, id: 104, name: "길상사", name_en: "Gilsangsa Temple", lat: 37.5998, lng: 127.0048, stay_min: 40 }, { order: 2, id: 106, name: "선잠박물관", name_en: "Seonjam Museum", lat: 37.5945, lng: 127.0098, stay_min: 40 }] },
];

export const stories: Record<number, { intro: string; qa: { q: string; a: string }[]; sources: { title: string; url?: string }[] }> = {
  103: { intro: "한용운이 1933년부터 살았던 집. 조선총독부를 마주하지 않으려고 북쪽을 향하게 지었다고 전해져요.", qa: [{ q: "why does this house face north", a: "He refused to face the Japanese Government-General building to the south, so the house was built facing north — an unusual choice for a Korean house." }], sources: [{ title: "성북구 문화관광 자료" }, { title: "성북마을아카이브" }] },
  101: { intro: "미술사학자 최순우가 살던 1930년대 한옥. '무량수전 배흘림기둥에 기대서서'를 쓴 곳이에요.", qa: [], sources: [{ title: "내셔널트러스트 문화유산기금" }] },
  104: { intro: "요정 대원각이 1997년 절이 된 곳. 시인 백석과 자야의 이야기가 전해져요.", qa: [], sources: [{ title: "성북구 문화관광 자료" }] },
  105: { intro: "태조 이성계의 계비 신덕왕후의 능. 조선 최초의 왕릉으로 유네스코 세계유산이에요.", qa: [], sources: [{ title: "국가유산청 조선왕릉" }] },
};

export const buddies: Buddy[] = [
  { id: 31, name: "지우", university: "A대학교", major: "국어국문", year: 3, languages: ["ko", "en", "ja"], interests: ["literature", "walking", "cafe"], intro: "성북동 골목이랑 캠퍼스 맛집을 같이 걸어요. 역사 해설은 해설사·AI가, 저는 친구가 되어 드려요.", avatar: "illust_01", available_dates: ["2027-01-13", "2027-01-14", "2027-01-16", "2027-01-17"], rating: 4.9, review_count: 12, hourly_fee: 15000 },
  { id: 32, name: "민호", university: "B대학교", major: "사학과", year: 2, languages: ["ko", "en"], interests: ["independence", "photo"], intro: "성북동 답사 동아리에서 활동해요. 사진 찍기 좋은 골목을 알아요.", avatar: "illust_02", available_dates: ["2027-01-13", "2027-01-15"], rating: 4.7, review_count: 8, hourly_fee: 15000 },
  { id: 33, name: "하린", university: "A대학교", major: "관광학", year: 4, languages: ["ko", "en", "zh"], interests: ["food", "cafe"], intro: "교환학생 버디 경험 2회. 성북동 국수 골목 안내해요.", avatar: "illust_03", available_dates: ["2027-01-14", "2027-01-16"], rating: 4.8, review_count: 15, hourly_fee: 15000 },
  { id: 34, name: "도윤", university: "A대학교", major: "경영", year: 2, languages: ["ko", "en"], interests: ["walking", "sports"], intro: "캠퍼스 투어와 야경 산책 담당.", avatar: "illust_04", available_dates: ["2027-01-20", "2027-01-21"], rating: 4.5, review_count: 3, hourly_fee: 15000 },
  { id: 35, name: "서연", university: "B대학교", major: "영문학", year: 3, languages: ["ko", "en"], interests: ["literature", "craft"], intro: "영어 토론 동아리. 공예 체험 같이 가요.", avatar: "illust_05", available_dates: ["2027-01-13", "2027-01-17"], rating: 4.9, review_count: 6, hourly_fee: 15000 },
  { id: 36, name: "준서", university: "A대학교", major: "건축학", year: 4, languages: ["ko", "en", "ja"], interests: ["hanok", "architecture"], intro: "근대 건축과 한옥 이야기를 좋아해요.", avatar: "illust_06", available_dates: ["2027-01-14", "2027-01-15"], rating: 4.6, review_count: 9, hourly_fee: 15000 },
];

export const packages: Package[] = [
  { id: 1, title: "문인의 성북 3박", title_en: "Writers' Seongbuk · 3 nights", description: "기숙사 2인실 · 문인 산책 투어 · 버디 1회", nights: 3, total_price: 198000, dorm_room_id: 10, tour_id: 3, buddy_profile_id: 31 },
  { id: 2, title: "왕릉과 성곽 2박", title_en: "Royal Tomb & Wall · 2 nights", description: "기숙사 2인실 · 정릉 투어", nights: 2, total_price: 124000, dorm_room_id: 10, tour_id: 5 },
  { id: 3, title: "독립운동 1박 2일", title_en: "Independence Trail · 1 night", description: "기숙사 1인실 · 독립운동가의 길 · 버디 1회", nights: 1, total_price: 95000, dorm_room_id: 11, tour_id: 4, buddy_profile_id: 32 },
];

export const reviews: Record<string, Review[]> = {
  "tour:3": [{ id: 1, rating: 5, text: "해설이 쉽고 코스가 걷기 좋아요", author: "Mia", created_at: "2026-08-02" }, { id: 2, rating: 5, text: "Loved the stories at Simujang", author: "Lena", created_at: "2026-07-20" }],
  "buddy:31": [{ id: 3, rating: 5, text: "We talked about poetry over coffee", author: "Lena", created_at: "2026-07-21" }],
};

export const bookings: Booking[] = [
  { id: 501, code: "SB-2027-0112", status: "partially_approved", total_price: 155000, platform_fee: 15500, created_at: "2027-01-05T10:00:00Z", paid_at: "2027-01-05T10:05:00Z",
    traveler: { name: "Emma Clark", nationality: "US", email: "emma@example.com", emergency_contact: "+1 555 0100", guests: 1 },
    items: [
      { id: 1, type: "dorm", ref_id: 10, title: "A대학교 국제관 2인실", meta: "1/12 – 1/15 · 3박", status: "approved", price: 105000, date_from: "2027-01-12", date_to: "2027-01-15" },
      { id: 2, type: "tour", ref_id: 3, title: "문인의 성북동 산책", meta: "1/13 10:00 · 해설사 박해설 · 한성대입구역 5번 출구", status: "confirmed", price: 20000, date_from: "2027-01-13", time: "10:00" },
      { id: 3, type: "buddy", ref_id: 31, title: "지우와 동네 걷기", meta: "1/13 14:00 · 2시간", status: "requested", price: 30000, date_from: "2027-01-13", time: "14:00" },
    ] },
  { id: 480, code: "SB-2026-1120", status: "confirmed", total_price: 95000, platform_fee: 9500, created_at: "2026-11-10T09:00:00Z", paid_at: "2026-11-10T09:02:00Z",
    traveler: { name: "Emma Clark", nationality: "US", email: "emma@example.com", guests: 1 },
    items: [
      { id: 11, type: "dorm", ref_id: 12, title: "C대학교 생활관 2박", meta: "11/20 – 11/22", status: "confirmed", price: 60000, date_from: "2026-11-20", date_to: "2026-11-22" },
      { id: 12, type: "tour", ref_id: 5, title: "정릉과 성곽길", meta: "11/21 10:00", status: "confirmed", price: 25000, date_from: "2026-11-21", time: "10:00" },
      { id: 13, type: "buddy", ref_id: 32, title: "민호와 캠퍼스 걷기", meta: "11/21 14:00", status: "confirmed", price: 10000, date_from: "2026-11-21", time: "14:00" },
    ] },
  { id: 470, code: "SB-2026-0812", status: "cancelled", total_price: 70000, platform_fee: 7000, created_at: "2026-08-01T09:00:00Z",
    traveler: { name: "Emma Clark", nationality: "US", email: "emma@example.com", guests: 1 },
    items: [{ id: 21, type: "dorm", ref_id: 12, title: "B대학교 생활관 2박", meta: "8/12 – 8/14", status: "cancelled", price: 60000 }, { id: 22, type: "tour", ref_id: 5, title: "성곽길 투어", meta: "8/13 10:00", status: "cancelled", price: 10000 }] },
];

export const notifications: Notification[] = [
  { id: 1, type: "item_approved", title: "숙박 승인됨 · A대학교 국제관 1/12–1/15", read_at: null, created_at: "2027-01-06T09:00:00Z" },
  { id: 2, type: "item_confirmed", title: "투어 확정 · 문인의 성북동 산책 1/13 10:00", read_at: null, created_at: "2027-01-05T10:06:00Z" },
  { id: 3, type: "item_requested", title: "버디 요청 접수 · 지우 · 수락 대기", read_at: "2027-01-05T11:00:00Z", created_at: "2027-01-05T10:05:00Z" },
];

export const contents: ContentDoc[] = [
  { key: "intro", language: "ko", title: "성북구 소개", body: "서울 도성 밖에서 문화재가 가장 많은 동네, 성북동. 정릉·심우장·길상사·수연산방·선잠박물관이 걸어서 닿는 거리에 있습니다." },
  { key: "intro", language: "en", title: "About Seongbuk", body: "The neighborhood outside Seoul's old city wall with the most heritage sites. Jeongneung, Simujang, Gilsangsa, Suyeon Sanbang and the Seonjam Museum are all within walking distance." },
  { key: "terms", language: "ko", title: "이용약관", body: "본 서비스는 숙박(대학)·투어(해설사)·교류(버디)를 연결하는 중개 플랫폼입니다. 숙박 판매 주체는 각 대학이며, 플랫폼은 예약·결제·연결을 담당합니다." },
  { key: "refund", language: "ko", title: "환불 규정", body: "체크인 7일 전 100% · 3일 전 50% · 이후 0%. 투어·버디는 각 일정 48시간 전까지 100%." },
  { key: "support", language: "ko", title: "고객센터 · 긴급연락처", body: "운영자 +82-2-0000-0000 (09:00–18:00)\n긴급: 112 (경찰) · 119 (구급) · 1330 (관광 안내, 24시간 다국어)" },
];

export const buddyRequests: BuddyRequest[] = [
  { item_id: 3, booking_id: 501, booking_code: "SB-2027-0112", tourist: { name: "Emma", nationality: "미국", language: "영어" }, date: "2027-01-13", time: "14:00", duration_min: 120, interests: ["한국 문학", "독립운동"], status: "requested", ai_brief: "오전에 심우장·수연산방 투어를 들었어요. 시집 이야기로 시작하면 좋아요." },
  { item_id: 41, booking_id: 503, booking_code: "SB-2027-0116", tourist: { name: "Lucas", nationality: "프랑스", language: "영어" }, date: "2027-01-16", time: "11:00", duration_min: 120, interests: ["한옥", "로컬 음식"], status: "requested", ai_brief: "길상사·성북동 한옥 골목 추천. 점심은 성북동 국수 골목." },
  { item_id: 38, booking_id: 506, booking_code: "SB-2027-0113", tourist: { name: "Yuki", nationality: "일본", language: "영어" }, date: "2027-01-13", time: "17:00", duration_min: 90, interests: ["산책"], status: "confirmed" },
  { item_id: 30, booking_id: 460, booking_code: "SB-2026-1220", tourist: { name: "Mia", nationality: "호주", language: "영어" }, date: "2026-12-20", time: "10:00", duration_min: 120, interests: ["카페"], status: "rejected", },
];

export const buddyEarnings: BuddyEarning[] = [
  { date: "2027-01-13", tourist: "Emma · 미국", activity: "캠퍼스·동네 걷기 2h", amount: 30000, status: "pending" },
  { date: "2027-01-11", tourist: "Yuki · 일본", activity: "성북천 산책 2h", amount: 30000, status: "pending" },
  { date: "2027-01-09", tourist: "Lucas · 프랑스", activity: "한옥 골목·국수 골목 2h", amount: 30000, status: "pending" },
  { date: "2026-12-28", tourist: "Mia · 호주", activity: "길상사·카페 2h", amount: 30000, status: "paid" },
  { date: "2026-12-22", tourist: "Lena · 독일", activity: "시 낭독 카페 2h", amount: 30000, status: "paid" },
];

export const dashboard: Dashboard = {
  period: { from: "2027-01-05", to: "2027-02-20" }, bookings: 24, pending: 3, nights: 72, dorm_revenue: 2520000, platform_fee: 252000, fee_rate: 0.1,
  by_status: { requested: 3, approved: 8, confirmed: 11, cancelled: 2 },
  daily: Array.from({ length: 14 }, (_, i) => ({ date: `2027-01-${String(5 + i).padStart(2, "0")}`, bookings: [1, 2, 1, 3, 2, 2, 1, 4, 2, 1, 2, 1, 1, 1][i], revenue: [35000, 70000, 40000, 105000, 70000, 70000, 35000, 140000, 70000, 35000, 70000, 40000, 35000, 35000][i] })),
};

export const adminBookings: AdminBookingRow[] = [
  { booking_id: 501, item_id: 1, code: "SB-2027-0112", tourist: "Emma Clark", nationality: "미국", type: "dorm", title: "A대 국제관 2인실", schedule: "1/12 – 1/15", price: 105000, status: "approved", university_id: 1 },
  { booking_id: 501, item_id: 2, code: "SB-2027-0112", tourist: "Emma Clark", nationality: "미국", type: "tour", title: "문인의 성북동 산책", schedule: "1/13 10:00", price: 20000, status: "confirmed" },
  { booking_id: 501, item_id: 3, code: "SB-2027-0112", tourist: "Emma Clark", nationality: "미국", type: "buddy", title: "지우 · 동네 걷기", schedule: "1/13 14:00", price: 30000, status: "requested", university_id: 1 },
  { booking_id: 502, item_id: 4, code: "SB-2027-0114", tourist: "Yuki Sato", nationality: "일본", type: "dorm", title: "A대 국제관 1인실", schedule: "1/14 – 1/16", price: 80000, status: "requested", university_id: 1 },
  { booking_id: 503, item_id: 5, code: "SB-2027-0116", tourist: "Lucas Martin", nationality: "프랑스", type: "buddy", title: "지우 · 한옥 골목", schedule: "1/16 11:00", price: 30000, status: "approved", university_id: 1 },
  { booking_id: 504, item_id: 6, code: "SB-2027-0119", tourist: "김민지", nationality: "한국", type: "dorm", title: "B대 생활관 2인실", schedule: "1/19 – 1/26", price: 245000, status: "requested", university_id: 2 },
  { booking_id: 505, item_id: 7, code: "SB-2027-0108", tourist: "Mia Wong", nationality: "호주", type: "tour", title: "정릉과 성곽길", schedule: "1/8 10:00", price: 25000, status: "cancelled" },
];

export const adminBuddies: AdminBuddyRow[] = [
  { id: 31, name: "지우", email: "jiwoo@a-univ.ac.kr", major: "국어국문 3", languages: ["ko", "en", "ja"], status: "approved" },
  { id: 33, name: "하린", email: "harin@a-univ.ac.kr", major: "관광학 4", languages: ["ko", "en", "zh"], status: "pending" },
  { id: 34, name: "도윤", email: "doyun@a-univ.ac.kr", major: "경영 2", languages: ["ko", "en"], status: "pending" },
];
