"use client";
// localStorage 기반 작은 스토어 — useSyncExternalStore로 SSR/하이드레이션 안전하게 읽는다.
import { useSyncExternalStore } from "react";

const listeners = new Map<string, Set<() => void>>();
const cache = new Map<string, { raw: string | null; value: unknown }>();

function emit(key: string) { listeners.get(key)?.forEach((l) => l()); }

export function readLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  const c = cache.get(key);
  if (c && c.raw === raw) return c.value as T;
  let value: T = fallback;
  try { value = raw === null ? fallback : (JSON.parse(raw) as T); } catch { value = fallback; }
  cache.set(key, { raw, value });
  return value;
}

export function writeLS<T>(key: string, value: T | null) {
  if (value === null) window.localStorage.removeItem(key); else window.localStorage.setItem(key, JSON.stringify(value));
  emit(key);
}

export function useLS<T>(key: string, fallback: T): T {
  return useSyncExternalStore(
    (cb) => { if (!listeners.has(key)) listeners.set(key, new Set()); listeners.get(key)!.add(cb); const h = (e: StorageEvent) => { if (e.key === key) cb(); }; window.addEventListener("storage", h); return () => { listeners.get(key)!.delete(cb); window.removeEventListener("storage", h); }; },
    () => readLS(key, fallback),
    () => fallback,
  );
}
