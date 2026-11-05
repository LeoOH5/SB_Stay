"use client";
// 예약 신청 공통 흐름 — BK-01 POST /bookings → BK-06 POST /bookings/{id}/pay (목업) → 장바구니 비우기
import { post } from "@/lib/api";
import { writeLS } from "@/lib/store";
import type { Booking, CartItem, Traveler } from "@/lib/types";

export async function submitBooking(traveler: Traveler, items: CartItem[]): Promise<Booking> {
  const booking = await post<Booking>("/bookings", { traveler, items });
  await post(`/bookings/${booking.id}/pay`);
  writeLS("sbstay.cart", []);
  return booking;
}
