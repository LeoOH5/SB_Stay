"use client";
// B03 요청함 — BD-03 GET /buddy/requests(?status=), 수락/거절 PATCH /bookings/{id}/items/{item_id} {action, reason}
import { useCallback, useEffect, useState } from "react";
import { krDate, timeSpan } from "@/components/buddy/format";
import { LoginGate } from "@/components/buddy/login-gate";
import { RequestCard, type DecideAction } from "@/components/buddy/request-card";
import { useToast } from "@/components/buddy/toast";
import { usePlaceNames } from "@/components/buddy/ui";
import { Chip, Hero, Spinner, StatusPill } from "@/components/ui";
import { get, patch } from "@/lib/api";
import type { BuddyRequest, ItemStatus, ListResponse } from "@/lib/types";

type Tab = Extract<ItemStatus, "requested" | "confirmed" | "rejected">;
const TABS: { key: Tab; label: string; empty: string }[] = [
  { key: "requested", label: "새 요청", empty: "새 요청이 없어요." },
  { key: "confirmed", label: "수락함", empty: "수락한 동행이 없어요." },
  { key: "rejected", label: "거절함", empty: "거절한 요청이 없어요." },
];
const first = (n: string) => n.split(" ")[0];

export default function Page() {
  const { show, toast } = useToast();
  const places = usePlaceNames();
  const [tab, setTab] = useState<Tab>("requested");
  const [all, setAll] = useState<BuddyRequest[] | null>(null);
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);

  const reload = useCallback(() => {
    get<ListResponse<BuddyRequest>>("/buddy/requests").then((r) => setAll(r.items)).catch(() => setAll([]));
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const decide = async (req: BuddyRequest, action: DecideAction, reason?: string) => {
    setBusy(req.item_id);
    try {
      await patch(`/bookings/${req.booking_id}/items/${req.item_id}`, { action, reason });
      if (action === "reject" && reason) setReasons((m) => ({ ...m, [req.item_id]: reason }));
      show(action === "approve" ? `${first(req.tourist.name)}의 내 여행에 확정으로 보여요` : `${first(req.tourist.name)}의 요청을 거절했어요`);
      reload();
    } catch (e) { show(e instanceof Error ? e.message : "처리하지 못했어요"); }
    finally { setBusy(null); }
  };

  const items = all?.filter((r) => r.status === tab).sort((a, b) => (tab === "requested" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date))) ?? null;
  const newCount = all?.filter((r) => r.status === "requested").length ?? 0;
  const recent = (all ?? []).filter((r) => r.status === "confirmed" || r.status === "rejected").sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  return (
    <div className="pb-8">
      <Hero title="요청함">
        <div className="mt-5 flex gap-2 overflow-x-auto">
          {TABS.map((t) => <Chip key={t.key} selected={tab === t.key} onClick={() => setTab(t.key)}>{t.label}{t.key === "requested" && newCount > 0 ? ` ${newCount}` : ""}</Chip>)}
        </div>
      </Hero>
      <LoginGate />

      <div className="px-5">
        {items === null ? <Spinner /> : items.length === 0 ? (
          <p className="py-8 text-center text-[15px] text-muted">{TABS.find((t) => t.key === tab)?.empty}</p>
        ) : (
          <div className="space-y-3">
            {items.map((req) => <RequestCard key={req.item_id} req={req} placeNames={places} busy={busy === req.item_id} onDecide={(a, reason) => decide(req, a, reason)} />)}
          </div>
        )}

        <h2 className="mt-10 text-[18px] font-bold text-ink">최근 처리</h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-muted">수락하면 여행자의 내 여행에 확정으로 보여요. 숙박에 묶인 동행은 거절하면 여행자가 다른 버디를 골라요.</p>
        {all !== null && recent.length > 0 && (
          <div className="mt-2 divide-y divide-line">
            {recent.map((r) => (
              <div key={r.item_id} className="flex items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <div className="text-[16px] font-semibold text-ink">{r.tourist.name}</div>
                  <div className="mt-0.5 text-[14px] text-muted">{krDate(r.date)} {timeSpan(r.time, r.duration_min)}{r.status === "rejected" && reasons[r.item_id] ? ` · ${reasons[r.item_id]}` : ""}</div>
                </div>
                <StatusPill status={r.status} label={r.status === "confirmed" ? "수락함" : "거절함"} />
              </div>
            ))}
          </div>
        )}
      </div>
      {toast}
    </div>
  );
}
