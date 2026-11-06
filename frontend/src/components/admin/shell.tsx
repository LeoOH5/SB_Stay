"use client";
// 어드민 공통 셸 (v3 화면 A01–A08) — 큰 제목 + 회색 부제, 얇은 구분선 KPI 줄, 선만 있는 표, 오른쪽 상세 패널
import { useSyncExternalStore, type ReactNode } from "react";
import { useUser } from "@/lib/auth";
import type { Role } from "@/lib/types";
import { Icon, LinkButton, cn } from "@/components/ui";

export const ROLE_LABEL: Record<Role, string> = { tourist: "관광객", buddy: "버디", univ_admin: "대학 담당자", operator: "운영자" };

/* ------------------------------------------------------------------ 머리 */
/** 페이지 제목(30px 700) + 회색 부제. right 에 기간 select·버튼 등을 둔다. */
export function AdminHeader({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-7 flex items-start justify-between gap-6">
      <div className="min-w-0">
        <h1 className="text-[30px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">{title}</h1>
        {sub && <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{sub}</p>}
      </div>
      {right && <div className="mt-5 flex shrink-0 items-center gap-3">{right}</div>}
    </div>
  );
}

const useHydrated = () => useSyncExternalStore(() => () => {}, () => true, () => false);

/** 가운데 정렬 안내 (로그인·권한) */
function GateMessage({ icon, title, children, action }: { icon: "shield" | "user"; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-[400px] text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-navy-bg text-navy"><Icon name={icon} className="h-6 w-6" /></span>
        <h1 className="mt-4 text-[20px] font-bold text-ink">{title}</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">{children}</p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}

/** 로그인 안 됐으면 안내. 하이드레이션 전에는 아무것도 그리지 않는다(localStorage 스냅샷 대기). */
export function AdminGate({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const hydrated = useHydrated();
  if (!hydrated) return null;
  if (!user || (user.role !== "operator" && user.role !== "univ_admin")) {
    return (
      <GateMessage icon="user" title="관리자 계정으로 로그인하세요" action={<LinkButton href="/login" full={false} className="h-[42px] min-h-0! rounded-[12px] px-5 text-[15px]">로그인</LinkButton>}>
        관리 화면은 대학 담당자와 운영팀 계정만 쓸 수 있어요.
      </GateMessage>
    );
  }
  return <>{children}</>;
}

/** 받침 있으면 "은", 없으면 "는" */
const topic = (w: string) => { const c = w.charCodeAt(w.length - 1) - 0xac00; return c >= 0 && c < 11172 && c % 28 !== 0 ? "은" : "는"; };

/** 운영팀(operator)만 보는 화면 — 대학 담당자에게는 친절한 안내 */
export function OperatorOnly({ title, children }: { title: string; children: ReactNode }) {
  const { user } = useUser();
  return (
    <AdminGate>
      {user?.role === "operator" ? children : (
        <GateMessage icon="shield" title={`${title}${topic(title)} 운영팀이 맡아요`}>
          식비 청구·신고·정산은 성북스테이 운영팀 계정에서만 볼 수 있어요. 확인이 필요하면 운영팀에 알려 주세요.
        </GateMessage>
      )}
    </AdminGate>
  );
}

/* ------------------------------------------------------------------ KPI 줄 */
/** 회색 카드 대신 위아래 선 + 칸 사이 얇은 세로선 */
export function KpiStrip({ items }: { items: { label: string; value: ReactNode; sub?: ReactNode }[] }) {
  return (
    <div className="mb-10 grid border-y border-line" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((k, i) => (
        <div key={k.label} className={cn("py-6", i > 0 && "border-l border-line pl-6", i < items.length - 1 && "pr-6")}>
          <div className="text-[14px] text-muted">{k.label}</div>
          <div className="mt-2 whitespace-nowrap text-[22px] font-bold leading-tight tracking-[-0.01em] text-ink">{k.value}</div>
          <div className="mt-2.5 min-h-[18px] text-[13px] text-muted">{k.sub}</div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ 표 */
/** 선만 있는 표 — 12px 회색 머리, 얇은 행 구분선, 첫·끝 칸은 바깥 여백 없음 */
export function Table({ cols, children, className, dense }: { cols: { label: ReactNode; className?: string }[]; children: ReactNode; className?: string; dense?: boolean }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className={cn("w-full text-[14px] text-ink", dense && "[&_td]:px-2 [&_th]:px-2")}>
        <thead>
          <tr className="border-b border-[#CDD3DA]">
            {cols.map((c, i) => <th key={i} className={cn("h-10 whitespace-nowrap px-3 text-left align-middle text-[12px] font-semibold text-muted first:pl-0 last:pr-0", c.className)}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export function Tr({ children, className, dim, selected, onClick }: { children: ReactNode; className?: string; dim?: boolean; selected?: boolean; onClick?: () => void }) {
  return (
    <tr onClick={onClick} aria-selected={selected} className={cn("h-[53px] border-b border-line", dim && "opacity-50", selected && "bg-[#F3F4F6]", onClick && "cursor-pointer hover:bg-[#F7F8FA]", className)}>
      {children}
    </tr>
  );
}
export function Td({ children, className, colSpan, title }: { children?: ReactNode; className?: string; colSpan?: number; title?: string }) {
  return <td colSpan={colSpan} title={title} className={cn("whitespace-nowrap px-3 py-2 align-middle first:pl-0 last:pr-0", className)}>{children}</td>;
}
export function EmptyRow({ cols, children }: { cols: number; children: ReactNode }) {
  return <tr className="border-b border-line"><td colSpan={cols} className="h-20 text-center text-[14px] text-muted">{children}</td></tr>;
}

/* ------------------------------------------------------------------ 조각 */
export function SectionLabel({ children, right, className }: { children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-2 flex items-end justify-between gap-3", className)}>
      <h2 className="text-[17px] font-bold text-ink">{children}</h2>
      {right && <div className="text-right text-[13px] text-muted">{right}</div>}
    </div>
  );
}

/** 오른쪽 패널의 이름 – 값 줄 (얇은 선으로 구분) */
export function KeyValues({ rows, className }: { rows: { label: string; value: ReactNode; tone?: "red" | "orange" | "navy" }[]; className?: string }) {
  const tone = { red: "text-red", orange: "text-orange", navy: "text-navy" } as const;
  return (
    <dl className={cn("divide-y divide-line", className)}>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4 py-3">
          <dt className="shrink-0 text-[14px] text-muted">{r.label}</dt>
          <dd className={cn("text-right text-[14px] font-semibold text-ink", r.tone && tone[r.tone])}>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** 오른쪽 상세 패널이 붙는 2단 배치 (A01·A07·A08: 오른쪽 352px) */
export function SplitLayout({ children, aside, asideWidth = 352 }: { children: ReactNode; aside: ReactNode; asideWidth?: number }) {
  return (
    <div className="grid items-start gap-10" style={{ gridTemplateColumns: `minmax(0,1fr) ${asideWidth}px` }}>
      <div className="min-w-0">{children}</div>
      <aside className="min-w-0">{aside}</aside>
    </div>
  );
}

/** 네이티브 select + 아래 화살표 (42px) */
export function Select({ value, onChange, options, label, className }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; label: string; className?: string }) {
  return (
    <span className={cn("relative inline-flex", className)}>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="h-[42px] w-full min-w-[128px] cursor-pointer appearance-none rounded-[10px] border border-[#CDD3DA] bg-white pl-3.5 pr-10 text-[14px] text-ink focus:border-navy focus:outline-none">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <Icon name="chevron-down" className="pointer-events-none absolute right-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink" strokeWidth={2} />
    </span>
  );
}

/** 돋보기 + 입력 (42px) */
export function SearchInput({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  return (
    <label className={cn("relative inline-flex", className)}>
      <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="h-[42px] w-full rounded-[10px] border border-[#CDD3DA] bg-white pl-11 pr-4 text-[14px] text-ink placeholder:text-muted focus:border-navy focus:outline-none" />
    </label>
  );
}

/** 작은 표시용 칸 (테두리 사각 태그, 예: 숙박 · 버디) */
export function BoxTag({ children }: { children: ReactNode }) {
  return <span className="inline-flex h-6 items-center rounded-[6px] border border-[#CDD3DA] px-2 text-[12px] font-semibold text-ink">{children}</span>;
}

/** 켜고 끄기 (판매 중 등) */
export function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)} className={cn("relative h-7 w-[46px] shrink-0 rounded-full transition disabled:opacity-50", on ? "bg-navy" : "bg-[#CDD3DA]")}>
      <span className={cn("absolute top-1 h-5 w-5 rounded-full bg-white transition-all", on ? "left-[22px]" : "left-1")} />
    </button>
  );
}

export function Note({ children, tone = "muted", className }: { children: ReactNode; tone?: "muted" | "orange"; className?: string }) {
  if (tone === "orange") return <div className={cn("rounded-[12px] bg-orange-bg px-4 py-3 text-[13px] leading-relaxed text-orange-ink", className)}>{children}</div>;
  return <p className={cn("text-[13px] leading-relaxed text-muted", className)}>{children}</p>;
}
export function ErrorText({ children, className }: { children: ReactNode; className?: string }) {
  return <p role="alert" className={cn("mb-3 rounded-[10px] bg-red-bg px-4 py-2.5 text-[13px] font-semibold text-red", className)}>{children}</p>;
}

/* ------------------------------------------------------------------ 상수·도우미 */
/** 표 안·패널 버튼 (42px, 모서리 12) */
export const smallBtn = "h-[42px] min-h-0! rounded-[12px] px-4 text-[15px]";
export const linkCls = "text-[14px] font-semibold text-navy hover:underline disabled:opacity-40";
export const adminInput = "h-[42px] rounded-[10px] border border-[#CDD3DA] bg-white px-3.5 text-[14px] text-ink placeholder:text-muted focus:outline-none focus:border-navy";
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : "요청에 실패했어요");

export const TYPE_LABEL = { dorm: "숙박", buddy: "버디" } as const;
export const ROOM_LABEL = { single: "1인실", double: "2인실", twin: "트윈" } as const;
export const LANG_NAME: Record<string, string> = { ko: "한국어", en: "영어", ja: "일본어", zh: "중국어", fr: "프랑스어", es: "스페인어", de: "독일어" };
/** 한국어를 뺀 언어 이름 (영어·중국어) */
export const langNames = (l: string[]) => l.filter((x) => x !== "ko").map((x) => LANG_NAME[x] ?? x.toUpperCase()).join("·") || "한국어";
/** "고려대학교" → "고려대" */
export const univShort = (name?: string | null) => (name ?? "").replace(/학교$/, "");

/** "2027-01-15" 또는 "1/15" → "1월 15일" */
export function mdKo(s?: string | null): string {
  if (!s) return "";
  const iso = s.match(/^\d{4}-(\d{2})-(\d{2})/);
  if (iso) return `${Number(iso[1])}월 ${Number(iso[2])}일`;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})/);
  return m ? `${Number(m[1])}월 ${Number(m[2])}일` : s;
}
/** 관리자 예약 행 일정("1/14 – 1/16" · "1/13 14:00") → "1월 14일 – 16일" · "1월 13일 14:00". nights=true 면 ", 2박" */
export function scheduleKo(s: string, withNights = false): string {
  const range = s.match(/^(\d{1,2})\/(\d{1,2})\s*[–-]\s*(\d{1,2})\/(\d{1,2})/);
  if (range) {
    const [m1, d1, m2, d2] = range.slice(1).map(Number);
    const a = Date.UTC(2027, m1 - 1, d1);
    let b = Date.UTC(2027, m2 - 1, d2);
    if (b < a) b = Date.UTC(2028, m2 - 1, d2);
    const n = Math.round((b - a) / 86400000);
    return `${m1}월 ${d1}일 – ${m1 === m2 ? "" : `${m2}월 `}${d2}일${withNights ? `, ${n}박` : ""}`;
  }
  const one = s.match(/^(\d{1,2})\/(\d{1,2})(.*)$/);
  return one ? `${Number(one[1])}월 ${Number(one[2])}일${one[3]}` : s;
}
/** ISO 시각 → "1월 15일 18:20" (Asia/Seoul) */
export function dateTimeKo(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("month")}월 ${g("day")}일 ${g("hour")}:${g("minute")}`;
}
