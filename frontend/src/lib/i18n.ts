"use client";
// 한/영 라벨. 관광객 화면은 영어 기준 UI(기획), 버디·어드민은 한국어.
import { useLS, writeLS } from "./store";

const KEY = "sbstay.lang";
export type L = "ko" | "en";
export const T = {
  ko: { home: "홈", stay: "숙박", tour: "투어", trips: "내 여행", buddy: "버디", plan: "AI로 여행 설계하기", cart: "장바구니", addToCart: "장바구니 담기", book: "예약 신청하기" },
  en: { home: "Home", stay: "Stay", tour: "Tours", trips: "My trips", buddy: "Buddies", plan: "Plan my stay with AI", cart: "Cart", addToCart: "Add to cart", book: "Request booking" },
} as const;

export function useLang() {
  const l = useLS<L>(KEY, "en");
  return { lang: l, t: T[l], set: (v: L) => writeLS(KEY, v) };
}
