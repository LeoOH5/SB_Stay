"use client";
// 공용 UI — 와이어프레임 v3 컴포넌트 언어(히어로·카드·칩·상태 알약·KPI·탭바·AI 블록)와 1:1
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Hero({ title, sub, right, children, className }: { title: string; sub?: string; right?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <header className={cn("bg-navy text-white px-5 pt-5 pb-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold leading-tight">{title}</h1>
          {sub && <p className="mt-1 text-[13px] text-white/75">{sub}</p>}
        </div>
        {right}
      </div>
      {children}
    </header>
  );
}

export function Card({ children, accent, tint, className, onClick }: { children: ReactNode; accent?: "navy" | "green" | "orange"; tint?: boolean; className?: string; onClick?: () => void }) {
  const bar = accent === "green" ? "border-l-green" : accent === "orange" ? "border-l-orange" : accent === "navy" ? "border-l-navy" : "";
  return (
    <div onClick={onClick} className={cn("rounded-[14px] bg-white shadow-[0_1px_3px_rgba(31,42,68,0.08)] ring-1 ring-line/60 p-4", accent && "border-l-4", bar, tint && "bg-navy-bg ring-0", onClick && "cursor-pointer active:scale-[0.99]", className)}>
      {children}
    </div>
  );
}

export function ListRow({ icon, title, meta, right, onClick, className }: { icon?: ReactNode; title: ReactNode; meta?: ReactNode; right?: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <div onClick={onClick} className={cn("flex items-center gap-3 py-3", onClick && "cursor-pointer", className)}>
      {icon && <div className="h-11 w-11 shrink-0 rounded-xl bg-navy-bg flex items-center justify-center text-navy font-semibold">{icon}</div>}
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold text-ink truncate">{title}</div>
        {meta && <div className="text-[12px] text-muted mt-0.5">{meta}</div>}
      </div>
      {right && <div className="shrink-0 text-right">{right}</div>}
    </div>
  );
}

export function Button({ children, variant = "primary", className, full = true, ...rest }: { children: ReactNode; variant?: "primary" | "secondary" | "ghost" | "danger"; className?: string; full?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const v = { primary: "bg-navy text-white hover:bg-navy-700", secondary: "bg-white text-green-dark border-2 border-green hover:bg-green-bg", ghost: "bg-white text-navy border border-line hover:bg-gray-bg", danger: "bg-white text-orange border border-orange hover:bg-orange-bg" }[variant];
  return (
    <button {...rest} className={cn("h-13 min-h-[52px] rounded-xl px-5 text-[15px] font-semibold transition disabled:opacity-40", v, full && "w-full", className)}>
      {children}
    </button>
  );
}

export function Chip({ children, selected, onClick, className }: { children: ReactNode; selected?: boolean; onClick?: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={cn("h-9 rounded-full px-3.5 text-[13px] font-medium border transition", selected ? "bg-navy text-white border-navy" : "bg-white text-ink border-line hover:border-navy", className)}>
      {children}
    </button>
  );
}

const PILL: Record<string, string> = { approved: "bg-green-dark text-white", confirmed: "bg-green-dark text-white", requested: "bg-orange text-white", pending: "bg-orange text-white", rejected: "bg-gray-400 text-white", cancelled: "bg-gray-400 text-white", suspended: "bg-gray-400 text-white", info: "bg-navy text-white", partially_approved: "bg-orange text-white", paid: "bg-green-dark text-white" };
export const STATUS_LABEL: Record<string, string> = { requested: "신청", approved: "승인됨", rejected: "거절됨", confirmed: "확정", cancelled: "취소됨", partially_approved: "일부 승인", pending: "대기", suspended: "제재", paid: "정산 완료" };
export function StatusPill({ status, label, className }: { status: string; label?: string; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-semibold", PILL[status] ?? "bg-navy text-white", className)}>{label ?? STATUS_LABEL[status] ?? status}</span>;
}

export function KpiTile({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: string; accent?: boolean }) {
  return (
    <Card className="p-4">
      <div className="text-[12px] text-muted">{label}</div>
      <div className={cn("mt-1 text-[26px] font-bold leading-none", accent ? "text-navy" : "text-ink")}>{value}</div>
      {sub && <div className="mt-1.5 text-[12px] text-muted">{sub}</div>}
    </Card>
  );
}

export function AiBlock({ title = "AI", children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[14px] bg-green-bg border-l-4 border-l-green p-4", className)}>
      <div className="flex items-center gap-2 mb-1.5"><span className="rounded-md bg-green-dark text-white text-[11px] font-bold px-1.5 py-0.5">AI</span><span className="text-[13px] font-semibold text-green-dark">{title}</span></div>
      <div className="text-[14px] text-ink leading-relaxed">{children}</div>
    </div>
  );
}

export function ImageBlock({ label, className, h = "h-40" }: { label: string; className?: string; h?: string }) {
  return <div className={cn("rounded-[14px] bg-navy-bg flex items-center justify-center text-[13px] text-navy/70 text-center px-4", h, className)}>{label}</div>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-[12px] text-muted mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-[12px] text-muted mt-1">{hint}</span>}
    </label>
  );
}
export const inputCls = "w-full h-12 rounded-xl border border-line bg-white px-4 text-[14px] text-ink placeholder:text-muted focus:outline-none focus:border-navy";

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return <div className="flex items-center justify-between mt-6 mb-2"><h2 className="text-[15px] font-bold text-ink">{children}</h2>{right}</div>;
}

export function TabBar({ tabs, hideOn = [] }: { tabs: { href: string; label: string; icon?: ReactNode }[]; hideOn?: string[] }) {
  const path = usePathname();
  if (hideOn.some((h) => path === h || path.startsWith(h + "/"))) return null;
  return (
    <nav className="sticky bottom-0 z-20 mt-auto border-t border-line bg-white/95 backdrop-blur px-3 pb-[max(env(safe-area-inset-bottom),8px)] pt-2">
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
        {tabs.map((t) => {
          const active = path === t.href || (t.href !== "/" && path.startsWith(t.href));
          return (
            <Link key={t.href} href={t.href} className={cn("h-10 rounded-full flex items-center justify-center text-[13px] font-semibold", active ? "bg-navy text-white" : "text-muted")}>{t.label}</Link>
          );
        })}
      </div>
    </nav>
  );
}

export function TopBar({ title, back, right }: { title?: string; back?: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 h-12 text-[14px]">
      {back ? <Link href={back} className="text-navy font-semibold">‹ 뒤로</Link> : <span />}
      {title && <span className="font-semibold text-ink">{title}</span>}
      {right ?? <span />}
    </div>
  );
}

export function Spinner() { return <div className="py-10 text-center text-[13px] text-muted">불러오는 중…</div>; }
export function Empty({ children }: { children: ReactNode }) { return <div className="py-10 text-center text-[13px] text-muted">{children}</div>; }
