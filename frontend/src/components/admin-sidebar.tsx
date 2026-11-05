"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@/lib/auth";
import { ROLE_LABEL } from "./admin/shell";
import { cn } from "./ui";

const MENU = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/rooms", label: "대학 / 객실 관리" },
  { href: "/admin/bookings", label: "예약 관리" },
  { href: "/admin/members", label: "회원 관리 (버디 승인)" },
  { href: "/admin/tours", label: "투어 코스 관리" },
  { href: "/admin/settlements", label: "정산 관리" },
];

export function AdminSidebar() {
  const path = usePathname();
  const { user } = useUser();
  const who = user ? `${user.name} · ${ROLE_LABEL[user.role]}` : "A대학교 국제관 담당자";
  return (
    <aside className="w-60 shrink-0 bg-navy text-white flex flex-col">
      <div className="px-5 py-5"><div className="text-[15px] font-bold">SB Stay Admin</div><div className="text-[12px] text-white/60 mt-0.5 truncate">{who}</div></div>
      <nav className="flex-1 px-3 space-y-1">
        {MENU.map((m) => { const active = m.href === "/admin" ? path === "/admin" : path.startsWith(m.href); return (
          <Link key={m.href} href={m.href} className={cn("block rounded-lg px-3 py-2.5 text-[14px] border-l-4", active ? "bg-white/10 border-l-green font-semibold" : "border-l-transparent text-white/80 hover:bg-white/5")}>{m.label}</Link>
        ); })}
      </nav>
    </aside>
  );
}
