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
        <div className="text-[14px] font-semibold text-ink break-keep">{title}</div>
        {meta && <div className="text-[12px] text-muted mt-0.5">{meta}</div>}
      </div>
      {right && <div className="shrink-0 text-right">{right}</div>}
    </div>
  );
}

export function Button({ children, variant = "primary", className, full = true, ...rest }: { children: ReactNode; variant?: "primary" | "secondary" | "ghost" | "danger"; className?: string; full?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const v = BTN_VARIANT[variant];
  return (
    <button {...rest} className={cn("h-13 min-h-[52px] rounded-xl px-5 text-[15px] font-semibold transition disabled:opacity-40", v, full && "w-full", className)}>
      {children}
    </button>
  );
}

const BTN_VARIANT = { primary: "bg-navy text-white hover:bg-navy-700", secondary: "bg-white text-green-dark border-2 border-green hover:bg-green-bg", ghost: "bg-white text-navy border border-line hover:bg-gray-bg", danger: "bg-white text-orange border border-orange hover:bg-orange-bg" } as const;

/** 버튼처럼 보이는 링크 (a 안에 button을 넣지 않기 위해) */
export function LinkButton({ href, children, variant = "primary", className, full = true }: { href: string; children: ReactNode; variant?: keyof typeof BTN_VARIANT; className?: string; full?: boolean }) {
  return (
    <Link href={href} className={cn("inline-flex min-h-[52px] items-center justify-center rounded-xl px-5 text-[15px] font-semibold transition", BTN_VARIANT[variant], full && "w-full", className)}>
      {children}
    </Link>
  );
}

/** 숙박·투어·버디 바로가기 타일 */
export function CategoryTiles() {
  const items = [
    { href: "/stay", title: "숙박", desc: "방학 중 대학 기숙사", icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 20V9l9-5 9 5v11" /><path d="M9 20v-6h6v6" /></svg>) },
    { href: "/tours", title: "역사 투어", desc: "해설사와 걷는 성북", icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" /><path d="M9 4v14M15 6v14" /></svg>) },
    { href: "/buddies", title: "대학생 버디", desc: "동네를 같이 걸어요", icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.2" /><circle cx="17" cy="9" r="2.6" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15 14.5c3.3 0 6 2.2 6 5.5" /></svg>) },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className="flex flex-col items-center gap-1.5 rounded-[14px] bg-white px-2 py-3.5 text-center ring-1 ring-line/60 shadow-[0_1px_3px_rgba(31,42,68,0.08)] active:scale-[0.98] transition">
          <span className="mb-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-navy-bg text-navy">{i.icon}</span>
          <span className="text-[14px] font-bold text-ink leading-tight">{i.title}</span>
          <span className="text-[11.5px] leading-snug text-muted">{i.desc}</span>
        </Link>
      ))}
    </div>
  );
}

export function Chip({ children, selected, onClick, className }: { children: ReactNode; selected?: boolean; onClick?: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={cn("h-9 shrink-0 whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium border transition", selected ? "bg-navy text-white border-navy" : "bg-white text-ink border-line hover:border-navy", className)}>
      {children}
    </button>
  );
}

const PILL: Record<string, string> = { approved: "bg-green-dark text-white", confirmed: "bg-green-dark text-white", requested: "bg-orange text-white", pending: "bg-orange text-white", rejected: "bg-gray-400 text-white", cancelled: "bg-gray-400 text-white", suspended: "bg-gray-400 text-white", info: "bg-navy text-white", partially_approved: "bg-orange text-white", paid: "bg-green-dark text-white" };
export const STATUS_LABEL: Record<string, string> = { requested: "신청", approved: "승인됨", rejected: "거절됨", confirmed: "확정", cancelled: "취소됨", partially_approved: "일부 승인", pending: "대기", suspended: "제재", paid: "정산 완료" };
export function StatusPill({ status, label, className }: { status: string; label?: string; className?: string }) {
  return <span className={cn("inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold", PILL[status] ?? "bg-navy text-white", className)}>{label ?? STATUS_LABEL[status] ?? status}</span>;
}

export function KpiTile({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: string; accent?: boolean }) {
  return (
    <Card className="p-4">
      <div className="text-[12px] text-muted">{label}</div>
      <div className={cn("mt-1 whitespace-nowrap text-[clamp(20px,6.5vw,26px)] font-bold leading-none", accent ? "text-navy" : "text-ink")}>{value}</div>
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
          // 가장 긴 prefix가 일치하는 탭 하나만 활성 (예: /buddy 와 /buddy/requests 중 후자)
          const best = tabs.filter((x) => path === x.href || path.startsWith(x.href + "/")).sort((a, b) => b.href.length - a.href.length)[0];
          const active = best?.href === t.href;
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

/** OpenStreetMap 임베드 (키 불필요). points의 범위를 자동으로 잡는다. */
export function MapEmbed({ points, className, h = "h-44" }: { points: { lat: number; lng: number }[]; className?: string; h?: string }) {
  if (points.length === 0) return null;
  const lats = points.map((p) => p.lat), lngs = points.map((p) => p.lng);
  const pad = 0.004;
  const bbox = [Math.min(...lngs) - pad, Math.min(...lats) - pad, Math.max(...lngs) + pad, Math.max(...lats) + pad].join(",");
  const m = points[0];
  return (
    <div className={cn("overflow-hidden rounded-[14px] ring-1 ring-line/60", h, className)}>
      <iframe title="지도" className="h-full w-full border-0" loading="lazy" src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${m.lat},${m.lng}`} />
    </div>
  );
}

/** 대학 사진 출처 (Wikimedia Commons) */
export const PHOTO_CREDITS: Record<string, string> = {
  "/dorms/korea.jpg": "안암학사 프런티어관 · Mimacds · Wikimedia Commons · CC BY-SA 3.0",
  "/dorms/kookmin.jpg": "국민대학교 정문 · hyolee2 · Wikimedia Commons · CC BY-SA 3.0",
  "/dorms/sungshin.jpg": "성신여대 수정캠퍼스 · Sungshinpr · Wikimedia Commons · CC BY-SA 4.0",
  "/dorms/hansung.jpg": "한성대 삼군부 총무당 · 오모군 · Wikimedia Commons · CC BY 4.0",
  "/dorms/seokyeong.jpg": "서경대학교 · hyolee2 · Wikimedia Commons · CC BY-SA 3.0",
  "/dorms/karts.jpg": "한국예술종합학교 석관동 캠퍼스 · Younghopark7 · Wikimedia Commons · CC BY-SA 3.0",
};

/** 대학 사진. 없으면 아이콘 타일 */
export function DormPhoto({ src, className, label, credit = false }: { src?: string; className?: string; label?: string; credit?: boolean }) {
  if (!src) return <PhotoTile className={className} label={label} />;
  return (
    <figure className={cn("relative overflow-hidden rounded-[14px] bg-gray-bg", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={label ?? ""} className="h-full w-full object-cover" loading="lazy" />
      {credit && PHOTO_CREDITS[src] && <figcaption className="absolute inset-x-0 bottom-0 bg-black/45 px-2 py-0.5 text-[10px] text-white/90">사진: {PHOTO_CREDITS[src]}</figcaption>}
    </figure>
  );
}

/** 사진이 없을 때 쓰는 타일 */
export function PhotoTile({ className, label }: { className?: string; label?: string }) {
  return (
    <div className={cn("flex items-center justify-center rounded-[14px] bg-gradient-to-br from-navy to-navy-700 text-white/80", className)}>
      <div className="flex flex-col items-center gap-1">
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M3 20V9l9-5 9 5v11" /><path d="M9 20v-6h6v6" /></svg>
        {label && <span className="text-[12px] font-semibold">{label}</span>}
      </div>
    </div>
  );
}
