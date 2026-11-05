"use client";
// 어드민 공통 셸 — 페이지 헤더(제목 + 로그인 사용자), 로그인 게이트, 표 프리미티브, 회색 주석
import Link from "next/link";
import { useSyncExternalStore, type ReactNode } from "react";
import { useUser } from "@/lib/auth";
import type { Role } from "@/lib/types";
import { Button, Card, cn } from "@/components/ui";

export const ROLE_LABEL: Record<Role, string> = { tourist: "관광객", buddy: "버디", guide: "해설사", univ_admin: "대학 담당자", operator: "운영자" };

/** 페이지 제목 + 로그인 사용자 이름·역할. right 에 기간 select·버튼 등을 둔다. */
export function AdminHeader({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  const { user } = useUser();
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-[22px] font-bold text-ink leading-tight">{title}</h1>
        {user && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-bg px-3 py-1 text-[12px] text-navy">
            <span className="font-semibold">{user.name}</span>
            <span className="text-navy/60">· {ROLE_LABEL[user.role]}</span>
          </span>
        )}
        {sub && <span className="basis-full text-[13px] text-muted">{sub}</span>}
      </div>
      {right}
    </div>
  );
}

/** 로그인 안 됐으면 안내 카드. 하이드레이션 전에는 아무것도 그리지 않는다(localStorage 스냅샷 대기). */
export function AdminGate({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const hydrated = useSyncExternalStore(() => () => {}, () => true, () => false);
  if (!hydrated) return null;
  if (!user) {
    return (
      <Card accent="orange" className="max-w-md">
        <div className="text-[15px] font-bold text-ink">대학 담당자 계정으로 로그인하세요</div>
        <p className="mt-1 text-[13px] text-muted">어드민 화면은 univ_admin · operator 역할만 사용할 수 있어요. (데모 계정: admin@a-univ.ac.kr / demo1234)</p>
        <Link href="/login" className="inline-block mt-3"><Button full={false} className="h-10 min-h-0 px-4 text-[14px]">로그인 →</Button></Link>
      </Card>
    );
  }
  return <>{children}</>;
}

/** 흰 카드 위 표. 헤더 bg-navy-bg · 12px muted, 행 48px, 구분선 border-line */
export function Table({ cols, children, className }: { cols: { label: string; className?: string }[]; children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-[14px] bg-white ring-1 ring-line/60 shadow-[0_1px_3px_rgba(31,42,68,0.08)]", className)}>
      <table className="w-full min-w-[640px] text-[13px] text-ink">
        <thead>
          <tr className="bg-navy-bg text-[12px] text-muted">
            {cols.map((c, i) => <th key={i} className={cn("h-10 px-4 text-left font-medium whitespace-nowrap", c.className)}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export function Tr({ children, className, dim }: { children: ReactNode; className?: string; dim?: boolean }) {
  return <tr className={cn("h-12 border-b border-line last:border-b-0", dim && "opacity-50", className)}>{children}</tr>;
}
export function Td({ children, className, colSpan, title }: { children?: ReactNode; className?: string; colSpan?: number; title?: string }) {
  return <td colSpan={colSpan} title={title} className={cn("px-4 py-2 align-middle whitespace-nowrap", className)}>{children}</td>;
}
export function EmptyRow({ cols, children }: { cols: number; children: ReactNode }) {
  return <Tr><Td colSpan={cols} className="h-16 text-center text-muted whitespace-normal">{children}</Td></Tr>;
}

export function SectionLabel({ children, right, className }: { children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-end justify-between gap-3 mt-7 mb-2", className)}>
      <h2 className="text-[15px] font-bold text-ink">{children}</h2>
      {right && <div className="text-[12px] text-muted text-right">{right}</div>}
    </div>
  );
}
export function Note({ children, tone = "muted", className }: { children: ReactNode; tone?: "muted" | "orange"; className?: string }) {
  if (tone === "orange") return <div className={cn("rounded-[14px] bg-orange-bg px-4 py-3 text-[13px] text-orange leading-relaxed", className)}>{children}</div>;
  return <p className={cn("text-[12px] text-muted leading-relaxed", className)}>{children}</p>;
}
export function ErrorText({ children }: { children: ReactNode }) { return <p className="text-[12px] text-orange mt-2">{children}</p>; }

export const smallBtn = "h-9 min-h-0 px-3 text-[13px] rounded-lg";
export const linkCls = "text-[13px] text-navy font-medium hover:underline";
export const adminInput = "h-9 rounded-lg border border-line bg-white px-3 text-[13px] text-ink placeholder:text-muted focus:outline-none focus:border-navy";
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : "요청에 실패했습니다");

export const TYPE_LABEL = { dorm: "숙박", tour: "투어", buddy: "버디" } as const;
export const ROOM_LABEL = { single: "1인실", double: "2인실", twin: "트윈" } as const;
export const LANG_LABEL: Record<string, string> = { ko: "한", en: "영", ja: "일", zh: "중", fr: "프", es: "스" };
export const langs = (l: string[]) => l.map((x) => LANG_LABEL[x] ?? x.toUpperCase()).join("/");
