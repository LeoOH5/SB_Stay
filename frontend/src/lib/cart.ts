"use client";
// 장바구니 — localStorage 보관. 서버 상태 아님.
import { readLS, useLS, writeLS } from "./store";
import type { CartItem } from "./types";

const KEY = "sbstay.cart";
const EMPTY: CartItem[] = [];

export function useCart() {
  const items = useLS<CartItem[]>(KEY, EMPTY);
  const add = (item: CartItem) => writeLS(KEY, [...readLS<CartItem[]>(KEY, EMPTY).filter((i) => !(i.type === item.type && i.ref_id === item.ref_id)), item]);
  const remove = (type: CartItem["type"], ref_id: number) => writeLS(KEY, readLS<CartItem[]>(KEY, EMPTY).filter((i) => !(i.type === type && i.ref_id === ref_id)));
  const clear = () => writeLS(KEY, EMPTY);
  const total = items.reduce((s, i) => s + i.price, 0);
  return { items, add, remove, clear, total };
}
