// PayPal JS SDK (Buttons). 외국인 결제 — PayPal 계정 또는 해외 카드, USD 청구. 클라이언트 ID: NEXT_PUBLIC_PAYPAL_CLIENT_ID
export const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? "";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global { interface Window { paypal?: any } }

let loader: Promise<any> | null = null;
export function loadPayPal(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  if (window.paypal?.Buttons) return Promise.resolve(window.paypal);
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    const q = new URLSearchParams({ "client-id": PAYPAL_CLIENT_ID, currency: "USD", intent: "capture", components: "buttons", locale: "en_US" });
    s.src = `https://www.paypal.com/sdk/js?${q.toString()}`;
    s.async = true;
    s.onload = () => (window.paypal?.Buttons ? resolve(window.paypal) : reject(new Error("PayPal을 불러오지 못했어요")));
    s.onerror = () => { loader = null; reject(new Error("PayPal을 불러오지 못했어요")); };
    document.head.appendChild(s);
  });
  return loader;
}
