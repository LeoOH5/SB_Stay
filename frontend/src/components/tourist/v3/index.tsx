"use client";
// v3 관광객 화면 조각 — 아래 고정 바, 두 칸 고르기, 스위치, 큰 제목, 정보 줄, 코스 점선, 날짜 상자
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Icon, cn } from "@/components/ui";
import { tr } from "@/lib/i18n";
import { koDay } from "./flow";

/** 브라우저에서 그려졌는지 (sessionStorage 값을 읽기 전 깜빡임 방지) */
const noop = () => () => {};
export const useHydrated = () => useSyncExternalStore(noop, () => true, () => false);

/** 화면 아래 고정 바 (탭바 위를 덮는다). 같은 높이의 빈 자리를 함께 그려 내용이 가려지지 않게 한다 */
export function BottomBar({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(120);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <>
      <div style={{ height: h }} aria-hidden />
      <div ref={ref} className={cn("fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[430px] border-t border-line bg-white px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-3", className)}>
        {children}
      </div>
    </>
  );
}

/** 아래 바의 "라벨 ··· 금액" 한 줄 */
export function TotalLine({ label, amount, className }: { label: ReactNode; amount: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <span className="text-[15px] text-muted">{label}</span>
      <span className="text-[20px] font-bold text-ink">{amount}</span>
    </div>
  );
}

/** 두(여러) 칸 중 하나 고르기 — 테두리 상자 안 쪽빛 채움 */
export function Segmented<T extends string>({ options, value, onChange, className }: { options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cn("grid gap-1 rounded-[14px] border border-line bg-white p-1", className)} style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }} role="radiogroup">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cn("h-10 rounded-[10px] text-[15px] font-semibold transition", value === o.value ? "bg-navy text-white" : "text-ink hover:bg-gray-bg")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 켜고 끄는 스위치 */
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={cn("relative h-8 w-[52px] shrink-0 rounded-full transition", checked ? "bg-navy" : "bg-line")}>
      <span className={cn("absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all", checked ? "left-[24px]" : "left-1")} />
    </button>
  );
}

/** 네모 체크 상자 + 글 */
export function CheckRow({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 py-1.5 text-[15px] text-ink">
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className={cn("flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] border-[1.5px]", checked ? "border-navy bg-navy text-white" : "border-[#BFC5CC] bg-white")} aria-hidden>
        {checked && <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} />}
      </span>
      <span>{children}</span>
    </label>
  );
}

/** 탭 제목 아래 큰 머리말 (26px 700) */
export function Headline({ title, sub, className }: { title: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn("px-5", className)}>
      <h1 className="whitespace-pre-line text-[26px] font-bold leading-[1.35] tracking-[-0.01em] text-ink">{title}</h1>
      {sub && <p className="mt-2 text-[15px] leading-relaxed text-muted">{sub}</p>}
    </div>
  );
}

/** 구역 제목 (18px 700) + 오른쪽 */
export function SectionHead({ title, right, className }: { title: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <h2 className="text-[18px] font-bold text-ink">{title}</h2>
      {right && <div className="shrink-0 text-[14px] text-muted">{right}</div>}
    </div>
  );
}

/** 입력 위 라벨 (14px 600) + 옅은 덧말 */
export function FieldLabel({ children, extra, className }: { children: ReactNode; extra?: ReactNode; className?: string }) {
  return <div className={cn("mb-2 text-[14px] font-semibold text-ink", className)}>{children}{extra && <span className="ml-1 font-normal text-muted">{extra}</span>}</div>;
}

/** "라벨 ··· 값" 정보 줄 (얇은 선으로 나눔) */
export function InfoRow({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 py-3.5 text-[15px]", className)}>
      <span className="shrink-0 text-muted">{label}</span>
      <span className="text-right font-semibold text-ink">{children}</span>
    </div>
  );
}

/** 이름 첫 글자 동그라미 */
export function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-full bg-navy-bg font-bold text-navy", size === "lg" ? "h-[72px] w-[72px] text-[26px]" : "h-12 w-12 text-[19px]")}>
      {name.trim().charAt(0)}
    </div>
  );
}

/** 코스 장소 수를 점선으로 이은 동그라미 */
export function CourseDots({ n }: { n: number }) {
  return (
    <div className="flex items-center gap-1.5 text-[14px] text-muted">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="w-4 border-t-[1.5px] border-dashed border-[#9AA3AE]" />}
          <span className="h-3 w-3 rounded-full border-2 border-navy bg-white" />
        </span>
      ))}
      <span className="ml-2">{tr(`${n}곳`, `${n} stop${n === 1 ? "" : "s"}`)}</span>
    </div>
  );
}

/** 위 화살표 (보내기) */
export function ArrowUp({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("h-5 w-5", className)} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" />
    </svg>
  );
}

/** 날짜 상자 — "1월 15일 금" 표시, 누르면 기본 달력 */
export function DateBox({ value, onChange, min, max, label, className }: { value: string; onChange: (v: string) => void; min?: string; max?: string; label: string; className?: string }) {
  return (
    <label className={cn("relative flex h-[52px] cursor-pointer items-center rounded-[14px] border border-line bg-white px-4 text-[16px] text-ink focus-within:border-navy", className)}>
      <span>{koDay(value)}</span>
      <input type="date" aria-label={label} value={value} min={min} max={max} onChange={(e) => e.target.value && onChange(e.target.value)}
        onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch { /* 지원 안 하면 기본 동작 */ } }}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
    </label>
  );
}

/** 테두리만 있는 큰 흰 상자 (옵션 묶음) */
export function OutlineBox({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-[18px] border border-line bg-white px-5 py-5", className)}>{children}</div>;
}
