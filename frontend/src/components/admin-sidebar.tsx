"use client";
// 어드민 왼쪽 메뉴 — 남색 바탕 + 흰 로고 "관리" 배지 (본문 흰 화면과 한눈에 구분). 대학 담당자는 대시보드·객실·예약·정산(자기 학교)만, 나머지는 운영팀(operator)만.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { get } from "@/lib/api";
import { session, useUser } from "@/lib/auth";
import type { AdminReportRow, ListResponse } from "@/lib/types";
import { Icon, LogoMark, cn, type IconName } from "./ui";

const MENU: { href: string; label: string; icon: IconName; operatorOnly?: boolean }[] = [
  { href: "/admin", label: "대시보드", icon: "grid" },
  { href: "/admin/rooms", label: "대학·객실", icon: "building" },
  { href: "/admin/bookings", label: "예약", icon: "list" },
  { href: "/admin/members", label: "회원·버디 승인", icon: "users", operatorOnly: true },
  { href: "/admin/tours", label: "산책 코스", icon: "route", operatorOnly: true },
  { href: "/admin/meal-claims", label: "식비 청구", icon: "receipt", operatorOnly: true },
  { href: "/admin/reports", label: "신고", icon: "flag", operatorOnly: true },
  { href: "/admin/settlements", label: "정산", icon: "wallet" },
];

export function AdminSidebar() {
  const path = usePathname();
  const router = useRouter();
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
  const logout = () => { session.clear(); router.push("/"); };
  const logoutBtn = (cls: string) => <button type="button" onClick={logout} className={cn("rounded-[10px] text-[14px] font-semibold text-white/70 hover:bg-white/10 hover:text-white", cls)}>로그아웃</button>;
  return (
    <aside className="sticky top-0 z-20 flex shrink-0 flex-col bg-navy text-white xl:h-dvh xl:w-[248px]">
      <div className="flex items-center justify-between gap-4 px-5 pb-3 pt-4 xl:block xl:px-8 xl:pb-7 xl:pt-7">
        <div className="flex min-w-0 items-center gap-3 xl:block">
          <Link href="/admin" aria-label="성북스테이 관리 홈" className="inline-flex items-center gap-2">
            <LogoMark className="h-7 w-7 rounded-[8px] ring-1 ring-white/25" />
            <span className="text-[20px] font-bold tracking-[-0.01em]">성북스테이</span>
            <span className="rounded-md bg-orange px-1.5 py-0.5 text-[11.5px] font-bold leading-none text-white">관리</span>
          </Link>
          <div className="truncate text-[13px] text-white/60 xl:mt-3">{who}</div>
        </div>
        {logoutBtn("h-9 shrink-0 px-3 xl:hidden")}
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-2 xl:flex-1 xl:flex-col xl:gap-0 xl:space-y-1.5 xl:overflow-visible xl:px-5 xl:pb-0" aria-label="관리 메뉴">
        {menu.map((m) => {
          const active = m.href === "/admin" ? path === "/admin" : path.startsWith(m.href);
          const badge = m.href === "/admin/reports" && isOperator ? openReports : 0;
          return (
            <Link key={m.href} href={m.href} aria-current={active ? "page" : undefined} className={cn("flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-[10px] px-3 text-[14px] xl:h-11 xl:gap-3 xl:px-3.5 xl:text-[15px]", active ? "bg-white font-bold text-navy" : "text-white/80 hover:bg-white/10 hover:text-white")}>
              <Icon name={m.icon} className="h-5 w-5" />
              <span className="xl:flex-1">{m.label}</span>
              {badge > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red px-1.5 text-[11px] font-bold text-white" aria-label={`처리 전 신고 ${badge}건`}>{badge}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="hidden px-5 pb-6 xl:block">
        {logoutBtn("flex h-11 w-full items-center px-3.5 text-left")}
      </div>
    </aside>
  );
}
