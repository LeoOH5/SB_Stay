"use client";
// 내 여행 머리 오른쪽 — 알림 종(BK-10 GET /notifications) + 마이페이지 동그라미
import Link from "next/link";
import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/tourist";
import { dateTime } from "@/components/tourist/format";
import { Icon } from "@/components/ui";
import { get } from "@/lib/api";
import { useUser } from "@/lib/auth";
import type { ListResponse, Notification } from "@/lib/types";

export function NotiBell() {
  const { user } = useUser();
  const [notis, setNotis] = useState<Notification[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    get<ListResponse<Notification>>("/notifications").then((r) => { if (alive) setNotis(r.items); }).catch(() => { if (alive) setNotis([]); });
    return () => { alive = false; };
  }, [user]);

  const unread = (notis ?? []).filter((n) => !n.read_at).length;
  return (
    <div className="-mr-1.5 flex items-center gap-1">
      <button type="button" onClick={() => setOpen(true)} className="relative flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-gray-bg" aria-label={`알림${unread ? ` ${unread}개` : ""}`}>
        <Icon name="bell" className="h-[22px] w-[22px]" />
        {unread > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-orange" />}
      </button>
      {user && (
        <Link href="/me" aria-label="마이페이지" className="flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-gray-bg">
          <Icon name="user" className="h-[22px] w-[22px]" />
        </Link>
      )}
      <BottomSheet open={open} onClose={() => setOpen(false)} title="알림">
        {!user && <p className="py-6 text-center text-[14px] text-muted">로그인하면 예약 알림을 볼 수 있어요.</p>}
        {user && notis?.length === 0 && <p className="py-6 text-center text-[14px] text-muted">새 알림이 없어요.</p>}
        <div className="divide-y divide-line">
          {notis?.map((n) => (
            <div key={n.id} className="flex items-start gap-3 py-3">
              <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${n.read_at ? "bg-line" : "bg-orange"}`} />
              <div className="min-w-0 flex-1">
                <div className="text-[15px] text-ink">{n.title}</div>
                <div className="mt-0.5 text-[13px] text-muted">{dateTime(n.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}
