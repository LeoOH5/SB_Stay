"use client";
// 공용 UI — v3 화면(docs/v3/screens) 컴포넌트 언어: 흰 상단바·로고·틴트 배너·작은 태그 칩·점 상태·아이콘 탭바
// 색: 쪽빛 navy(#1E3A5F) + 감 주황 orange(#E2722F). green 토큰은 쪽빛으로 연결돼 있어 쓰지 않는다.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* ------------------------------------------------------------------ 아이콘 */
const ICON_PATHS = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h5v-6h4v6h5V9.5" /></>,
  bed: <><path d="M3 18V6" /><path d="M3 14h18v4" /><path d="M21 14v-3a3 3 0 0 0-3-3h-7v6" /><circle cx="7" cy="11" r="1.6" /></>,
  route: <><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h7.5a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7H16" /></>,
  suitcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M3 13h18" /></>,
  inbox: <><path d="M3 13h5l1.5 3h5L16 13h5" /><path d="M5.5 5h13L21 13v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6Z" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></>,
  users: <><circle cx="9" cy="8" r="3.2" /><circle cx="17" cy="9" r="2.6" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15 14.5c3.3 0 6 2.2 6 5.5" /></>,
  "chevron-left": <path d="m15 5-7 7 7 7" />,
  "chevron-right": <path d="m9 5 7 7-7 7" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  warn: <><path d="M12 3.5 2.5 20h19L12 3.5Z" /><path d="M12 10v4.5M12 17.5v.01" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.5v.01" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" /></>,
  bag: <><path d="M5 8h14l-1.2 11.1a1 1 0 0 1-1 .9H7.2a1 1 0 0 1-1-.9L5 8Z" /><path d="M9 10V7a3 3 0 0 1 6 0v3" /></>,
  bell: <><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>,
  camera: <><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13.5" r="3.5" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.8" /><path d="m21 16-5-5-9 9" /></>,
  fork: <><path d="M7 3v8a2 2 0 0 0 2 2v8M11 3v8a2 2 0 0 1-2 2M7 3v5M9 3v5M11 3v5" /><path d="M17 21V3c-2 1.5-3 4-3 7v4h3" /></>,
  receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  flag: <><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></>,
  shield: <><path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3Z" /></>,
  grid: <><rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" /><rect x="4" y="13" width="7" height="7" rx="1" /><rect x="13" y="13" width="7" height="7" rx="1" /></>,
  building: <><path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" /><path d="M14 9h5a1 1 0 0 1 1 1v11M3 21h18M8 8h2M8 12h2M8 16h2" /></>,
  list: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" /></>,
  wallet: <><path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1V7Z" /><path d="M4 7l11-3v3M16 13.5h.01" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  pin: <><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  chat: <path d="M4 5h16v11H9l-5 4V5Z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  sparkle: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />,
  star: <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z" />,
} as const;
export type IconName = keyof typeof ICON_PATHS;

export function Icon({ name, className, strokeWidth = 1.8, title }: { name: IconName; className?: string; strokeWidth?: number; title?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("h-5 w-5 shrink-0", className)} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      {ICON_PATHS[name]}
    </svg>
  );
}
const renderIcon = (icon: IconName | ReactNode, className?: string) => (typeof icon === "string" && icon in ICON_PATHS ? <Icon name={icon as IconName} className={className} /> : icon);

/* ------------------------------------------------------------------ 로고 · 브랜드 */
/** 앱 아이콘 (public/brand/logo_mark.svg 와 같은 그림) — 한 지붕 아래 둘 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 96" className={cn("h-7 w-7 shrink-0", className)} role="img" aria-label="성북스테이 로고">
      <rect width="96" height="96" rx="24" fill="#1E3A5F" />
      <path d="M8 36 Q48.0 53 88 36 Q72.8 34 63.2 20 H32.8 Q23.2 34 8 36 Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="36" cy="58" r="7.5" fill="#FFFFFF" />
      <path d="M22 83 a14 14 0 0 1 28 0 Z" fill="#FFFFFF" />
      <circle cx="60" cy="58" r="7.5" fill="#F08A3C" />
      <path d="M46 83 a14 14 0 0 1 28 0 Z" fill="#F08A3C" />
    </svg>
  );
}

/** 로고 + "성북스테이" (쪽빛 700). badge="버디" | "관리" 면 감 주황 작은 알약 */
export function Brand({ badge, href, className, size = "md" }: { badge?: string; href?: string; className?: string; size?: "sm" | "md" }) {
  const inner = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={size === "sm" ? "h-6 w-6" : "h-7 w-7"} />
      <span className={cn("font-bold tracking-[-0.01em] text-navy", size === "sm" ? "text-[17px]" : "text-[20px]")}>성북스테이</span>
      {badge && <span className="rounded-md bg-orange px-1.5 py-0.5 text-[11.5px] font-bold leading-none text-white">{badge}</span>}
    </span>
  );
  return href ? <Link href={href} aria-label="성북스테이 홈">{inner}</Link> : inner;
}

/* ------------------------------------------------------------------ 상단 */
function BackLink({ href, onBack, label }: { href?: string; onBack?: () => void; label?: string }) {
  const cls = "-ml-2 inline-flex h-11 items-center gap-1 rounded-full pl-1.5 pr-2 text-ink hover:bg-gray-bg";
  const body = <><Icon name="chevron-left" className="h-6 w-6" strokeWidth={2.2} />{label && <span className="text-[17px] font-bold">{label}</span>}</>;
  if (onBack) return <button type="button" onClick={onBack} aria-label={label ?? "뒤로"} className={cls}>{body}</button>;
  return <Link href={href ?? "/"} aria-label={label ?? "뒤로"} className={cls}>{body}</Link>;
}

/**
 * 페이지 머리 — 흰 배경. back 이 있으면 위에 ‹ 줄(+ right), 아래 큰 제목(26px).
 * back 이 없으면 탭 화면 제목(22px)과 right 가 한 줄.
 */
export function Hero({ title, sub, right, children, className, back, backLabel }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; children?: ReactNode; className?: string; back?: string; backLabel?: string }) {
  return (
    <header className={cn("bg-white px-5 pb-4", back ? "pt-2" : "pt-5", className)}>
      {back && (
        <div className="flex h-12 items-center justify-between gap-3">
          <BackLink href={back} label={backLabel} />
          {right}
        </div>
      )}
      <div className={cn("flex items-start justify-between gap-3", back && "mt-2")}>
        <div className="min-w-0">
          <h1 className={cn("font-bold leading-[1.3] tracking-[-0.01em] text-ink", back ? "text-[26px]" : "text-[22px]")}>{title}</h1>
          {sub && <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{sub}</p>}
        </div>
        {!back && right}
      </div>
      {children}
    </header>
  );
}

/** 얇은 상단바 — ‹ + 굵은 제목 + 오른쪽 자리 */
export function TopBar({ title, back, onBack, right, className }: { title?: ReactNode; back?: string; onBack?: () => void; right?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex h-14 items-center justify-between gap-3 bg-white px-5", className)}>
      <div className="flex min-w-0 items-center gap-1">
        {(back || onBack) && <BackLink href={back} onBack={onBack} />}
        {title && <span className="truncate text-[17px] font-bold text-ink">{title}</span>}
      </div>
      {right && <div className="shrink-0 text-[14px]">{right}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ 블록 */
export function Card({ children, accent, tint, className, onClick }: { children: ReactNode; accent?: "navy" | "green" | "orange"; tint?: boolean; className?: string; onClick?: () => void }) {
  const bar = accent === "orange" ? "border-l-orange" : accent ? "border-l-navy" : "";
  return (
    <div onClick={onClick} className={cn("rounded-[16px] border border-line bg-white p-4", accent && "border-l-4", bar, tint && "border-transparent bg-navy-bg", onClick && "cursor-pointer transition active:scale-[0.99]", className)}>
      {children}
    </div>
  );
}

/** 틴트 안내 띠 — info: 쪽빛, warn: 감 주황(진한 글자), soft: 회색 */
const BANNER = { info: "bg-navy-bg text-navy", warn: "bg-orange-bg text-orange-ink", soft: "bg-gray-bg text-ink" } as const;
export function Banner({ variant = "info", icon, children, className }: { variant?: keyof typeof BANNER; icon?: IconName | ReactNode | false; children: ReactNode; className?: string }) {
  const ic = icon === undefined ? (variant === "warn" ? "warn" : null) : icon;
  return (
    <div className={cn("flex items-start gap-2.5 rounded-[14px] px-4 py-3 text-[14px] font-semibold leading-relaxed", BANNER[variant], className)}>
      {ic && <span className="mt-[2px] flex shrink-0">{renderIcon(ic, "h-[18px] w-[18px]")}</span>}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function ListRow({ icon, title, meta, right, onClick, href, chevron, className }: { icon?: IconName | ReactNode; title: ReactNode; meta?: ReactNode; right?: ReactNode; onClick?: () => void; href?: string; chevron?: boolean; className?: string }) {
  const body = (
    <>
      {icon && <div className="flex h-10 w-10 shrink-0 items-center justify-center text-navy">{renderIcon(icon, "h-6 w-6")}</div>}
      <div className="min-w-0 flex-1">
        <div className="break-keep text-[16px] font-semibold text-ink">{title}</div>
        {meta && <div className="mt-0.5 text-[14px] text-muted">{meta}</div>}
      </div>
      {right && <div className="shrink-0 text-right">{right}</div>}
      {(chevron ?? !!href) && <Icon name="chevron-right" className="h-5 w-5 text-ink" />}
    </>
  );
  const cls = cn("flex items-center gap-3 py-4", (onClick || href) && "cursor-pointer", className);
  if (href) return <Link href={href} className={cls}>{body}</Link>;
  return <div onClick={onClick} className={cls}>{body}</div>;
}

export function Divider({ className }: { className?: string }) { return <hr className={cn("border-0 border-t border-line", className)} />; }

/* ------------------------------------------------------------------ 버튼 */
const BTN_VARIANT = {
  primary: "bg-navy text-white hover:bg-navy-700 disabled:bg-[#BFC5CC] disabled:text-white",
  secondary: "bg-white text-navy border-[1.5px] border-navy hover:bg-navy-bg disabled:opacity-40",
  ghost: "bg-white text-ink border border-line hover:bg-gray-bg disabled:opacity-40",
  danger: "bg-red text-white hover:brightness-95 disabled:opacity-40",
  "danger-outline": "bg-white text-red border-[1.5px] border-red/60 hover:bg-red-bg disabled:opacity-40",
} as const;
export type ButtonVariant = keyof typeof BTN_VARIANT;

export function Button({ children, variant = "primary", className, full = true, ...rest }: { children: ReactNode; variant?: ButtonVariant; className?: string; full?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={cn("inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] px-5 text-[16px] font-semibold transition", BTN_VARIANT[variant], full && "w-full", className)}>
      {children}
    </button>
  );
}

/** 버튼처럼 보이는 링크 (a 안에 button을 넣지 않기 위해) */
export function LinkButton({ href, children, variant = "primary", className, full = true }: { href: string; children: ReactNode; variant?: ButtonVariant; className?: string; full?: boolean }) {
  return (
    <Link href={href} className={cn("inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] px-5 text-[16px] font-semibold transition", BTN_VARIANT[variant], full && "w-full", className)}>
      {children}
    </Link>
  );
}

/** 홈 "따로 고르기" — 숙박 · 대학생 버디 · AI 산책 코스 */
export function CategoryTiles({ className }: { className?: string }) {
  const items: { href: string; title: string; desc: string; icon: IconName }[] = [
    { href: "/stay", title: "숙박", desc: "버디 1명과 함께 신청해요", icon: "bed" },
    { href: "/buddies", title: "대학생 버디", desc: "숙박 없이 동네 걷기만 해도 돼요", icon: "users" },
    { href: "/tours", title: "AI 산책 코스", desc: "무료 · 장소마다 AI 이야기", icon: "route" },
  ];
  return (
    <div className={cn("divide-y divide-line", className)}>
      {items.map((i) => <ListRow key={i.href} href={i.href} icon={i.icon} title={i.title} meta={i.desc} />)}
    </div>
  );
}

/* ------------------------------------------------------------------ 칩 · 상태 */
/** 고르는 칩 (선택 = 쪽빛 채움) */
export function Chip({ children, selected, onClick, className, disabled }: { children: ReactNode; selected?: boolean; onClick?: () => void; className?: string; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={selected} className={cn("h-10 shrink-0 whitespace-nowrap rounded-full border px-4 text-[14px] transition disabled:opacity-40", selected ? "border-navy bg-navy font-semibold text-white" : "border-line bg-white text-ink hover:border-navy/50", className)}>
      {children}
    </button>
  );
}

/** 작은 표시용 태그 (28px, 모서리 8) — plain 회색 · navy 쪽빛 틴트 · orange 감 틴트 · outline 흰 바탕 테두리 */
const TAG = { plain: "bg-gray-bg text-ink", navy: "bg-navy-bg text-navy", orange: "bg-orange-bg text-orange-ink", outline: "bg-white text-ink border border-line" } as const;
export function TagChip({ children, variant = "plain", className }: { children: ReactNode; variant?: keyof typeof TAG; className?: string }) {
  return <span className={cn("inline-flex h-7 shrink-0 items-center whitespace-nowrap rounded-lg px-2.5 text-[13px] font-semibold", TAG[variant], className)}>{children}</span>;
}

const PILL_TONE: Record<string, "navy" | "orange" | "gray" | "red"> = {
  approved: "navy", confirmed: "navy", paid: "navy", info: "navy", resolved: "navy", settled: "navy",
  requested: "orange", pending: "orange", partially_approved: "orange", open: "orange", meal_pending: "orange", over_limit: "orange",
  rejected: "gray", cancelled: "gray", dismissed: "gray", none: "gray",
  suspended: "red",
};
const TONE_CLS = { navy: "text-navy", orange: "text-orange", gray: "text-muted", red: "text-red" } as const;
export const STATUS_LABEL: Record<string, string> = {
  requested: "신청", approved: "승인됨", rejected: "거절됨", confirmed: "확정", cancelled: "취소됨", partially_approved: "일부 승인",
  pending: "대기", suspended: "정지", paid: "정산 완료", open: "처리 전", resolved: "처리 완료", dismissed: "기각", meal_pending: "식비 확인 중", settled: "지급 완료",
};
/** 점 + 글자 상태 표시. confirmed/approved 쪽빛 · requested/pending 감 주황 · rejected/cancelled 회색 · suspended 빨강 */
export function StatusPill({ status, label, tone, className }: { status: string; label?: string; tone?: "navy" | "orange" | "gray" | "red"; className?: string }) {
  const t = tone ?? PILL_TONE[status] ?? "navy";
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold", TONE_CLS[t], className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {label ?? STATUS_LABEL[status] ?? status}
    </span>
  );
}

/** 후기 세부 점수 한 줄 — 라벨 · 감 주황 막대 · 값 */
export function ScoreBar({ label, value, max = 5, className }: { label: string; value: number; max?: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={cn("flex items-center gap-3 text-[14px]", className)}>
      <span className="w-[68px] shrink-0 text-ink">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-bg"><span className="block h-full rounded-full bg-orange" style={{ width: `${pct}%` }} /></span>
      <span className="w-8 shrink-0 text-right font-bold text-ink">{value.toFixed(1)}</span>
    </div>
  );
}

/** v3.2 버디 등급 배지 — 성장·우수만 보인다 (기본은 표시 없음). 우수는 감 주황, 성장은 쪽빛 */
export function GradeBadge({ grade, className, suffix = "버디", en = false }: { grade?: string | null; className?: string; suffix?: string; en?: boolean }) {
  if (grade !== "growth" && grade !== "top") return null;
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 text-[12px] font-semibold",
      grade === "top" ? "bg-orange-bg text-orange-ink" : "bg-navy-bg text-navy", className)}>
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden><path d="M12 3.5 14.4 9l5.9.5-4.5 3.9 1.4 5.8L12 16.1l-5.2 3.1 1.4-5.8L3.7 9.5 9.6 9 12 3.5Z" fill="currentColor" /></svg>
      {en ? (grade === "top" ? "Top buddy" : "Rising buddy") : <>{grade === "top" ? "우수" : "성장"}{suffix ? ` ${suffix}` : ""}</>}
    </span>
  );
}

/** 목표 대비 진행 한 줄 — 라벨 · 쪽빛 막대 · '지금 / 목표' (다 채우면 막대가 꽉 참) */
export function GoalBar({ label, value, goal, format = (v) => String(v), className }: { label: string; value: number; goal: number; format?: (v: number) => string; className?: string }) {
  const pct = goal > 0 ? Math.max(0, Math.min(100, (value / goal) * 100)) : 100;
  return (
    <div className={cn("flex items-center gap-3 text-[14px]", className)}>
      <span className="w-[44px] shrink-0 text-muted">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-bg"><span className={cn("block h-full rounded-full", pct >= 100 ? "bg-navy" : "bg-orange")} style={{ width: `${pct}%` }} /></span>
      <span className="w-[76px] shrink-0 text-right text-ink"><b className="font-bold">{format(value)}</b><span className="text-muted"> / {format(goal)}</span></span>
    </div>
  );
}

/** − n + 숫자 고르기 */
export function Stepper({ value, onChange, min = 0, max = 99, label, className }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label?: string; className?: string }) {
  const btn = "flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink transition hover:border-navy disabled:opacity-30";
  return (
    <div className={cn("inline-flex items-center gap-3", className)} role="group" aria-label={label}>
      <button type="button" className={btn} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="줄이기"><Icon name="minus" className="h-4 w-4" strokeWidth={2.2} /></button>
      <span className="min-w-6 text-center text-[17px] font-bold text-ink" aria-live="polite">{value}</span>
      <button type="button" className={btn} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="늘리기"><Icon name="plus" className="h-4 w-4" strokeWidth={2.2} /></button>
    </div>
  );
}

/** 단계 진행 막대 (기본 5칸). step 은 1부터 */
export function StepDots({ step, total = 5, className }: { step: number; total?: number; className?: string }) {
  return (
    <div className={cn("flex gap-1.5", className)} role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step}>
      {Array.from({ length: total }, (_, i) => <span key={i} className={cn("h-1 flex-1 rounded-full", i < step ? "bg-navy" : "bg-line")} />)}
    </div>
  );
}

export function KpiTile({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: string; accent?: boolean }) {
  return (
    <Card className="p-4">
      <div className="text-[13px] text-muted">{label}</div>
      <div className={cn("mt-1 whitespace-nowrap text-[clamp(18px,5.5vw,22px)] font-bold leading-tight", accent ? "text-navy" : "text-ink")}>{value}</div>
      {sub && <div className="mt-1 text-[12px] text-muted">{sub}</div>}
    </Card>
  );
}

/** AI 설명 블록 — 쪽빛 틴트 + 왼쪽 쪽빛 선 */
export function AiBlock({ title = "AI", children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-r-[12px] border-l-[3px] border-l-navy bg-navy-bg px-4 py-3", className)}>
      <div className="mb-1 text-[13px] font-bold text-navy">{title}</div>
      <div className="text-[15px] leading-relaxed text-ink">{children}</div>
    </div>
  );
}

/** 사진 자리 — 어두운 물결 무늬 + 왼쪽 아래 설명 */
const WAVES = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='24' viewBox='0 0 48 24'%3E%3Cpath d='M0 18c8 0 8-10 16-10s8 10 16 10 8-10 16-10' fill='none' stroke='%23ffffff' stroke-opacity='0.09' stroke-width='1.5'/%3E%3C/svg%3E\")";
/** 사진 자리. src 가 있으면 사진을 깔고(아래쪽 그림자 위에 label), 없으면 물결 무늬 자리 표시 */
export function ImageBlock({ label, className, h = "h-40", src, credit }: { label: string; className?: string; h?: string; src?: string; credit?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-[16px] bg-[#3B4652]", h, className)} style={src ? undefined : { backgroundImage: WAVES }}>
      {src && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/55 to-transparent" />
        </>
      )}
      <span className="absolute bottom-3 left-4 right-4 truncate text-[12px] text-white/90">{label}</span>
      {credit && <span className="absolute right-3 top-2.5 rounded-full bg-black/35 px-2 py-0.5 text-[10px] text-white/85">{credit}</span>}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[14px] font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-muted">{hint}</span>}
    </label>
  );
}
export const inputCls = "w-full h-12 rounded-[12px] border border-line bg-white px-4 text-[15px] text-ink placeholder:text-muted focus:outline-none focus:border-navy";

export function SectionTitle({ children, right, className }: { children: ReactNode; right?: ReactNode; className?: string }) {
  return <div className={cn("mb-2 mt-8 flex items-center justify-between gap-3", className)}><h2 className="text-[18px] font-bold text-ink">{children}</h2>{right && <div className="text-[14px] font-semibold text-navy">{right}</div>}</div>;
}

/* ------------------------------------------------------------------ 탭바 */
/** hideOn: "/cart" 는 그 경로와 하위 경로, "^/stay/\\d+$" 처럼 ^로 시작하면 정규식. tab.also: 이 탭을 켜는 다른 경로(예: /me → 내 여행) */
export function TabBar({ tabs, hideOn = [] }: { tabs: { href: string; label: string; icon?: IconName | ReactNode; also?: string[]; exact?: boolean }[]; hideOn?: string[] }) {
  const path = usePathname();
  const hit = (h: string) => (h.startsWith("^") ? new RegExp(h).test(path) : path === h || path.startsWith(h + "/"));
  if (hideOn.some(hit)) return null;
  // 가장 긴 prefix가 일치하는 탭 하나만 활성 (예: /buddy 와 /buddy/requests 중 후자). also 경로도 같은 규칙. exact 탭은 자기 주소에서만
  const best = tabs.flatMap((x) => [x.href, ...(x.also ?? [])].filter((h) => path === h || (!(x.exact && h === x.href) && path.startsWith(h + "/"))).map((h) => ({ tab: x, len: h.length })))
    .sort((a, b) => b.len - a.len)[0]?.tab;
  return (
    <nav className="sticky bottom-0 z-20 mt-auto bg-white shadow-[0_-4px_16px_rgba(19,40,64,0.10)] px-2 pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5">
      <div className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
        {tabs.map((t) => {
          const active = best?.href === t.href;
          return (
            <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={cn("flex h-12 flex-col items-center justify-center gap-0.5 text-[12px]", active ? "font-bold text-navy" : "text-muted")}>
              {t.icon && renderIcon(t.icon, "h-[22px] w-[22px]")}
              <span>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function Spinner() { return <div className="py-10 text-center text-[13px] text-muted">불러오는 중…</div>; }
export function Empty({ children }: { children: ReactNode }) { return <div className="py-10 text-center text-[14px] text-muted">{children}</div>; }

/** OpenStreetMap 임베드 (키 불필요). points의 범위를 자동으로 잡는다. */
export function MapEmbed({ points, className, h = "h-44" }: { points: { lat: number; lng: number }[]; className?: string; h?: string }) {
  if (points.length === 0) return null;
  const lats = points.map((p) => p.lat), lngs = points.map((p) => p.lng);
  const pad = 0.004;
  const bbox = [Math.min(...lngs) - pad, Math.min(...lats) - pad, Math.max(...lngs) + pad, Math.max(...lats) + pad].join(",");
  const m = points[0];
  return (
    <div className={cn("overflow-hidden rounded-[16px] border border-line", h, className)}>
      <iframe title="지도" className="h-full w-full border-0" src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${m.lat},${m.lng}`} />
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
  "/dorms/korea-campus.jpg": "고려대 안암캠퍼스 본관 · Mannaa mohamed · Wikimedia Commons · CC BY-SA 4.0",
  "/dorms/sungshin-campus.jpg": "성신여대 캠퍼스 · Sungshin · Wikimedia Commons · CC BY-SA 3.0",
  "/dorms/official/korea-cj.jpg": "CJ인터내셔널하우스 · © 고려대학교 안암학사",
  "/dorms/official/korea-aih.jpg": "안암인터내셔널하우스 · © 고려대학교 안암학사",
  "/dorms/official/kookmin-jeongneung.jpg": "정릉생활관 · © 국민대학교 생활관",
  "/dorms/official/sungshin-seongmigwan.jpg": "성미관 · © 성신여자대학교 기숙사",
  "/dorms/official/sungshin-seongmiryo.jpg": "성미료 · © 성신여자대학교 기숙사",
  "/dorms/official/hansung-sangsang.jpg": "상상빌리지 조감도 · © 한성대학교 생활관",
  "/dorms/official/dongduk-campus.jpg": "동덕여대 본관 · © 동덕여자대학교",
  "/dorms/official/dongduk-2.jpg": "제2생활관 · © 동덕여대학보",
  "/dorms/official/kookmin-gireum.jpg": "길음생활관 · © 국민대학교",
  "/dorms/official/seokyeong-dorm.jpg": "생활관 3동 · © 서경대학교",
  "/dorms/official/karts-dorm.jpg": "천장관 · 네이버 블로그 baba101203",
  "/dorms/official/dongduk-1.jpg": "제1생활관(목화관) · © 동덕여자대학교 생활관",
  "/dorms/karts.jpg": "한국예술종합학교 석관동 캠퍼스 · Younghopark7 · Wikimedia Commons · CC BY-SA 3.0",
};

/** 숙박 첫 화면에 쓰는 학교(캠퍼스) 사진. university_id 기준 */
export const UNIV_PHOTOS: Record<number, string> = {
  1: "/dorms/korea-campus.jpg",
  2: "/dorms/kookmin.jpg",
  3: "/dorms/sungshin.jpg",
  4: "/dorms/hansung.jpg",
  5: "/dorms/seokyeong.jpg",
  6: "/dorms/official/dongduk-campus.jpg",
  7: "/dorms/karts.jpg",
};

/** 대학 사진. 없거나 못 불러오면 사진 자리 타일 */
export function DormPhoto({ src, className, label, credit = false }: { src?: string; className?: string; label?: string; credit?: boolean }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) return <PhotoTile className={className} label={label} />;
  return (
    <figure className={cn("relative overflow-hidden rounded-[16px] bg-gray-bg", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={label ?? ""} className="h-full w-full object-cover" loading="lazy" onError={() => setFailed(src)} />
      {credit && PHOTO_CREDITS[src] && <figcaption className="absolute inset-x-0 bottom-0 truncate bg-black/45 px-2 py-0.5 text-[10px] text-white/90">사진: {PHOTO_CREDITS[src]}</figcaption>}
    </figure>
  );
}

/** 사진이 없을 때 쓰는 타일 (어두운 물결 무늬) */
export function PhotoTile({ className, label }: { className?: string; label?: string }) {
  return (
    <div className={cn("relative flex items-center justify-center overflow-hidden rounded-[16px] bg-[#3B4652] text-white/80", className)} style={{ backgroundImage: WAVES }}>
      <div className="flex flex-col items-center gap-1">
        <Icon name="building" className="h-7 w-7" strokeWidth={1.6} />
        {label && <span className="text-[12px] font-semibold">{label}</span>}
      </div>
    </div>
  );
}
