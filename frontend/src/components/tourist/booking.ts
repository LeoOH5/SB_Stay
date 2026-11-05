"use client";
// 예약 신청 공통 흐름 — BK-01 POST /bookings → 결제 (토스 결제창 또는 BK-06 목업) → 장바구니 비우기
import { post } from "@/lib/api";
import { writeLS } from "@/lib/store";
import { tossEnabled } from "@/lib/toss";
import type { Booking, CartItem, Traveler } from "@/lib/types";

/** needsPayment면 /pay?booking=id 로 보내 결제창을 띄운다 */
export async function submitBooking(traveler: Traveler, items: CartItem[]): Promise<{ booking: Booking; needsPayment: boolean }> {
  const booking = await post<Booking>("/bookings", { traveler, items });
  const needsPayment = tossEnabled();
  if (!needsPayment) await post(`/bookings/${booking.id}/pay`);
  writeLS("sbstay.cart", []);
  return { booking, needsPayment };
}
