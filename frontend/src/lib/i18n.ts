"use client";
// 한/영 라벨과 통화 표시. 관광객 화면은 영어 기준 UI(기획), 버디·어드민은 한국어.
// - 화면 문장: tr("한국어", "English") — 지금 언어에 맞는 쪽을 돌려준다.
// - 가격: money(원) — 내 정보의 '통화 표시'(KRW/USD)를 따른다. 결제 금액 자체는 바뀌지 않는다.
// useLang() 을 부른 화면이 렌더될 때 현재 언어·통화를 기억해 두므로, tr()·money() 는 훅이 아닌 함수로 어디서나 쓸 수 있다.
// (서버 렌더·하이드레이션 첫 화면은 기본값 en·KRW 로 같게 나오고, 그 뒤 저장된 값으로 다시 그린다.)
import { useLS, writeLS } from "./store";

const KEY = "sbstay.lang";
export const CURRENCY_KEY = "sbstay.currency";
export type L = "ko" | "en";
export type Currency = "KRW" | "USD";
/** 표시용 고정 환율 — 백엔드 USD_KRW_RATE(PayPal 청구 환율)와 같은 값 */
export const USD_KRW = Number(process.env.NEXT_PUBLIC_USD_KRW_RATE ?? 1400) || 1400;

export const T = {
  ko: { home: "홈", stay: "숙박", tour: "코스", trips: "내 여행", buddy: "버디", plan: "AI로 여행 설계하기", cart: "장바구니", addToCart: "장바구니 담기", book: "예약 신청하기" },
  en: { home: "Home", stay: "Stay", tour: "Walks", trips: "My trips", buddy: "Buddies", plan: "Plan my stay with AI", cart: "Cart", addToCart: "Add to cart", book: "Request booking" },
} as const;

let CURRENT_LANG: L = "en";
let CURRENT_CUR: Currency = "KRW";
/** 렌더 중 현재 언어·통화를 기억 (tr·money 가 읽는다) */
function remember(l: L, c: Currency) { CURRENT_LANG = l; CURRENT_CUR = c; }

export function useLang() {
  const l = useLS<L>(KEY, "en");
  const cur = useLS<Currency>(CURRENCY_KEY, "KRW");
  remember(l, cur);
  return { lang: l, t: T[l], set: (v: L) => writeLS(KEY, v), currency: cur, tr, money };
}

/** 지금 언어 */
export const curLang = (): L => CURRENT_LANG;
/** 한/영 중 지금 언어에 맞는 문장 */
export function tr(ko: string, en: string): string {
  return CURRENT_LANG === "en" ? en : ko;
}
/** 원 단위 금액을 지금 통화로 — KRW: ₩135,000 · USD: $96.43 */
export function money(krw: number): string {
  if (CURRENT_CUR === "USD") {
    const usd = Math.round((krw / USD_KRW) * 100) / 100;
    const s = Math.abs(usd).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${usd < 0 ? "-" : ""}$${s}`;
  }
  return `${krw < 0 ? "-" : ""}₩${Math.abs(krw).toLocaleString("ko-KR")}`;
}
