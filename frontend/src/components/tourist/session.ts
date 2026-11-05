"use client";
// sessionStorage 기반 작은 스토어 (AI 일정·여행자 정보). src/lib/store.ts 와 같은 방식으로 하이드레이션 안전.
import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: unknown }>();

export function readSS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = window.sessionStorage.getItem(key);
  const c = cache.get(key);
  if (c && c.raw === raw) return c.value as T;
  let value: T = fallback;
  try { value = raw === null ? fallback : (JSON.parse(raw) as T); } catch { value = fallback; }
  cache.set(key, { raw, value });
  return value;
}

export function writeSS<T>(key: string, value: T | null) {
  if (value === null) window.sessionStorage.removeItem(key); else window.sessionStorage.setItem(key, JSON.stringify(value));
  listeners.forEach((l) => l());
}

export function useSS<T>(key: string, fallback: T): T {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => readSS(key, fallback),
    () => fallback,
  );
}
