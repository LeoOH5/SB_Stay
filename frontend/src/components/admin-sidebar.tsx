"use client";
// 어드민 왼쪽 메뉴 — v3: 흰 바탕 + 로고 "관리" 배지. 식비·신고·정산은 운영팀(operator) 계정에서만 보인다.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { get } from "@/lib/api";
import { useUser } from "@/lib/auth";
import type { AdminReportRow, ListResponse } from "@/lib/types";
import { Brand, Icon, cn, type IconName } from "./ui";

const MENU: { href: string; label: string; icon: IconName; operatorOnly?: boolean }[] = [
  { href: "/admin", label: "대시보드", icon: "grid" },
  { href: "/admin/rooms", label: "대학·객실", icon: "building" },
  { href: "/admin/bookings", label: "예약", icon: "list" },
  { href: "/admin/members", label: "회원·버디 승인", icon: "users" },
  { href: "/admin/tours", label: "산책 코스", icon: "route" },
  { href: "/admin/meal-claims", label: "식비 청구", icon: "receipt", operatorOnly: true },
  { href: "/admin/reports", label: "신고", icon: "flag", operatorOnly: true },
  { href: "/admin/settlements", label: "정산", icon: "wallet", operatorOnly: true },
];

export function AdminSidebar() {
  const path = usePathname();
  const { user } = useUser();
  const isOperator = user?.role === "operator";
  const [openReports, setOpenReports] = useState(0);

  useEffect(() => {
    if (!isOperator) return;
    let alive = true;
    get<ListResponse<AdminReportRow>>("/admin/reports", { status: "open" }).then((r) => { if (alive) setOpenReports(r.items.length); }).catch(() => { /* 배지는 선택 */ });
    return () => { alive = false; };
  }, [isOperator, path]);

  const who = user ? (user.role === "operator" ? "성북스테이 운영팀" : user.name) : "성북스테이 관리";
  const menu = MENU.filter((m) => !m.operatorOnly || isOperator);
  return (
    <aside className="sticky top-0 flex h-dvh w-[248px] shrink-0 flex-col border-r border-line bg-white">
      <div className="px-8 pb-7 pt-7">
        <Brand badge="관리" href="/admin" />
        <div className="mt-3 truncate text-[13px] text-muted">{who}</div>
      </div>
      <nav className="flex-1 space-y-1.5 px-5" aria-label="관리 메뉴">
        {menu.map((m) => {
          const active = m.href === "/admin" ? path === "/admin" : path.startsWith(m.href);
          const badge = m.href === "/admin/reports" && isOperator ? openReports : 0;
          return (
            <Link key={m.href} href={m.href} aria-current={active ? "page" : undefined} className={cn("flex h-11 items-center gap-3 rounded-[10px] px-3.5 text-[15px]", active ? "bg-navy-bg font-bold text-navy" : "text-ink hover:bg-gray-bg")}>
              <Icon name={m.icon} className="h-5 w-5" />
              <span className="flex-1">{m.label}</span>
              {badge > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red px-1.5 text-[11px] font-bold text-white" aria-label={`처리 전 신고 ${badge}건`}>{badge}</span>}
            </Link>
          );
        })}
      </nav>
      <p className="px-5 pb-6 text-[13px] leading-relaxed text-muted">식비·신고·정산은 운영팀 계정에서만 보여요</p>
    </aside>
  );
}
