"use client";
// 서버 데이터(버디 소개·전공·이름, 활동 기록의 장소·음식·메모)는 한국어로만 저장돼 있다.
// 영어 화면에서는 시드 문구를 아래 표로 바꾸고, 표에 없는 이름은 로마자로, 그 밖의 문장은 그대로 둔다.
import { curLang } from "./i18n";

const NAME_EN: Record<string, string> = {
  지우: "Jiwoo", 민호: "Minho", 하린: "Harin", 도윤: "Doyun", 서연: "Seoyeon", 준서: "Junseo", 수아: "Sua", 가은: "Gaeun", 현우: "Hyunwoo",
};

const MAJOR_EN: Record<string, string> = {
  국어국문: "Korean Literature", 사학과: "History", 관광학: "Tourism", 경영: "Business", 영문학: "English Literature",
  건축학: "Architecture", 영어영문: "English Language & Literature", 도시공학: "Urban Engineering", 기계공학: "Mechanical Engineering",
};

const TEXT_EN: Record<string, string> = {
  // 버디 소개 (백엔드 시드)
  "성북동 골목이랑 캠퍼스 맛집을 같이 걸어요. 장소 이야기는 AI가, 저는 친구가 되어 드려요.": "Let's walk Seongbuk-dong's alleys and my favorite campus spots. The AI tells the history — I'll be your friend.",
  "성북동 답사 동아리에서 활동해요.": "I'm in a Seongbuk-dong heritage walking club.",
  "교환학생 버디 경험 2회.": "I've been a buddy for exchange students twice.",
  "캠퍼스 투어와 야경 산책 담당.": "I lead campus tours and night walks.",
  "영어 토론 동아리.": "I'm in an English debate club.",
  "근대 건축과 한옥 이야기를 좋아해요.": "I love modern architecture and hanok houses.",
  "사진 찍는 걸 좋아해요. 성북동 예쁜 카페 골목을 같이 걸어요.": "I love taking photos. Let's walk Seongbuk-dong's pretty café alleys together.",
  "정릉동에 살아요. 동네 산책길과 버스 타는 법을 잘 알아요.": "I live in Jeongneung-dong and know the local walking paths and buses well.",
  // 버디 소개 (프론트 목업)
  "성북동 골목이랑 캠퍼스 맛집을 같이 걸어요. 비건 식당도 몇 곳 알아요.": "Let's walk Seongbuk-dong's alleys and my favorite campus spots. I know a few vegan restaurants too.",
  "성북동 답사 동아리에서 활동해요. 사진 찍기 좋은 골목을 알아요.": "I'm in a Seongbuk-dong heritage walking club and know the best alleys for photos.",
  "정릉과 성곽길을 자주 걸어요. 할랄 식당도 안내할 수 있어요.": "I often walk Jeongneung and the fortress wall trail. I can show you halal restaurants too.",
  "영어 토론 동아리. 공예 체험 같이 가요.": "I'm in an English debate club. Let's try a craft class together.",
  "교환학생 버디 경험 2회. 성북동 국수 골목 안내해요.": "I've been a buddy for exchange students twice. I'll show you Seongbuk-dong's noodle alley.",
  // 활동 기록 — 음식
  "수연산방 대추차·단팥죽": "Jujube tea & red bean porridge at Suyeonsanbang",
  "수연산방 비건 단팥죽·대추차": "Vegan red bean porridge & jujube tea at Suyeonsanbang",
  "성북천 붕어빵": "Fish-shaped bread by Seongbukcheon",
  "정릉시장 빈대떡": "Mung bean pancakes at Jeongneung Market",
  "성북동 빵집 소금빵": "Salt bread from a Seongbuk-dong bakery",
  "대추차, 단팥죽": "Jujube tea, red bean porridge",
  "학교 앞 비건 김밥": "Vegan gimbap near campus",
  "비건 비빔밥": "Vegan bibimbap",
  "성북동 칼국수": "Seongbuk-dong kalguksu",
  // 활동 기록 — 메모
  "길상사 연못에서 오래 쉬었어요. 채식 메뉴를 미리 확인했어요.": "We rested by the pond at Gilsangsa. I checked the vegetarian menu in advance.",
  "언덕은 천천히, 버섯 없는 메뉴로 주문했어요.": "We took the hill slowly and ordered dishes without mushrooms.",
  "교환학생 친구와 겨울 산책": "A winter walk with an exchange student",
  "성곽길 사진 포인트 안내": "Showed the photo spots along the fortress wall",
  "골목 사진 포인트 위주로 걸었어요.": "We walked around the best alley photo spots.",
};

const PLACE_EN: Record<string, string> = {
  "최순우 옛집": "Choi Sunu's House", "수연산방(이태준 가옥)": "Suyeonsanbang", 수연산방: "Suyeonsanbang", 심우장: "Simujang",
  길상사: "Gilsangsa Temple", 정릉: "Jeongneung Royal Tomb", 성북선잠박물관: "Seonjam Museum", 선잠박물관: "Seonjam Museum",
  "한양도성 북악구간": "Hanyangdoseong (Bugak)", 선잠단지: "Seonjamdan Altar Site", 간송미술관: "Kansong Art Museum",
  한국가구박물관: "Korea Furniture Museum", 성북근현대문학관: "Seongbuk Museum of Modern Literature", "성북천(한성대입구역 분수마루)": "Seongbukcheon Stream",
  성북천: "Seongbukcheon Stream", "성북천 산책": "Seongbukcheon walk", 흥천사: "Heungcheonsa Temple", 의릉: "Uireung Royal Tomb",
  성북역사문화센터: "Seongbuk History and Culture Center", "성북동 이종석 별장": "Lee Jong-seok's Villa", 북정마을: "Bukjeong Village",
  성북구립미술관: "Seongbuk Museum of Art", 삼청각: "Samcheonggak", 경국사: "Gyeongguksa Temple", 우리옛돌박물관: "Korea Stone Art Museum",
  "성북동 골목": "Seongbuk-dong alleys", "성북동 카페 골목": "Seongbuk-dong café alley", 캠퍼스: "Campus",
};

// ---- 로마자 표기 (국어의 로마자 표기법 기본 규칙, 이름용) ----
const CHO = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"];
const JUNG = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"];
const JONG = ["", "k", "k", "k", "n", "n", "n", "t", "l", "l", "l", "l", "l", "l", "l", "l", "m", "p", "p", "t", "t", "ng", "t", "t", "k", "t", "p", "t"];
export function romanize(s: string): string {
  let out = "";
  for (const ch of s) {
    const c = ch.charCodeAt(0) - 0xac00;
    if (c < 0 || c > 11171) { out += ch; continue; }
    const cho = Math.floor(c / 588), jung = Math.floor((c % 588) / 28), jong = c % 28;
    out += CHO[cho] + JUNG[jung] + JONG[jong];
  }
  return out ? out[0].toUpperCase() + out.slice(1) : out;
}

const en = () => curLang() === "en";
/** 사람 이름 — en 이면 영어 이름(없으면 로마자) */
export const personName = (n?: string | null): string => {
  const s = n ?? "";
  if (!en() || !/[가-힣]/.test(s)) return s;
  return NAME_EN[s] ?? romanize(s);
};
/** 전공 */
export const majorText = (m?: string | null): string => (en() ? MAJOR_EN[m ?? ""] ?? (m ?? "") : (m ?? ""));
/** 버디 소개·활동 음식·메모 같은 시드 문장 (표에 없으면 그대로) */
export const dataText = (t?: string | null): string => (en() ? TEXT_EN[(t ?? "").trim()] ?? (t ?? "") : (t ?? ""));
/** 장소 이름 하나 */
export const placeText = (p?: string | null): string => (en() ? PLACE_EN[p ?? ""] ?? (p ?? "") : (p ?? ""));
/** 문장 안의 버디 이름을 바꾼다 ("지우와 동네 걷기" 같은 서버 문구용) */
export function namesIn(text: string): string {
  if (!en()) return text;
  return Object.keys(NAME_EN).reduce((acc, k) => acc.split(k).join(NAME_EN[k]), text);
}
