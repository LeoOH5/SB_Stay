// 토스페이먼츠 결제위젯 SDK v2 (https://js.tosspayments.com/v2/standard). 클라이언트 키: NEXT_PUBLIC_TOSS_CLIENT_KEY (test_gck_...)
import { USE_MOCK } from "@/lib/api";
import { PAYPAL_CLIENT_ID } from "@/lib/paypal";

export const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? "";
/** 실제 결제(토스 또는 PayPal)를 쓰는지. 키가 없거나 목업 모드면 예약 즉시 결제 완료(목업) */
export const paymentsEnabled = () => !USE_MOCK && (!!TOSS_CLIENT_KEY || !!PAYPAL_CLIENT_ID);

export interface PaymentOrder {
  enabled: boolean; booking_id: number; order_id: string; amount: number; order_name: string;
  customer_name: string; customer_email: string; customer_key: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global { interface Window { TossPayments?: any } }

let loader: Promise<any> | null = null;
export function loadTossPayments(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  if (window.TossPayments) return Promise.resolve(window.TossPayments);
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://js.tosspayments.com/v2/standard";
    s.async = true;
    s.onload = () => (window.TossPayments ? resolve(window.TossPayments) : reject(new Error("결제 모듈을 불러오지 못했어요")));
    s.onerror = () => { loader = null; reject(new Error("결제 모듈을 불러오지 못했어요")); };
    document.head.appendChild(s);
  });
  return loader;
}
