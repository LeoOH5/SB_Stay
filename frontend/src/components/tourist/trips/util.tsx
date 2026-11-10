"use client";
// 내 여행(T16)·후기(T20)·앨범(T21)·신고(T22)·버디 바꾸기(T23) 공용 조각 — 한국어 날짜, 아바타, 타임라인 점, 사진 타일, 아래 버튼 줄
import { useEffect, useState, type ReactNode } from "react";
import { Icon, cn } from "@/components/ui";
import { biRecord, dowEn, monEn, okv, errMsg } from "@/components/tourist/format";
import { curLang, tr } from "@/lib/i18n";
import { personName } from "@/lib/i18n-data";
import { get } from "@/lib/api";
import type { Booking, BookingItem } from "@/lib/types";
import { PersonArt } from "@/components/person-art";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const parts = (s: string) => s.split("-").map(Number) as [number, number, number];

/** "2027-01-13" → "1월 13일" */
export function krDate(s?: string | null): string {
  if (!s) return "";
  const [, m, d] = parts(s);
  return curLang() === "en" ? `${monEn(m)} ${d}` : `${m}월 ${d}일`;
}
/** "2027-01-13" → "1월 13일 수" */
export function krDateDow(s: string): string {
  const [y, m, d] = parts(s);
  const w = new Date(y, m - 1, d).getDay();
  return curLang() === "en" ? `${dowEn(w)}, ${monEn(m)} ${d}` : `${m}월 ${d}일 ${DOW[w]}`;
}
/** 같은 달이면 "1월 12일 – 15일", 아니면 "1월 30일 – 2월 2일" */
export function krRange(from?: string | null, to?: string | null): string {
  if (!from) return "";
  if (!to || to === from) return krDate(from);
  const [, fm] = parts(from), [, tm, td] = parts(to);
  return fm === tm ? `${krDate(from)} – ${curLang() === "en" ? td : `${td}일`}` : `${krDate(from)} – ${krDate(to)}`;
}
export const nightsOf = (from: string, to: string) => {
  const [fy, fm, fd] = parts(from), [ty, tm, td] = parts(to);
  return Math.max(0, Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000));
};
/** "120" → "2시간", "90" → "1시간 30분" */
export function hoursLabel(min?: number | null): string {
  const m = min ?? 120;
  const h = Math.floor(m / 60), r = m % 60;
  if (curLang() === "en") return h && r ? `${h} hr ${r} min` : h ? `${h} hr` : `${r} min`;
  return h && r ? `${h}시간 ${r}분` : h ? `${h}시간` : `${r}분`;
}

/** 예약 전체 기간 (항목 날짜 중 가장 이른 날 ~ 늦은 날) */
export function bookingSpan(b: Booking): { from: string; to: string } {
  const ds = b.items.flatMap((i) => [i.date_from, i.date_to]).filter((d): d is string => !!d).sort();
  return { from: ds[0] ?? "", to: ds[ds.length - 1] ?? "" };
}

/** "지우와 동네 걷기" → "지우" (버디 이름) */
export function buddyNameOf(it: Pick<BookingItem, "title">): string {
  return personName(it.title.replace(/\s*[와과]\s*동네 걷기.*$/, "").replace(/\s*동네 걷기.*$/, "").replace(/^Walk with\s+/i, "").replace(/\s+neighborhood walk.*$/i, "").trim()) || tr("버디", "Buddy");
}
const batchim = (name: string) => { const c = name.charCodeAt(name.length - 1); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0; };
/** 받침 있으면 "과", 없으면 "와" */
export const wa = (name: string) => (batchim(name) ? "과" : "와");
/** 받침 있으면 "이", 없으면 "가" */
export const iga = (name: string) => (batchim(name) ? "이" : "가");
/** 받침(ㄹ 제외) 있으면 "으로", 없으면 "로" */
export const euro = (name: string) => { const c = name.charCodeAt(name.length - 1); return batchim(name) && (c - 0xac00) % 28 !== 8 ? "으로" : "로"; };

export const LANG_KO: Record<string, string> = biRecord<string>({ ko: "한국어", en: "영어", ja: "일본어", zh: "중국어" }, { ko: "Korean", en: "English", ja: "Japanese", zh: "Chinese" });

/** GET /bookings/{id} — 페이지 공용 */
export function useBooking(id: string | undefined) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    let alive = true;
    okv(get<Booking>(`/bookings/${id}`)).then((b) => { if (alive) setBooking(b); }).catch((e: unknown) => { if (alive) setErr(errMsg(e)); });
    return () => { alive = false; };
  }, [id]);
  return { booking, err, setBooking };
}

/** 프로필 그림 (선택하면 체크) */
export function Avatar({ name, size = "md", active, className }: { name: string; size?: "sm" | "md" | "lg"; active?: boolean; className?: string }) {
  const s = size === "lg" ? "h-16 w-16 text-[22px]" : size === "sm" ? "h-10 w-10 text-[15px]" : "h-12 w-12 text-[18px]";
  if (!active) return <PersonArt name={name} className={cn(s, className)} />;
  return <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-navy font-bold text-white transition", s, className)} aria-hidden><Icon name="check" className="h-6 w-6" strokeWidth={2.6} /></span>;
}

/** 타임라인 점: done(쪽빛 채움 + 체크) · wait(감 주황 테두리) · open(빈 원) · off(회색) */
export function Node({ kind }: { kind: "done" | "wait" | "open" | "off" }) {
  if (kind === "done") return <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-white"><Icon name="check" className="h-4 w-4" strokeWidth={2.6} /></span>;
  return <span className="flex h-6 w-6 shrink-0 items-center justify-center"><span className={cn("h-[18px] w-[18px] rounded-full border-2 bg-white", kind === "wait" ? "border-orange" : kind === "off" ? "border-line" : "border-ink")} /></span>;
}

/** 타임라인 한 칸 — 왼쪽 점 + 아래로 이어지는 점선 */
export function TimelineStep({ node, last, children }: { node: ReactNode; last?: boolean; children: ReactNode }) {
  return (
    <div className="relative flex gap-3.5">
      <div className="flex flex-col items-center">
        <div className="pt-0.5">{node}</div>
        {!last && <div className="mt-1.5 w-0 flex-1 border-l-2 border-dashed border-line" />}
      </div>
      <div className={cn("min-w-0 flex-1", !last && "pb-7")}>{children}</div>
    </div>
  );
}

/** 사진 자리 무늬 (비늘 물결) */
const SCALES = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='14' viewBox='0 0 28 14'%3E%3Cpath d='M0 14a14 14 0 0 1 28 0M-14 7a14 14 0 0 1 28 0M14 7a14 14 0 0 1 28 0' fill='none' stroke='%23ffffff' stroke-opacity='0.13' stroke-width='1.2'/%3E%3C/svg%3E\")";
export function PhotoPlaceholder({ className }: { className?: string }) {
  return <div className={cn("bg-[#3B4652]", className)} style={{ backgroundImage: SCALES }} aria-hidden />;
}
/** 사진 한 장 — URL을 못 불러오면 무늬 타일 */
export function Photo({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) return <PhotoPlaceholder className={className} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={cn("object-cover", className)} />;
}

/** 페이지 끝 버튼 줄 (관광객 레이아웃은 탭바가 있어 sticky 대신 흐름 안에 둔다) */
export function ActionBar({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="mt-8 border-t border-line px-5 pb-6 pt-4">
      {children}
      {note && <p className="mt-3 text-center text-[13px] text-muted">{note}</p>}
    </div>
  );
}

/** 별 5개 (채움/빈) — onChange 가 있으면 고르기 */
export function StarRow({ value, onChange, size = "h-5 w-5", gap = "gap-2", label }: { value: number; onChange?: (v: number) => void; size?: string; gap?: string; label?: string }) {
  return (
    <div className={cn("flex items-center", gap)} role={onChange ? "radiogroup" : undefined} aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => {
        const star = (
          <svg viewBox="0 0 24 24" className={size} aria-hidden>
            <path d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9L12 2.8Z" fill={n <= value ? "#E2722F" : "#E3E6EA"} />
          </svg>
        );
        return onChange ? (
          <button key={n} type="button" role="radio" aria-checked={n === value} aria-label={`${label ? `${label} ` : ""}${tr(`${n}점`, `${n} star${n === 1 ? "" : "s"}`)}`} onClick={() => onChange(n)} className="-m-1 p-1">{star}</button>
        ) : <span key={n}>{star}</span>;
      })}
    </div>
  );
}

export function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("h-5 w-5 shrink-0", className)} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 3.5h3.2l1.6 4.2-2.2 1.4a11 11 0 0 0 5.3 5.3l1.4-2.2 4.2 1.6V17a2.5 2.5 0 0 1-2.5 2.5A15.5 15.5 0 0 1 2.5 6 2.5 2.5 0 0 1 5 3.5Z" />
    </svg>
  );
}
export function SwapIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("h-5 w-5 shrink-0", className)} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5" />
    </svg>
  );
}
