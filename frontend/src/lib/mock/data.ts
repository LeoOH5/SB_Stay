// 목 데이터 — docs/api-detail + docs/v3/CONTRACT.md 의 Response 형태. 날짜는 2027년 1월(겨울방학), 가격은 가정값.
// v3: 해설사 없음, 코스(tours)는 무료, 예약 항목은 숙박(dorm) + 버디(buddy). 화면 그림: docs/v3/screens
import { courseTimes } from "../codes";
import type {
  Booking, Buddy, BuddyGrade, BuddyStatus, ContentDoc, Eligibility, Dashboard, DormRoom, MealClaimStatus, Notification, Package, Place, QuizQuestion,
  ReportCategory, ReportStatus, Review, Tour, University, User,
} from "../types";

/** 목업의 '오늘' — 다가오는/지난 여행 구분, 후기 가능 여부 (components/tourist/format.ts DEMO_TODAY 와 같게) */
export const TODAY = "2027-01-14";
/** 학교 메일 인증번호 (데모 고정값) */
export const OTP_CODE = "123456";

export const universities: University[] = [
  { id: 1, name: "고려대학교", name_en: "Korea University", open_from: "2027-01-05", open_to: "2027-02-20", email_domains: ["korea.ac.kr", "a-univ.ac.kr"] },
  { id: 2, name: "국민대학교", name_en: "Kookmin University", open_from: "2027-01-05", open_to: "2027-02-20", email_domains: ["kookmin.ac.kr"] },
  { id: 3, name: "성신여자대학교", name_en: "Sungshin Women's University", open_from: "2027-01-05", open_to: "2027-02-20", email_domains: ["sungshin.ac.kr"] },
  { id: 4, name: "한성대학교", name_en: "Hansung University", open_from: "2027-01-05", open_to: "2027-02-20", email_domains: ["hansung.ac.kr"] },
  { id: 5, name: "서경대학교", name_en: "Seokyeong University", open_from: "2027-01-05", open_to: "2027-02-20", email_domains: ["skuniv.ac.kr"] },
  { id: 6, name: "동덕여자대학교", name_en: "Dongduk Women's University", open_from: "2027-01-05", open_to: "2027-02-20", email_domains: ["dongduk.ac.kr"] },
  { id: 7, name: "한국예술종합학교", name_en: "Korea National University of Arts", open_from: "2027-01-05", open_to: "2027-02-20", email_domains: ["karts.ac.kr"] },
];

export const users: Record<string, User> = {
  "emma@example.com": { id: 1, name: "Emma Clark", email: "emma@example.com", role: "tourist", university_id: null, language: "en" },
  "yuki@example.com": { id: 2, name: "Yuki Sato", email: "yuki@example.com", role: "tourist", university_id: null, language: "en" },
  "noah@example.com": { id: 27, name: "Noah Becker", email: "noah@example.com", role: "tourist", university_id: null, language: "en" },
  "jiwoo@a-univ.ac.kr": { id: 3, name: "지우", email: "jiwoo@a-univ.ac.kr", role: "buddy", university_id: 1, language: "ko", calendar_connected: false, birth_date: "2004-05-02" },
  "sua@a-univ.ac.kr": { id: 17, name: "수아", email: "sua@a-univ.ac.kr", role: "buddy", university_id: 1, language: "ko", calendar_connected: false, birth_date: "2005-04-20" },
  "gaeun@example.com": { id: 18, name: "가은", email: "gaeun@example.com", role: "buddy", university_id: null, language: "ko", calendar_connected: false, birth_date: "2004-07-09" },
  "admin@a-univ.ac.kr": { id: 5, name: "고려대학교 프런티어관 담당자", email: "admin@a-univ.ac.kr", role: "univ_admin", university_id: 1, language: "ko" },
  "operator@sbstay.app": { id: 6, name: "운영자", email: "operator@sbstay.app", role: "operator", university_id: null, language: "ko" },
};
/** 로그인한 버디 계정 → buddy_profiles.id */
export const buddyIdByEmail: Record<string, number> = { "jiwoo@a-univ.ac.kr": 31, "sua@a-univ.ac.kr": 37, "gaeun@example.com": 39 };

export const dorms: DormRoom[] = [
  { id: 10, university: universities[0], building: "프런티어관", room_type: "double", price_per_night: 35000, open_from: "2027-01-05", open_to: "2027-02-20", available_rooms: 12, photos: ["/dorms/korea.jpg"], rules: ["체크인 15:00 / 체크아웃 11:00", "취사 금지, 공용 주방 이용", "외부인 출입 불가, 23:00 이후 정숙", "여권 정보는 예약 시점에만 입력"] },
  { id: 11, university: universities[0], building: "프런티어관", room_type: "single", price_per_night: 40000, open_from: "2027-01-05", open_to: "2027-02-20", available_rooms: 9, photos: ["/dorms/korea.jpg"], rules: ["체크인 15:00 / 체크아웃 11:00", "취사 금지", "23:00 이후 정숙"] },
  { id: 18, university: universities[0], building: "CJ인터내셔널하우스", room_type: "double", price_per_night: 38000, open_from: "2027-01-05", open_to: "2027-02-20", available_rooms: 8, photos: ["/dorms/official/korea-cj.jpg"], rules: ["체크인 15:00 / 체크아웃 11:00", "23:00 이후 정숙", "국제학생 기숙사, 공용 라운지"] },
  { id: 21, university: universities[0], building: "CJ인터내셔널하우스", room_type: "single", price_per_night: 45000, open_from: "2027-01-05", open_to: "2027-02-20", available_rooms: 3, photos: ["/dorms/official/korea-cj.jpg"], rules: ["체크인 15:00 / 체크아웃 11:00", "23:00 이후 정숙", "국제학생 기숙사, 공용 라운지"] },
  { id: 22, university: universities[0], building: "안암인터내셔널하우스", room_type: "double", price_per_night: 36000, open_from: "2027-01-05", open_to: "2027-02-20", available_rooms: 10, photos: ["/dorms/official/korea-aih.jpg"], rules: ["체크인 15:00 / 체크아웃 11:00", "23:00 이후 정숙", "국제학생 기숙사"] },
  { id: 12, university: universities[1], building: "정릉생활관", room_type: "double", price_per_night: 30000, open_from: "2027-01-05", open_to: "2027-02-20", available_rooms: 20, photos: ["/dorms/official/kookmin-jeongneung.jpg"], rules: ["체크인 15:00 / 체크아웃 11:00", "23:00 이후 정숙", "공용 세탁실 이용"] },
  { id: 23, university: universities[1], building: "길음생활관", room_type: "double", price_per_night: 29000, open_from: "2027-01-05", open_to: "2027-02-20", available_rooms: 7, photos: ["/dorms/official/kookmin-gireum.jpg"], rules: ["체크인 15:00 / 체크아웃 11:00", "23:00 이후 정숙", "캠퍼스 밖 기숙사, 셔틀 이용"] },
  { id: 19, university: universities[2], building: "성미관", room_type: "double", price_per_night: 34000, open_from: "2027-01-05", open_to: "2027-02-20", available_rooms: 5, photos: ["/dorms/official/sungshin-seongmigwan.jpg"], rules: ["체크인 15:00 / 체크아웃 11:00", "23:00 이후 정숙", "여성 전용, 피트니스룸·스터디룸"] },
  { id: 13, university: universities[2], building: "성미료", room_type: "double", price_per_night: 32000, open_from: "2027-01-05", open_to: "2027-02-20", available_rooms: 10, photos: ["/dorms/official/sungshin-seongmiryo.jpg"], rules: ["체크인 15:00 / 체크아웃 11:00", "23:00 이후 정숙", "여성 전용, 국제학생과 같은 건물"] },
  { id: 14, university: universities[3], building: "상상빌리지", room_type: "double", price_per_night: 30000, open_from: "2027-01-05", open_to: "2027-02-20", available_rooms: 8, photos: ["/dorms/official/hansung-sangsang.jpg"], rules: ["체크인 15:00 / 체크아웃 11:00", "23:00 이후 정숙", "공동취사장·세탁실 이용"] },
  { id: 24, university: universities[3], building: "상상빌리지", room_type: "single", price_per_night: 36000, open_from: "2027-01-05", open_to: "2027-02-20", available_rooms: 1, photos: ["/dorms/official/hansung-sangsang.jpg"], rules: ["체크인 15:00 / 체크아웃 11:00", "23:00 이후 정숙", "공동취사장·세탁실 이용"] },
  { id: 15, university: universities[4], building: "생활관 3동", room_type: "single", price_per_night: 33000, open_from: "2027-01-05", open_to: "2027-02-20", available_rooms: 6, photos: ["/dorms/official/seokyeong-dorm.jpg"], rules: ["체크인 15:00 / 체크아웃 11:00", "23:00 이후 정숙", "취사 금지"] },
  { id: 16, university: universities[5], building: "제1생활관(목화관)", room_type: "double", price_per_night: 30000, open_from: "2027-01-05", open_to: "2027-02-20", available_rooms: 11, photos: ["/dorms/official/dongduk-1.jpg"], rules: ["체크인 15:00 / 체크아웃 11:00", "23:00 이후 정숙", "여성 전용"] },
  { id: 20, university: universities[5], building: "제2생활관", room_type: "single", price_per_night: 32000, open_from: "2027-01-05", open_to: "2027-02-20", available_rooms: 4, photos: ["/dorms/official/dongduk-2.jpg"], rules: ["체크인 15:00 / 체크아웃 11:00", "23:00 이후 정숙", "여성 전용, 캠퍼스 밖 (종암로)"] },
  { id: 17, university: universities[6], building: "천장관", room_type: "double", price_per_night: 31000, open_from: "2027-01-05", open_to: "2027-02-20", available_rooms: 7, photos: ["/dorms/official/karts-dorm.jpg"], rules: ["체크인 15:00 / 체크아웃 11:00", "23:00 이후 정숙", "연습실 이용은 별도 신청"] },
];

/** 좌표는 시드(places.json)의 확인된 값과 같게 (v3.5 코스 걷는 시간 계산에 쓴다) */
export const places: Place[] = [
  { id: 101, name: "최순우 옛집", name_en: "Choi Sunu House", lat: 37.593065, lng: 127.00036, address: "성북구 성북로15길 9", hours: "10:00–16:00", closed_days: ["mon"], fee: 0, need_reservation: false, stay_min: 20, tags: ["literature", "hanok"] },
  { id: 102, name: "수연산방", name_en: "Suyeon Sanbang", lat: 37.595107, lng: 126.994855, address: "성북구 성북로26길 8", hours: "11:30–18:00", closed_days: ["mon"], fee: 0, need_reservation: false, stay_min: 30, tags: ["literature", "cafe"] },
  { id: 103, name: "심우장", name_en: "Simujang", lat: 37.593599, lng: 126.991816, address: "성북구 성북로29길 24", hours: "09:00–18:00", closed_days: [], fee: 0, need_reservation: false, stay_min: 25, tags: ["independence", "literature"] },
  { id: 104, name: "길상사", name_en: "Gilsangsa Temple", lat: 37.598598, lng: 126.993958, address: "성북구 선잠로5길 68", hours: "04:00–20:00", closed_days: [], fee: 0, need_reservation: false, stay_min: 40, tags: ["temple", "walk"] },
  { id: 105, name: "정릉", name_en: "Jeongneung Royal Tomb", lat: 37.601223, lng: 127.007594, address: "성북구 아리랑로19길 116", hours: "09:00–17:30", closed_days: ["mon"], fee: 1000, need_reservation: false, stay_min: 50, tags: ["royal", "unesco"] },
  { id: 106, name: "선잠박물관", name_en: "Seonjam Museum", lat: 37.593236, lng: 126.998237, address: "성북구 성북로 96", hours: "10:00–18:00", closed_days: ["mon"], fee: 1000, need_reservation: false, stay_min: 40, tags: ["royal", "museum"] },
  { id: 107, name: "한양도성 북악구간", name_en: "Hanyangdoseong (Bugak)", lat: 37.5969, lng: 126.9985, address: "성북구 성북동", hours: "07:00–17:00", closed_days: [], fee: 0, need_reservation: false, stay_min: 60, tags: ["wall", "walk"] },
  { id: 108, name: "흥천사", name_en: "Heungcheonsa Temple", lat: 37.59839, lng: 127.009369, address: "성북구 흥천사길 29", hours: "05:00–19:00", closed_days: [], fee: 0, need_reservation: false, stay_min: 30, tags: ["temple", "royal"] },
  { id: 111, name: "성북근현대문학관", name_en: "Seongbuk Museum of Modern Literature", lat: 37.59251, lng: 126.997056, address: "성북구 성북로21길 24", hours: "10:00–18:00", closed_days: ["mon"], fee: 1000, need_reservation: false, stay_min: 40, tags: ["literature", "museum"] },
  { id: 110, name: "성북천", name_en: "Seongbukcheon Stream", lat: 37.5885, lng: 127.0068, address: "성북구 성북천 산책로", hours: "상시", closed_days: [], fee: 0, need_reservation: false, stay_min: 30, tags: ["walk"] },
];

const P = (order: number, id: number, stay_min?: number) => {
  const p = places.find((x) => x.id === id)!;
  return { order, id: p.id, name: p.name, name_en: p.name_en, lat: p.lat, lng: p.lng, stay_min: stay_min ?? p.stay_min, photo_url: p.photo_url ?? null, photo_credit: p.photo_credit ?? null };
};
/** v3.5 코스 시간은 계산값 — 백엔드와 같은 식(직선 × 1.3, 4 km/h, 10분 올림)으로 목업 좌표에서 구한다 */
const course = (t: Omit<Tour, "duration_min" | "stay_min_total" | "walk_m_total" | "walk_min_total" | "walk_complete" | "route_source" | "legs">): Tour => ({ ...t, ...courseTimes(t.places) });
const ALL_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/** 무료 AI 산책 코스 — 해설사 없음(guide null), price 0 */
export const tours: Tour[] = [
  course({ id: 3, title: "문인의 성북동 산책", title_en: "Writers' Seongbuk Walk", theme: "literature", guide: null, price: 0, operating_days: ALL_DAYS, languages: ["ko", "en"], meeting_point: "한성대입구역 5번 출구", description: "성북근현대문학관에서 수연산방·심우장을 거쳐 길상사까지, 근대 문인들의 집과 글을 따라 걷는 코스. 장소마다 AI가 이야기를 들려줘요.", places: [P(1, 111, 40), P(2, 102, 30), P(3, 103, 25), P(4, 104, 40)] }),
  course({ id: 4, title: "독립운동가의 길", title_en: "Independence Trail", theme: "independence", guide: null, price: 0, operating_days: ALL_DAYS, languages: ["ko", "en"], meeting_point: "한성대입구역 6번 출구", description: "심우장과 한양도성, 독립운동의 흔적이 남은 성북동 골목.", places: [P(1, 103, 30), P(2, 107, 60)] }),
  course({ id: 5, title: "정릉과 성곽길", title_en: "Royal Tomb & Fortress Wall", theme: "royal", guide: null, price: 0, operating_days: ALL_DAYS, languages: ["ko", "en"], meeting_point: "정릉 매표소", description: "정릉에서 한양도성 북악구간을 걸어 선잠박물관까지, 조선 왕릉과 성곽을 잇는 역사 코스.", places: [P(1, 105, 50), P(2, 107, 60), P(3, 106, 40)] }),
  course({ id: 6, title: "길상사와 한옥 골목", title_en: "Gilsangsa & Hanok Alleys", theme: "hanok", guide: null, price: 0, operating_days: ALL_DAYS, languages: ["ko", "en"], meeting_point: "한성대입구역 5번 출구", description: "길상사에서 성북동 한옥 골목, 선잠박물관까지.", places: [P(1, 104, 40), P(2, 106, 40)] }),
  course({ id: 7, title: "왕릉과 산사", title_en: "Royal Tomb & Mountain Temple", theme: "royal", guide: null, price: 0, operating_days: ALL_DAYS, languages: ["ko", "en"], meeting_point: "정릉 매표소", description: "정릉에서 흥천사까지, 조선 왕실과 이어진 두 곳을 천천히.", places: [P(1, 105, 50), P(2, 108, 40)] }),
];

export const stories: Record<number, { intro: string; qa: { q: string; a: string }[]; sources: { title: string; url?: string }[] }> = {
  101: { intro: "미술사학자 최순우가 살던 1930년대 한옥. '무량수전 배흘림기둥에 기대서서'를 쓴 곳이에요.", qa: [], sources: [{ title: "내셔널트러스트 문화유산기금" }] },
  111: { intro: "성북과 인연이 있는 문인과 문학의 역사를 전시하는 문학관이에요. 2024년 3월에 문을 열었고, 한용운·이태준·정지용 등을 다뤄요.", qa: [], sources: [{ title: "성북구 문화관광 자료" }] },
  102: { intro: "소설가 이태준이 살던 집. 지금은 전통 찻집이라 대추차와 단팥죽이 유명해요.", qa: [], sources: [{ title: "성북구 문화관광 자료" }] },
  103: { intro: "한용운이 1933년부터 살았던 집. 조선총독부를 마주하지 않으려고 북쪽을 향하게 지었다고 전해져요.", qa: [{ q: "why does this house face north", a: "He refused to face the Japanese Government-General building to the south, so the house was built facing north — an unusual choice for a Korean house." }], sources: [{ title: "성북구 문화관광 자료" }, { title: "성북마을아카이브" }] },
  104: { intro: "요정 대원각이 1997년 절이 된 곳. 시인 백석과 자야의 이야기가 전해져요.", qa: [], sources: [{ title: "성북구 문화관광 자료" }] },
  105: { intro: "태조 이성계의 계비 신덕왕후의 능. 조선 최초의 왕릉으로 유네스코 세계유산이에요.", qa: [], sources: [{ title: "국가유산청 조선왕릉" }] },
  106: { intro: "누에치기의 신 서릉씨에게 제사를 올리던 선잠단 터 옆 박물관이에요.", qa: [], sources: [{ title: "성북선잠박물관" }] },
  107: { intro: "조선 한양을 둘러싼 성곽 가운데 북악산 구간. 성북동 쪽 성벽은 걷기 좋게 이어져요.", qa: [], sources: [{ title: "서울시 한양도성" }] },
  108: { intro: "신덕왕후의 명복을 빌던 절. 정릉과 같은 시기에 지어져 왕실과 인연이 깊어요.", qa: [], sources: [{ title: "국가유산청" }] },
};

// ---- 버디 프로필 (상태는 buddyStatus, 관리자 정보는 buddyAdminInfo)
export const buddies: Buddy[] = [
  { id: 31, name: "지우", university: "고려대학교", university_id: 1, major: "국어국문", year: 3, languages: ["ko", "en", "ja"], interests: ["literature", "walking", "cafe"], intro: "성북동 골목이랑 캠퍼스 맛집을 같이 걸어요. 비건 식당도 몇 곳 알아요.", avatar: "illust_01", available_dates: ["2027-01-13", "2027-01-14", "2027-01-16", "2027-01-17", "2027-01-20", "2027-01-22"], rating: 4.8, review_count: 9, hourly_fee: 15000,
    personality: ["calm", "listener"], style: ["slow_walk", "cafe_break"], can_help: ["vegan_food", "photo", "subway"], sub_scores: { kind: 4.9, talk: 4.7, punctual: 5.0, local: 4.6 }, tags_top: ["fun_talk", "good_photos", "knows_food"], walk_count: 12, can_drive: false, grade: "growth", verified: { school_email: true, trained: true } },
  { id: 32, name: "민호", university: "국민대학교", university_id: 2, major: "사학과", year: 2, languages: ["ko", "en"], interests: ["independence", "photo"], intro: "성북동 답사 동아리에서 활동해요. 사진 찍기 좋은 골목을 알아요.", avatar: "illust_02", available_dates: ["2027-01-13", "2027-01-15", "2027-01-20"], rating: 4.7, review_count: 8, hourly_fee: 15000,
    personality: ["lively", "humor"], style: ["explore", "photo_walk"], can_help: ["photo", "subway"], sub_scores: { kind: 4.7, talk: 4.6, punctual: 4.8, local: 4.7 }, tags_top: ["knows_food", "easy_guide"], walk_count: 8, can_drive: true, grade: "basic", verified: { school_email: true, trained: true } },
  { id: 37, name: "수아", university: "고려대학교", university_id: 1, major: "영어영문", year: 2, languages: ["ko", "en"], interests: ["photo", "cafe"], intro: "사진 찍는 걸 좋아해요. 성북동 예쁜 카페 골목을 같이 걸어요.", avatar: "illust_05", available_dates: ["2027-01-12", "2027-01-13", "2027-01-14", "2027-01-15"], rating: 4.8, review_count: 7, hourly_fee: 15000,
    personality: ["lively", "listener"], style: ["photo_walk", "cafe_break"], can_help: ["photo", "shopping", "subway"], sub_scores: { kind: 4.8, talk: 4.9, punctual: 4.7, local: 4.6 }, tags_top: ["good_photos", "fun_talk"], walk_count: 7, can_drive: false, grade: "top", verified: { school_email: true, trained: true } },
  { id: 38, name: "현우", university: "고려대학교", university_id: 1, major: "기계공학", year: 3, languages: ["ko", "en"], interests: ["walking", "royal"], intro: "정릉과 성곽길을 자주 걸어요. 할랄 식당도 안내할 수 있어요.", avatar: "illust_06", available_dates: ["2027-01-13", "2027-01-14", "2027-01-15"], rating: 4.7, review_count: 4, hourly_fee: 15000,
    personality: ["calm"], style: ["slow_walk", "explore"], can_help: ["halal_food", "subway"], sub_scores: { kind: 4.7, talk: 4.6, punctual: 4.9, local: 4.8 }, tags_top: ["easy_guide"], walk_count: 4, can_drive: false, grade: "basic", verified: { school_email: true, trained: true } },
  { id: 35, name: "서연", university: "국민대학교", university_id: 2, major: "영문학", year: 3, languages: ["ko", "en"], interests: ["literature", "craft"], intro: "영어 토론 동아리. 공예 체험 같이 가요.", avatar: "illust_05", available_dates: ["2027-01-13", "2027-01-17"], rating: 4.9, review_count: 6, hourly_fee: 15000,
    personality: ["listener", "calm"], style: ["cafe_break"], can_help: ["vegan_food", "shopping"], sub_scores: { kind: 4.9, talk: 4.9, punctual: 4.8, local: 4.8 }, tags_top: ["cares_requests", "fun_talk"], walk_count: 6, can_drive: false, grade: "basic", verified: { school_email: true, trained: true } },
  { id: 33, name: "하린", university: "고려대학교", university_id: 1, major: "관광학", year: 4, languages: ["ko", "en", "zh"], interests: ["food", "cafe"], intro: "교환학생 버디 경험 2회. 성북동 국수 골목 안내해요.", avatar: "illust_03", available_dates: ["2027-01-14", "2027-01-16"], rating: 0, review_count: 0, hourly_fee: 15000,
    personality: ["lively"], style: ["explore"], can_help: ["halal_food", "shopping"], sub_scores: null, tags_top: [], walk_count: 0, can_drive: false, grade: "basic", verified: { school_email: true, trained: true } },
  { id: 34, name: "도윤", university: "고려대학교", university_id: 1, major: "경영", year: 2, languages: ["ko", "en"], interests: ["walking", "sports"], intro: "캠퍼스 투어와 야경 산책 담당.", avatar: "illust_04", available_dates: ["2027-01-20", "2027-01-21"], rating: 0, review_count: 0, hourly_fee: 15000,
    personality: ["humor"], style: ["explore"], can_help: ["photo"], sub_scores: null, tags_top: [], walk_count: 0, can_drive: false, grade: "basic", verified: { school_email: true, trained: false } },
  { id: 39, name: "가은", university: "서울시립대학교", major: "도시공학", year: 3, languages: ["ko", "en"], interests: ["walking", "architecture"], intro: "정릉동에 살아요. 동네 산책길과 버스 타는 법을 잘 알아요.", avatar: "illust_04", available_dates: [], rating: 0, review_count: 0, hourly_fee: 15000,
    personality: ["calm"], style: ["slow_walk", "explore"], can_help: ["subway", "photo"], sub_scores: null, tags_top: [], walk_count: 0, can_drive: false, grade: "basic", verified: { school_email: false, trained: true, residence: true } },
  { id: 36, name: "준서", university: "고려대학교", university_id: 1, major: "건축학", year: 4, languages: ["ko", "en", "ja"], interests: ["hanok", "architecture"], intro: "근대 건축과 한옥 이야기를 좋아해요.", avatar: "illust_06", available_dates: ["2027-01-14", "2027-01-15"], rating: 4.3, review_count: 5, hourly_fee: 15000,
    personality: ["humor"], style: ["explore", "photo_walk"], can_help: ["photo"], sub_scores: { kind: 4.1, talk: 4.3, punctual: 4.2, local: 4.6 }, tags_top: ["knows_food"], walk_count: 5, can_drive: true, grade: "basic", verified: { school_email: true, trained: true } },
];

/** 초기 버디 상태 — BD-01 은 approved 만 노출 */
export const buddyStatus: Record<number, BuddyStatus> = { 31: "approved", 32: "approved", 35: "approved", 37: "approved", 38: "approved", 33: "pending", 34: "pending", 39: "pending", 36: "suspended" };

/** 관리자 화면용 (AD-04): 자격 경로(v3.7)·학교 메일·나이·약속 동의·교육 영상·퀴즈 (한국 국적 확인은 모두 완료).
 *  가은(39)은 성북구 거주 경로(서울시립대) — 서류 두 장은 예전 데모 값이라 자리 표시 타일로 보인다 */
export interface AdminInfo {
  email: string; age: number; school_email_verified: boolean; code_agreed: boolean; quiz_score: number | null; korean_national?: boolean;
  eligibility: Eligibility; school_name?: string | null; residence_proof_url?: string | null; enrollment_proof_url?: string | null; videos_watched: number;
}
export const buddyAdminInfo: Record<number, AdminInfo> = {
  31: { email: "jiwoo@a-univ.ac.kr", age: 22, school_email_verified: true, code_agreed: true, quiz_score: 9, eligibility: "school_email", videos_watched: 5 },
  32: { email: "minho@kookmin.ac.kr", age: 21, school_email_verified: true, code_agreed: true, quiz_score: 9, eligibility: "school_email", videos_watched: 5 },
  33: { email: "harin@korea.ac.kr", age: 22, school_email_verified: true, code_agreed: true, quiz_score: 9, eligibility: "school_email", videos_watched: 5 },
  34: { email: "doyun@korea.ac.kr", age: 20, school_email_verified: true, code_agreed: true, quiz_score: 7, eligibility: "school_email", videos_watched: 5 },
  35: { email: "seoyeon@kookmin.ac.kr", age: 22, school_email_verified: true, code_agreed: true, quiz_score: 9, eligibility: "school_email", videos_watched: 5 },
  36: { email: "junseo@korea.ac.kr", age: 24, school_email_verified: true, code_agreed: true, quiz_score: 9, eligibility: "school_email", videos_watched: 5 },
  37: { email: "sua@a-univ.ac.kr", age: 20, school_email_verified: true, code_agreed: true, quiz_score: 10, eligibility: "school_email", videos_watched: 5 },
  38: { email: "hyunwoo@korea.ac.kr", age: 23, school_email_verified: true, code_agreed: true, quiz_score: 8, eligibility: "school_email", videos_watched: 5 },
  39: { email: "gaeun@example.com", age: 22, school_email_verified: false, code_agreed: true, quiz_score: 9, eligibility: "residence", school_name: "서울시립대학교",
    residence_proof_url: "residence_proof_gaeun.jpg", enrollment_proof_url: "enrollment_gaeun.jpg", videos_watched: 5 },
};
/** v3.7 등급 (2027-01-01 평가 = 2026년 12월 동행, 2027-01-14 기준) + 휴면.
 * 지우 성장(12월 4회), 수아 기본(여름엔 성장이었지만 9월부터 동행 0회) + 8/19 이후 활동이 없어 1/7부터 휴면.
 * 현우는 12월 3회라 성장에 1회 모자라 기본, 서연은 12/3 승인이라 첫 달 기본 */
export interface GradeRow {
  grade: BuddyGrade; approved_on: string | null; evaluated_for: string | null;
  last_month_walks: number; this_month_walks: number; reviews: number; rating: number | null;
  needs_recheck: boolean; dormant_since: string | null;
}
export const GRADE_UPDATED = "2027-01-01";
/** 평가 달 (지난달) */
export const EVAL_MONTH = "2026-12";
export const NEXT_EVAL_ON = "2027-02-01";
export const buddyGrades: Record<number, GradeRow> = {
  31: { grade: "growth", approved_on: "2026-06-15", evaluated_for: "2026-12", last_month_walks: 4, this_month_walks: 3, reviews: 9, rating: 4.8, needs_recheck: false, dormant_since: null },
  37: { grade: "basic", approved_on: "2026-06-12", evaluated_for: "2026-12", last_month_walks: 0, this_month_walks: 0, reviews: 7, rating: 4.8, needs_recheck: true, dormant_since: "2027-01-07" },
  32: { grade: "basic", approved_on: "2026-11-03", evaluated_for: "2026-12", last_month_walks: 0, this_month_walks: 1, reviews: 8, rating: 4.7, needs_recheck: false, dormant_since: null },
  35: { grade: "basic", approved_on: "2026-12-03", evaluated_for: "2026-12", last_month_walks: 2, this_month_walks: 1, reviews: 6, rating: 4.9, needs_recheck: false, dormant_since: null },
  36: { grade: "basic", approved_on: "2026-11-02", evaluated_for: "2026-12", last_month_walks: 2, this_month_walks: 2, reviews: 5, rating: 4.3, needs_recheck: false, dormant_since: null },
  38: { grade: "basic", approved_on: "2026-11-02", evaluated_for: "2026-12", last_month_walks: 3, this_month_walks: 1, reviews: 4, rating: 4.7, needs_recheck: false, dormant_since: null },
  33: { grade: "basic", approved_on: null, evaluated_for: "2026-12", last_month_walks: 0, this_month_walks: 0, reviews: 0, rating: null, needs_recheck: false, dormant_since: null },
  34: { grade: "basic", approved_on: null, evaluated_for: "2026-12", last_month_walks: 0, this_month_walks: 0, reviews: 0, rating: null, needs_recheck: false, dormant_since: null },
  39: { grade: "basic", approved_on: null, evaluated_for: "2026-12", last_month_walks: 0, this_month_walks: 0, reviews: 0, rating: null, needs_recheck: false, dormant_since: null },
};
/** 확정 때 고정한 정산율 (item_id → rate). 지우 1월 동행은 1/1 갱신 후 확정이라 75% */
export const itemRates: Record<number, number> = { 3: 0.75, 31: 0.75, 41: 0.75, 52: 0.75, 13: 0.7, 62: 0.7, 63: 0.7, 81: 0.7 };

/** 지우 정산 계좌 (응답은 마스킹) */
export const BANK_ACCOUNT = "신한 110-123-456482";
export const BANK_ACCOUNT_MASKED = "신한 110-***-***482";

export const packages: Package[] = [
  { id: 1, title: "문인의 성북 3박", title_en: "Writers' Seongbuk · 3 nights", description: "기숙사 2인실, 버디 1회, 문인 산책 코스", nights: 3, total_price: 135000, dorm_room_id: 10, tour_id: 3, buddy_profile_id: 31 },
  { id: 2, title: "왕릉과 성곽 2박", title_en: "Royal Tomb & Wall · 2 nights", description: "기숙사 2인실, 버디 1회, 정릉과 성곽길 코스", nights: 2, total_price: 100000, dorm_room_id: 10, tour_id: 5, buddy_profile_id: 38 },
  { id: 3, title: "독립운동 1박 2일", title_en: "Independence Trail · 1 night", description: "기숙사 1인실, 버디 1회, 독립운동가의 길 코스", nights: 1, total_price: 70000, dorm_room_id: 11, tour_id: 4, buddy_profile_id: 37 },
];

export const reviews: Record<string, Review[]> = {
  "buddy:31": [
    { id: 3, rating: 5, text: "We talked about poetry over coffee.", author: "Lena", created_at: "2027-01-07", sub_scores: { kind: 5, talk: 5, punctual: 5, local: 4 }, tags: ["fun_talk", "good_photos"] },
    { id: 4, rating: 5, text: "지우 found a vegan place for me near campus!", author: "Mia", created_at: "2026-12-29", sub_scores: { kind: 5, talk: 4, punctual: 5, local: 5 }, tags: ["knows_food", "cares_requests"] },
    { id: 5, rating: 4, text: "Calm and kind. Great photos at Gilsangsa.", author: "Hana", created_at: "2026-12-15", sub_scores: { kind: 5, talk: 5, punctual: 5, local: 5 }, tags: ["good_photos"] },
  ],
  "buddy:32": [{ id: 6, rating: 5, text: "Knows every alley with a good view.", author: "Tom", created_at: "2026-11-23", sub_scores: { kind: 5, talk: 4, punctual: 5, local: 5 }, tags: ["easy_guide"] }],
};

// ---- 예약 (모든 여행자). 파생 필드(meal_used·album_photos·can_review 등)는 목 라우터가 채운다.
const DR = (d: number) => dorms.find((x) => x.id === d)!;
export const bookings: Booking[] = [
  { id: 501, code: "SB-2027-0112", status: "confirmed", total_price: 180000, platform_fee: 19250, created_at: "2027-01-05T10:00:00Z", paid_at: "2027-01-05T10:05:00Z",
    traveler: { name: "Emma Clark", nationality: "US", email: "emma@example.com", emergency_contact: "+1 555 0100", guests: 1 },
    items: [
      { id: 1, type: "dorm", ref_id: 10, title: "고려대학교 프런티어관 2인실", meta: "1/12 – 1/15 · 3박", status: "approved", price: 105000, date_from: "2027-01-12", date_to: "2027-01-15", request: { late_checkin: false, quiet_room: true, low_floor: false } },
      { id: 3, type: "buddy", ref_id: 31, title: "지우와 동네 걷기", meta: "1/13 14:00 · 2시간", status: "confirmed", price: 75000, date_from: "2027-01-13", time: "14:00", duration_min: 120,
        request: { diet: ["vegan"], allergies: ["mushroom"], pace: "slow", places: [104, 102], note: "무릎이 안 좋아서 언덕은 천천히 가고 싶어요." },
        course_id: 3, course_title: "문인의 성북동 산책", meal_count: 2, meal_deposit: 40000, album: true },
    ] },
  { id: 480, code: "SB-2026-1120", status: "confirmed", total_price: 90000, platform_fee: 9000, created_at: "2026-11-10T09:00:00Z", paid_at: "2026-11-10T09:02:00Z",
    traveler: { name: "Emma Clark", nationality: "US", email: "emma@example.com", guests: 1 },
    items: [
      { id: 11, type: "dorm", ref_id: 12, title: "국민대학교 정릉생활관 2인실", meta: "11/20 – 11/22 · 2박", status: "confirmed", price: 60000, date_from: "2026-11-20", date_to: "2026-11-22" },
      { id: 13, type: "buddy", ref_id: 32, title: "민호와 동네 걷기", meta: "11/21 14:00 · 2시간", status: "confirmed", price: 30000, date_from: "2026-11-21", time: "14:00", duration_min: 120,
        request: { diet: [], allergies: [], pace: "normal", places: [105], note: "" }, course_id: 5, course_title: "정릉과 성곽길", meal_count: 0, meal_deposit: 0, album: false },
    ] },
  { id: 470, code: "SB-2026-0812", status: "cancelled", total_price: 90000, platform_fee: 9000, created_at: "2026-08-01T09:00:00Z", cancelled_at: "2026-08-05T09:00:00Z",
    traveler: { name: "Emma Clark", nationality: "US", email: "emma@example.com", guests: 1 },
    items: [
      { id: 21, type: "dorm", ref_id: 12, title: "국민대학교 정릉생활관 2인실", meta: "8/12 – 8/14 · 2박", status: "cancelled", price: 60000, date_from: "2026-08-12", date_to: "2026-08-14" },
      { id: 22, type: "buddy", ref_id: 32, title: "민호와 동네 걷기", meta: "8/13 14:00 · 2시간", status: "cancelled", price: 30000, date_from: "2026-08-13", time: "14:00", duration_min: 120, meal_count: 0, meal_deposit: 0, album: false },
    ] },
  // --- 다른 여행자 (버디·관리자 화면용)
  { id: 503, code: "SB-2027-0103", status: "confirmed", total_price: 50000, platform_fee: 3000, created_at: "2027-01-03T08:00:00Z", paid_at: "2027-01-03T08:01:00Z",
    traveler: { name: "Lena Weber", nationality: "DE", email: "lena@example.com", guests: 1 },
    items: [
      { id: 31, type: "buddy", ref_id: 31, title: "지우와 동네 걷기", meta: "1/6 14:00 · 2시간", status: "confirmed", price: 50000, date_from: "2027-01-06", time: "14:00", duration_min: 120,
        request: { diet: [], allergies: [], pace: "normal", places: [104, 102], note: "I love poetry." }, course_id: 6, course_title: "길상사와 한옥 골목", meal_count: 1, meal_deposit: 20000, album: false },
    ] },
  { id: 504, code: "SB-2027-0107", status: "confirmed", total_price: 30000, platform_fee: 3000, created_at: "2027-01-07T08:00:00Z", paid_at: "2027-01-07T08:01:00Z",
    traveler: { name: "Mia Chen", nationality: "AU", email: "mia@example.com", guests: 1 },
    items: [
      { id: 41, type: "buddy", ref_id: 31, title: "지우와 동네 걷기", meta: "1/10 11:00 · 2시간", status: "confirmed", price: 30000, date_from: "2027-01-10", time: "11:00", duration_min: 120,
        request: { diet: ["vegetarian"], allergies: [], pace: "normal", places: [101], note: "" }, course_id: null, course_title: null, meal_count: 0, meal_deposit: 0, album: false },
    ] },
  { id: 505, code: "SB-2027-0104", status: "confirmed", total_price: 30000, platform_fee: 3000, created_at: "2027-01-04T08:00:00Z", paid_at: "2027-01-04T08:01:00Z",
    traveler: { name: "Tom Lee", nationality: "US", email: "tom@example.com", guests: 1 },
    items: [
      { id: 81, type: "buddy", ref_id: 36, title: "준서와 동네 걷기", meta: "1/9 15:00 · 2시간", status: "confirmed", price: 30000, date_from: "2027-01-09", time: "15:00", duration_min: 120, request: { diet: [], allergies: [], pace: "normal", places: [], note: "" }, meal_count: 0, meal_deposit: 0, album: false },
    ] },
  { id: 508, code: "SB-2027-0108", status: "confirmed", total_price: 320000, platform_fee: 30000, created_at: "2027-01-02T12:00:00Z", paid_at: "2027-01-02T12:03:00Z",
    traveler: { name: "Yuki Sato", nationality: "JP", email: "yuki@example.com", guests: 1 },
    items: [
      { id: 61, type: "dorm", ref_id: 12, title: "국민대학교 정릉생활관 2인실", meta: "1/8 – 1/16 · 8박", status: "approved", price: 240000, date_from: "2027-01-08", date_to: "2027-01-16" },
      { id: 62, type: "buddy", ref_id: 35, title: "서연과 동네 걷기", meta: "1/9 12:00 · 2시간", status: "confirmed", price: 50000, date_from: "2027-01-09", time: "12:00", duration_min: 120,
        request: { diet: ["no_pork"], allergies: ["seafood"], pace: "normal", places: [], note: "" }, course_id: null, course_title: null, meal_count: 1, meal_deposit: 20000, album: false },
      { id: 63, type: "buddy", ref_id: 36, title: "준서와 동네 걷기", meta: "1/15 14:00 · 2시간", status: "confirmed", price: 30000, date_from: "2027-01-15", time: "14:00", duration_min: 120,
        request: { diet: [], allergies: [], pace: "normal", places: [103], note: "" }, course_id: 4, course_title: "독립운동가의 길", meal_count: 0, meal_deposit: 0, album: false },
    ] },
  { id: 506, code: "SB-2027-0119", status: "confirmed", total_price: 110000, platform_fee: 11000, created_at: "2027-01-06T09:00:00Z", paid_at: "2027-01-06T09:02:00Z",
    traveler: { name: "Lucas Martin", nationality: "FR", email: "lucas@example.com", guests: 1 },
    items: [
      { id: 51, type: "dorm", ref_id: 11, title: "고려대학교 프런티어관 1인실", meta: "1/19 – 1/21 · 2박", status: "approved", price: 80000, date_from: "2027-01-19", date_to: "2027-01-21" },
      { id: 52, type: "buddy", ref_id: 31, title: "지우와 동네 걷기", meta: "1/20 11:00 · 2시간", status: "confirmed", price: 30000, date_from: "2027-01-20", time: "11:00", duration_min: 120,
        request: { diet: [], allergies: [], pace: "normal", places: [104], note: "Lunch at a noodle place?" }, course_id: 6, course_title: "길상사와 한옥 골목", meal_count: 0, meal_deposit: 0, album: false },
    ] },
  { id: 509, code: "SB-2027-0121", status: "requested", total_price: 164000, platform_fee: 14400, created_at: "2027-01-09T21:00:00Z", paid_at: "2027-01-09T21:02:00Z",
    traveler: { name: "Sofia Rossi", nationality: "IT", email: "sofia@example.com", guests: 1 },
    items: [
      { id: 71, type: "dorm", ref_id: 18, title: `고려대학교 ${DR(18).building} 2인실`, meta: "1/21 – 1/24 · 3박", status: "requested", price: 114000, date_from: "2027-01-21", date_to: "2027-01-24", request: { late_checkin: true, quiet_room: false, low_floor: false } },
      { id: 72, type: "buddy", ref_id: 31, title: "지우와 동네 걷기", meta: "1/22 14:00 · 2시간", status: "requested", price: 50000, date_from: "2027-01-22", time: "14:00", duration_min: 120,
        request: { diet: ["vegetarian"], allergies: ["nuts"], pace: "normal", places: [104, 106], note: "한옥 사진을 많이 찍고 싶어요." }, course_id: 6, course_title: "길상사와 한옥 골목", meal_count: 1, meal_deposit: 20000, album: false },
    ] },
  { id: 507, code: "SB-2027-0118", status: "requested", total_price: 240000, platform_fee: 24000, created_at: "2027-01-08T09:00:00Z",
    traveler: { name: "김민지", nationality: "KR", email: "minji@example.com", guests: 1 },
    items: [
      { id: 91, type: "dorm", ref_id: 12, title: "국민대학교 정릉생활관 2인실", meta: "1/19 – 1/26 · 7박", status: "requested", price: 210000, date_from: "2027-01-19", date_to: "2027-01-26" },
      { id: 92, type: "buddy", ref_id: 32, title: "민호와 동네 걷기", meta: "1/20 14:00 · 2시간", status: "requested", price: 30000, date_from: "2027-01-20", time: "14:00", duration_min: 120, request: { diet: [], allergies: [], pace: "normal", places: [], note: "" }, meal_count: 0, meal_deposit: 0, album: false },
    ] },
  { id: 460, code: "SB-2026-1220", status: "cancelled", total_price: 30000, platform_fee: 3000, created_at: "2026-12-10T09:00:00Z",
    traveler: { name: "Oliver Brown", nationality: "GB", email: "oliver@example.com", guests: 1 },
    items: [{ id: 30, type: "buddy", ref_id: 31, title: "지우와 동네 걷기", meta: "12/20 10:00 · 2시간", status: "rejected", price: 30000, date_from: "2026-12-20", time: "10:00", duration_min: 120, reject_reason: "시험 기간이에요", meal_count: 0, meal_deposit: 0, album: false }] },
];
/** 예약 소유자 (BK-04 /bookings/me) */
export const bookingOwner: Record<number, string> = Object.fromEntries(bookings.map((b) => [b.id, b.traveler?.email ?? ""]));
/** 이미 후기를 쓴 항목 */
export const reviewedItems: number[] = [31, 41];

export const NATIONALITY_KO: Record<string, string> = { US: "미국", DE: "독일", AU: "호주", FR: "프랑스", JP: "일본", IT: "이탈리아", KR: "한국", GB: "영국", CN: "중국" };
export const TOURIST_LANG: Record<string, string> = { US: "영어", DE: "영어", AU: "영어", FR: "영어", JP: "영어", IT: "영어", KR: "한국어", GB: "영어", CN: "중국어" };
export const TOURIST_INTERESTS: Record<number, string[]> = { 501: ["한국 문학", "독립운동"], 503: ["한국 문학", "카페"], 504: ["로컬 음식"], 506: ["한옥", "로컬 음식"], 508: ["산책"], 509: ["한옥", "사진"], 460: ["카페"] };

// ---- 버디 활동 기록 (BD 활동 기록, 공개 목록은 날짜 ≤ TODAY 만)
export interface ActivityRow { id: number; buddy_id: number; item_id: number | null; date: string; places: string[]; foods: string | null; note: string | null; photos: string[]; created_at: string }
const photos = (key: string, n: number) => Array.from({ length: n }, (_, i) => `/album/${key}-${i + 1}.jpg`);
export const activities: ActivityRow[] = [
  { id: 1, buddy_id: 31, item_id: 31, date: "2027-01-06", places: ["길상사", "수연산방"], foods: "대추차, 단팥죽", note: "Lena가 백석 시를 좋아해서 길상사에서 오래 머물렀어요.", photos: photos("0106", 3), created_at: "2027-01-06T18:30:00Z" },
  { id: 2, buddy_id: 31, item_id: null, date: "2027-01-04", places: ["캠퍼스", "성북천 산책"], foods: "학교 앞 비건 김밥", note: "새 버디 동선 미리 걸어 보기", photos: photos("0104", 2), created_at: "2027-01-04T17:00:00Z" },
  { id: 3, buddy_id: 31, item_id: 3, date: "2027-01-13", places: ["최순우 옛집", "수연산방", "심우장", "길상사"], foods: "비건 비빔밥", note: "언덕은 천천히, 수연산방에서 오래 쉬었어요.", photos: photos("0113", 6), created_at: "2027-01-13T17:10:00Z" },
  { id: 4, buddy_id: 32, item_id: 13, date: "2026-11-21", places: ["정릉", "선잠박물관"], foods: "성북동 칼국수", note: null, photos: photos("1121", 2), created_at: "2026-11-21T17:00:00Z" },
];

// ---- 식비 청구
export interface MealClaimRow { id: number; item_id: number; buddy_id: number; date: string; place: string; items: string; amount: number; receipt_url: string | null; status: MealClaimStatus; reason: string | null; created_at: string; traveler_agreed_over?: boolean }
export const mealClaims: MealClaimRow[] = [
  { id: 1, item_id: 31, buddy_id: 31, date: "2027-01-06", place: "수연산방", items: "대추차, 단팥죽", amount: 18000, receipt_url: "/receipts/1.jpg", status: "approved", reason: null, created_at: "2027-01-06T17:00:00Z" },
  { id: 2, item_id: 62, buddy_id: 35, date: "2027-01-09", place: "성북동 국숫집", items: "칼국수 2그릇", amount: 16000, receipt_url: "/receipts/2.jpg", status: "requested", reason: null, created_at: "2027-01-09T14:10:00Z" },
  { id: 3, item_id: 3, buddy_id: 31, date: "2027-01-13", place: "수연산방", items: "대추차, 단팥죽", amount: 23500, receipt_url: "/receipts/3.jpg", status: "requested", reason: null, created_at: "2027-01-13T16:20:00Z", traveler_agreed_over: true },
];

// ---- 신고
export interface ReportRow { id: number; booking_item_id: number | null; reporter: string; buddy_id: number; category: ReportCategory; text: string; photo_url: string | null; status: ReportStatus; action: string | null; auto_suspended: boolean; created_at: string; resolved_at: string | null }
export const reports: ReportRow[] = [
  { id: 2, booking_item_id: 63, reporter: "Yuki Sato", buddy_id: 36, category: "rude", text: "동행 중에 외모 이야기를 계속해서 불편했어요.", photo_url: "/reports/2.jpg", status: "open", action: null, auto_suspended: true, created_at: "2027-01-15T18:20:00+09:00", resolved_at: null },
  { id: 1, booking_item_id: 81, reporter: "Tom Lee", buddy_id: 36, category: "no_show", text: "약속 장소에 30분 넘게 오지 않았어요.", photo_url: null, status: "resolved", action: "warn", auto_suspended: false, created_at: "2027-01-10T11:05:00+09:00", resolved_at: "2027-01-10T15:00:00+09:00" },
];

// ---- 버디 교육 퀴즈 (10문제, 8개 이상 통과). answer 는 보기 번호(0부터) — 응답에는 넣지 않는다
export const quiz: (QuizQuestion & { answer: number })[] = [
  { id: 1, text: "여행자가 처음 만나는 장소를 못 찾고 있어요. 어떻게 할까요?", options: ["앱 채팅으로 위치 사진을 보내고 기다려요", "10분 기다리다 연락 없이 돌아가요", "여행자가 알아서 찾게 둬요"], answer: 0 },
  { id: 2, text: "여행자가 밥값을 대신 내 달라며 현금을 더 주려고 해요.", options: ["고맙게 받아요", "정중히 거절하고, 식사는 식비 보증금 한도 안에서만 써요", "다음에 만날 때 받아요"], answer: 1 },
  { id: 3, text: "여행자가 버섯 알레르기가 있다고 적었어요. 식당에서 어떻게 할까요?", options: ["메뉴에 버섯이 없어 보이면 그냥 주문해요", "주문 전에 직원에게 버섯이 들어가는지 꼭 물어봐요", "여행자가 알아서 고르게 해요"], answer: 1 },
  { id: 4, text: "식사 1회 한도(2인)는 얼마인가요?", options: ["₩10,000", "₩20,000", "₩50,000"], answer: 1 },
  { id: 5, text: "여행자의 여권 번호나 연락처를 SNS에 올려도 될까요?", options: ["허락 없이는 절대 안 돼요", "얼굴만 가리면 돼요", "친구에게만 보내요"], answer: 0 },
  { id: 6, text: "버디는 역사 해설을 어떻게 하나요?", options: ["자격증 없이 길게 해설해요", "장소 이야기는 앱의 AI 이야기를 함께 듣고, 버디는 친구처럼 동행해요", "해설은 하지 않고 말도 하지 않아요"], answer: 1 },
  { id: 7, text: "여행자가 몸이 안 좋다고 해요. 가장 먼저 할 일은?", options: ["일정을 그대로 진행해요", "쉬게 하고, 필요하면 119·1330에 연락하고 운영팀에 알려요", "숙소에 혼자 보내요"], answer: 1 },
  { id: 8, text: "동행이 끝나면 무엇을 남기나요?", options: ["아무것도 안 남겨요", "활동 기록(다닌 곳·음식·사진)과 식비 영수증", "여행자 개인 연락처"], answer: 1 },
  { id: 9, text: "요청 사항에 '천천히 걷기'가 있어요.", options: ["언덕이 적은 길로 쉬어 가며 걸어요", "시간이 없으니 빨리 걸어요", "택시만 타요"], answer: 0 },
  { id: 10, text: "여행자가 불편해하는 농담을 계속하면?", options: ["분위기를 위해 계속해요", "바로 멈추고 사과해요. 신고가 2건 쌓이면 활동이 정지돼요", "여행자에게 참으라고 해요"], answer: 1 },
  // v3.7 길·안전·역사 기본 상식 (사전 교육 영상 내용)
  { id: 11, text: "고려대·안암 쪽에서 여행자와 지하철을 타려고 해요. 가까운 역은?", options: ["6호선 안암역·고려대역", "2호선 강남역", "9호선 여의도역"], answer: 0 },
  { id: 12, text: "동행 중 여행자가 갑자기 많이 아파요. 어떻게 할까요?", options: ["내 차로 가까운 병원에 데려다줘요", "119에 전화하고, 앱으로 운영팀에도 알려요", "조금 쉬면 나을 테니 기다려요"], answer: 1 },
  { id: 13, text: "한양도성(서울 성곽)에 대해 맞는 것은? (해설이 아니라 기본 상식)", options: ["조선 시대 서울을 둘러싼 성곽이고, 성북구에도 성곽길이 있어요", "일제강점기에 처음 쌓은 담이에요", "성북구는 지나가지 않아요"], answer: 0 },
];
/** 목업이 내는 10문제 (13문제 중. 백엔드는 지원자마다 고른다) — 돈(2) · 해설(6) · 응급(7)은 늘 */
export const QUIZ_SHOWN = [1, 2, 3, 6, 7, 9, 10, 11, 12, 13];

/** v3.7 사전 교육 영상 (퀴즈 전). 데모: 영상 파일은 아직 없다 */
export const educationVideos: { id: string; title: string; topics: string; duration_sec: number }[] = [
  { id: "seongbuk_overview", title: "성북구 한눈에 보기", topics: "주요 장소와 동네: 성북동·정릉·안암·돈암·길음", duration_sec: 180 },
  { id: "getting_around", title: "길 안내와 교통", topics: "지하철 4·6호선·우이신설선, 마을버스, 택시 부르기", duration_sec: 150 },
  { id: "safety", title: "안전과 응급", topics: "가까운 병원·약국·화장실, 112·119·1330", duration_sec: 160 },
  { id: "history_basics", title: "역사 기본 상식", topics: "한양도성·성북동 문인·독립운동 — 해설이 아니라 기본 상식", duration_sec: 200 },
  { id: "promises", title: "버디 약속과 하지 말 것", topics: "유료 해설·차량 동행 금지, 앱 밖에서 돈 받지 않기", duration_sec: 120 },
];

export const notifications: Notification[] = [
  { id: 1, type: "item_approved", title: "숙박 승인됨 · 고려대학교 프런티어관 1/12–1/15", read_at: null, created_at: "2027-01-06T09:00:00Z" },
  { id: 2, type: "item_confirmed", title: "버디 수락됨 · 지우 1/13 14:00", read_at: null, created_at: "2027-01-06T12:00:00Z" },
  { id: 3, type: "meal_claim", title: "식비 청구 · 지우 · 수연산방 ₩23,500 (한도 초과분 동의)", read_at: "2027-01-07T11:00:00Z", created_at: "2027-01-07T10:05:00Z" },
];

export const buddyNotifications: Notification[] = [
  { id: 101, type: "item_requested", title: "새 동행 요청 · Sofia · 1/22 14:00", read_at: null, created_at: "2027-01-09T21:05:00Z" },
  { id: 102, type: "meal_claim", title: "식비 확인 중 · Emma · ₩23,500", read_at: null, created_at: "2027-01-08T08:20:00Z" },
  { id: 103, type: "profile_approved", title: "버디 프로필 승인됨 · 고려대학교", read_at: "2027-01-02T09:00:00Z", created_at: "2027-01-02T09:00:00Z" },
];

export const contents: ContentDoc[] = [
  { key: "intro", language: "ko", title: "성북동은요", body: "서울 도성 바로 바깥, 문화재가 가장 많은 동네예요. 정릉, 심우장, 길상사, 수연산방, 선잠박물관이 모두 걸어서 닿는 거리에 있어요." },
  { key: "intro", language: "en", title: "About Seongbuk", body: "Just outside Seoul's old city wall, the neighborhood with the most heritage sites. Jeongneung, Simujang, Gilsangsa, Suyeon Sanbang and the Seonjam Museum are all within walking distance." },
  { key: "terms", language: "ko", title: "이용약관", body: "본 서비스는 숙박(대학)과 교류(대학생 버디)를 연결하는 중개 플랫폼입니다. 숙박 판매 주체는 각 대학이며, 플랫폼은 예약·결제·연결을 담당합니다. 산책 코스는 무료입니다." },
  { key: "refund", language: "ko", title: "환불 규정", body: "체크인 7일 전까지 전액, 3일 전까지 절반, 그 뒤에는 안 돼요. 버디는 일정 48시간 전까지 전액. 식사 보증금은 쓰고 남은 만큼 여행이 끝나면 돌려드려요." },
  { key: "support", language: "ko", title: "고객센터 · 긴급연락처", body: "운영팀 +82-2-0000-0000 (09:00–18:00)\n긴급: 112 (경찰) · 119 (구급) · 1330 (관광 안내, 24시간 다국어)" },
];

export const dashboard: Dashboard = {
  period: { from: "2027-01-05", to: "2027-02-20" }, bookings: 24, pending: 3, nights: 72, dorm_revenue: 2520000, platform_fee: 252000, fee_rate: 0.1,
  by_status: { requested: 3, approved: 8, confirmed: 11, cancelled: 2 },
  daily: Array.from({ length: 14 }, (_, i) => ({ date: `2027-01-${String(5 + i).padStart(2, "0")}`, bookings: [1, 2, 1, 3, 2, 2, 1, 4, 2, 1, 2, 1, 1, 1][i], revenue: [35000, 70000, 40000, 105000, 70000, 70000, 35000, 140000, 70000, 35000, 70000, 40000, 35000, 35000][i] })),
};
