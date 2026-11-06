"use client";
// 버디 앱 공용 조각 — 아바타, 흰 아래 버튼 줄(sticky), 사진 자리 타일, 정보 줄, 스위치, 달 고르기, 장소 이름
import { useEffect, useState, type ReactNode } from "react";
import { Icon, cn } from "@/components/ui";
import { get } from "@/lib/api";
import type { ListResponse, Place } from "@/lib/types";
import { monthLabel } from "./format";

export function Avatar({ name, large, className }: { name: string; large?: boolean; className?: string }) {
  return <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-navy-bg font-bold text-navy", large ? "h-14 w-14 text-[20px]" : "h-12 w-12 text-[18px]", className)} aria-hidden>{name.trim().charAt(0)}</span>;
}

/** 화면 아래 붙는 버튼 줄 (탭바를 숨긴 화면용) */
export function BottomBar({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 mt-auto border-t border-line bg-white px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-4">
      {children}
      {note && <p className="mt-2.5 text-center text-[13px] text-muted">{note}</p>}
    </div>
  );
}

/** 사진 자리 (비늘 물결 무늬) */
const SCALES = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='14' viewBox='0 0 28 14'%3E%3Cpath d='M0 14a14 14 0 0 1 28 0M-14 7a14 14 0 0 1 28 0M14 7a14 14 0 0 1 28 0' fill='none' stroke='%23ffffff' stroke-opacity='0.13' stroke-width='1.2'/%3E%3C/svg%3E\")";
export function PhotoPlaceholder({ className, children }: { className?: string; children?: ReactNode }) {
  return <div className={cn("relative bg-[#3B4652]", className)} style={{ backgroundImage: SCALES }}>{children}</div>;
}

/** 왼쪽 라벨 · 오른쪽 값 한 줄 (얇은 구분선은 부모 divide-y) */
export function InfoRow({ label, value, sub, className }: { label: ReactNode; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-3.5", className)}>
      <span className="text-[15px] text-muted">{label}</span>
      <span className="text-right text-[15px] font-bold text-ink">{value}{sub}</span>
    </div>
  );
}

export function Toggle({ on, onClick, disabled, label }: { on: boolean; onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} disabled={disabled}
      className={cn("relative h-8 w-[52px] shrink-0 rounded-full transition disabled:opacity-40", on ? "bg-navy" : "bg-[#C9CED3]")}>
      <span className={cn("absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-all", on ? "left-[24px]" : "left-1")} />
    </button>
  );
}

/** "2027년 1월 ⌄" 알약 모양 달 고르기 */
export function MonthSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (m: string) => void }) {
  return (
    <label className="relative inline-flex h-10 shrink-0 items-center rounded-full border border-line pl-4 pr-10 text-[15px] text-ink">
      <span>{monthLabel(value)}</span>
      <Icon name="chevron-down" className="pointer-events-none absolute right-3.5 h-5 w-5" />
      <select aria-label="달 고르기" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
        {options.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
      </select>
    </label>
  );
}

/** place_id → 이름 (GET /places 한 번) */
let placeCache: Record<number, string> | null = null;
export function usePlaceNames(): Record<number, string> {
  const [names, setNames] = useState<Record<number, string>>(placeCache ?? {});
  useEffect(() => {
    if (placeCache) return;
    let alive = true;
    get<ListResponse<Place>>("/places").then((r) => {
      placeCache = Object.fromEntries(r.items.map((p) => [p.id, p.name]));
      if (alive) setNames(placeCache);
    }).catch(() => { /* 이름 대신 번호 */ });
    return () => { alive = false; };
  }, []);
  return names;
}

export function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("h-5 w-5", className)} aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
