"use client";
// B2 요청함 · 새 요청 / 수락됨 / 거절됨
// API: GET /buddy/requests?status= (BD-05), PATCH /bookings/{id}/items/{itemId} (BK-04)
import { useCallback, useEffect, useState } from "react";
import { Card, Chip, Empty, Hero, SectionTitle, Spinner, StatusPill } from "@/components/ui";
import { get, patch } from "@/lib/api";
import { useUser } from "@/lib/auth";
import type { BuddyRequest, ItemStatus, ListResponse } from "@/lib/types";
import { fmtDate, timeRange } from "@/components/buddy/format";
import { LoginGate } from "@/components/buddy/login-gate";
import { RequestCard, type DecideAction } from "@/components/buddy/request-card";
import { useToast } from "@/components/buddy/toast";

type Tab = Extract<ItemStatus, "requested" | "confirmed" | "rejected">;
const TABS: { key: Tab; label: string }[] = [{ key: "requested", label: "새 요청" }, { key: "confirmed", label: "수락됨" }, { key: "rejected", label: "거절됨" }];

export default function Page() {
  const { user } = useUser();
  const { show, toast } = useToast();
  const [tab, setTab] = useState<Tab>("requested");
  const [all, setAll] = useState<BuddyRequest[] | null>(null);
  const [byTab, setByTab] = useState<Partial<Record<Tab, BuddyRequest[]>>>({});
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);

  const reloadAll = useCallback(() => {
    get<ListResponse<BuddyRequest>>("/buddy/requests").then((r) => setAll(r.items)).catch(() => setAll([]));
  }, []);
  const reloadTab = useCallback((t: Tab) => {
    get<ListResponse<BuddyRequest>>("/buddy/requests", { status: t }).then((r) => setByTab((p) => ({ ...p, [t]: r.items }))).catch(() => setByTab((p) => ({ ...p, [t]: [] })));
  }, []);

  useEffect(() => { reloadAll(); }, [reloadAll]);
  useEffect(() => { reloadTab(tab); }, [tab, reloadTab]);

  const items = byTab[tab] ?? null;
  const count = (s: ItemStatus) => all?.filter((r) => r.status === s).length ?? 0;

  const decide = async (req: BuddyRequest, action: DecideAction, reason?: string) => {
    setBusy(req.item_id);
    try {
      await patch(`/bookings/0/items/${req.item_id}`, { action, reason });
      if (action === "reject" && reason) setReasons((m) => ({ ...m, [req.item_id]: reason }));
      show(action === "approve" ? `${req.tourist.name} 요청을 수락했어요 · 관광객 T6에 '확정' 표시` : `${req.tourist.name} 요청을 거절했어요`);
      setByTab({}); reloadAll(); reloadTab(tab);
    } catch (e) {
      show(e instanceof Error ? e.message : "처리에 실패했어요");
    } finally { setBusy(null); }
  };

  const recent = (all ?? []).filter((r) => r.status === "confirmed" || r.status === "rejected").sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const kind = user?.role === "guide" ? "투어" : "동행";

  return (
    <div className="pb-6">
      <Hero title="요청함" sub={`새 요청 ${count("requested")} · 수락됨 ${count("confirmed")} · 거절됨 ${count("rejected")}`} />
      <LoginGate />

      <div className="px-5">
        <div className="mt-4 flex gap-2 overflow-x-auto">
          {TABS.map((t) => (
            <Chip key={t.key} selected={tab === t.key} onClick={() => setTab(t.key)}>{t.label}{t.key === "requested" && count("requested") > 0 ? ` ${count("requested")}` : ""}</Chip>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {items === null ? <Spinner /> : items.length === 0 ? <Card><Empty>{TABS.find((t) => t.key === tab)?.label} 요청이 없어요</Empty></Card> : (
            items.map((req) => (
              <RequestCard key={req.item_id} req={req} busy={busy === req.item_id}
                onDecide={tab === "requested" ? (a, reason) => decide(req, a, reason) : undefined} />
            ))
          )}
        </div>

        <SectionTitle>최근 처리</SectionTitle>
        {all === null ? <Spinner /> : recent.length === 0 ? <Card><Empty>처리한 요청이 없어요</Empty></Card> : (
          <div className="space-y-2">
            {recent.map((r) => (
              <Card key={r.item_id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-ink">{r.tourist.name} · {r.tourist.nationality}</div>
                  <div className="mt-0.5 truncate text-[12px] text-muted">
                    {fmtDate(r.date)} {r.status === "confirmed" ? timeRange(r.time, r.duration_min) : r.time} · {r.status === "rejected" ? (reasons[r.item_id] ?? "일정 겹침") : `${r.interests.join("·")} ${kind}`}
                  </div>
                </div>
                <StatusPill status={r.status} label={r.status === "confirmed" ? "수락됨" : "거절됨"} />
              </Card>
            ))}
          </div>
        )}
        <p className="mt-3 text-[12px] text-muted">수락하면 관광객 T6에 &lsquo;확정&rsquo;으로 표시 · 거절 시 사유 선택</p>
      </div>
      {toast}
    </div>
  );
}
