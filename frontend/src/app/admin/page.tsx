"use client";
// A01 대시보드 — 기간 KPI · 승인을 기다리는 숙박 · 날짜별 예약 막대 · 상태별 건수
import { useCallback, useEffect, useState } from "react";
import { get, patch, won, USE_MOCK } from "@/lib/api";
import { useUser } from "@/lib/auth";
import type { AdminBookingRow, Dashboard, DormRoom, ListResponse } from "@/lib/types";
import { Button, Spinner, cn } from "@/components/ui";
import {
  AdminGate, AdminHeader, EmptyRow, ErrorText, KpiStrip, SectionLabel, Select, SplitLayout, Table, Td, Tr, errMsg, mdKo, scheduleKo, smallBtn,
} from "@/components/admin/shell";

const PERIODS = [
  { key: "all", label: "전체 기간", from: "2027-01-05", to: "2027-02-20" },
  { key: "jan", label: "1월", from: "2027-01-05", to: "2027-01-31" },
  { key: "feb", label: "2월", from: "2027-02-01", to: "2027-02-20" },
];
const STATUS_ROWS: { key: string; label: string; dot: string }[] = [
  { key: "requested", label: "신청", dot: "bg-orange" },
  { key: "approved", label: "승인", dot: "bg-navy" },
  { key: "confirmed", label: "확정", dot: "bg-ink" },
  { key: "cancelled", label: "취소", dot: "bg-red" },
];

type AdminRoom = DormRoom & { total_rooms?: number };

/** 승인한 금액만큼 KPI 를 올려서 보여준다 (목 대시보드 응답은 바로 갱신되지 않아 로컬에서 가산) */
interface Adjust { revenue: number; nights: number; approved: number; rejected: number }
const ZERO: Adjust = { revenue: 0, nights: 0, approved: 0, rejected: 0 };
function applyAdjust(d: Dashboard, a: Adjust): Dashboard {
  const decided = a.approved + a.rejected;
  return {
    ...d,
    pending: Math.max(0, d.pending - decided),
    nights: d.nights + a.nights,
    dorm_revenue: d.dorm_revenue + a.revenue,
    platform_fee: d.platform_fee + Math.round(a.revenue * d.fee_rate),
    by_status: { ...d.by_status, requested: Math.max(0, (d.by_status.requested ?? 0) - decided), approved: (d.by_status.approved ?? 0) + a.approved },
  };
}
const nightsOf = (schedule: string) => Number(scheduleKo(schedule, true).match(/(\d+)박$/)?.[1] ?? 1);

/** "고려대학교 프런티어관 1인실" → "프런티어관 1인실" */
const roomTitle = (title: string, univName?: string) => (univName && title.startsWith(univName) ? title.slice(univName.length).trim() : title);

export default function AdminDashboardPage() {
  const { user } = useUser();
  const [period, setPeriod] = useState(PERIODS[0].key);
  const [raw, setRaw] = useState<Dashboard | null>(null);
  const [adjust, setAdjust] = useState<Adjust>(ZERO);
  const [rows, setRows] = useState<AdminBookingRow[] | null>(null);
  const [rooms, setRooms] = useState<AdminRoom[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);

  const p = PERIODS.find((x) => x.key === period) ?? PERIODS[0];
  const univId = user?.role === "univ_admin" ? user.university_id : null;

  const loadDashboard = useCallback(async (from: string, to: string) => setRaw(await get<Dashboard>("/admin/dashboard", { from, to })), []);
  const loadRows = useCallback(async () => setRows((await get<ListResponse<AdminBookingRow>>("/admin/bookings", { type: "dorm", status: "requested" })).items), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try { setError(null); await Promise.all([loadDashboard(p.from, p.to), loadRows()]); }
      catch (e) { if (alive) setError(errMsg(e)); }
    })();
    return () => { alive = false; };
  }, [p.from, p.to, loadDashboard, loadRows]);

  useEffect(() => {
    let alive = true;
    get<ListResponse<AdminRoom>>("/admin/dorms").then((r) => { if (alive) setRooms(r.items.filter((d) => !univId || d.university.id === univId)); }).catch(() => { /* KPI 하나만 비운다 */ });
    return () => { alive = false; };
  }, [univId]);

  async function decide(row: AdminBookingRow, action: "approve" | "reject") {
    let reason: string | undefined;
    if (action === "reject") {
      const r = window.prompt("거절 사유를 적어 주세요 (여행자에게 보여요)", "해당 기간 만실");
      if (r === null) return;
      reason = r || undefined;
    }
    setBusy(row.item_id);
    setRowError((m) => ({ ...m, [row.item_id]: "" }));
    try {
      await patch(`/bookings/${row.booking_id}/items/${row.item_id}`, { action, reason });
      setAdjust((a) => action === "approve"
        ? { ...a, revenue: a.revenue + row.price, nights: a.nights + nightsOf(row.schedule), approved: a.approved + 1 }
        : { ...a, rejected: a.rejected + 1 });
      await Promise.all([loadRows(), loadDashboard(p.from, p.to)]);
    } catch (e) {
      setRowError((m) => ({ ...m, [row.item_id]: errMsg(e) }));
    } finally {
      setBusy(null);
    }
  }

  // 실제 백엔드는 재조회 값에 이미 반영돼 있으므로 목 모드에서만 로컬 가산
  const dash = raw ? (USE_MOCK ? applyAdjust(raw, adjust) : raw) : null;
  const univ = rooms?.[0]?.university;
  const building = univId ? rooms?.[0]?.building : null;
  const place = univId ? [univ?.name, building].filter(Boolean).join(" ") : "전체 대학";
  const avgNight = dash && dash.nights ? Math.round(dash.dorm_revenue / dash.nights) : 0;

  // 2인실 남은 방: 객실 수(total_rooms)가 없으면 남은 방만
  const doubles = (rooms ?? []).filter((r) => r.room_type === "double" && (!building || r.building === building));
  const left = doubles.reduce((s, r) => s + r.available_rooms, 0);
  const total = doubles.every((r) => r.total_rooms != null) ? doubles.reduce((s, r) => s + (r.total_rooms ?? 0), 0) : null;

  return (
    <AdminGate>
      <AdminHeader
        title="2027 겨울방학"
        sub={dash ? `${place}, ${mdKo(dash.period.from)}부터 ${mdKo(dash.period.to)}까지` : place}
        right={<Select label="집계 기간" value={period} onChange={setPeriod} options={PERIODS.map((x) => ({ value: x.key, label: x.label }))} className="w-[128px]" />}
      />
      {error && <ErrorText>{error}</ErrorText>}

      <KpiStrip items={[
        { label: "예약", value: dash ? `${dash.bookings}건` : "—", sub: dash ? `승인 기다리는 것 ${dash.pending}건` : undefined },
        { label: "숙박 매출", value: dash ? won(dash.dorm_revenue) : "—", sub: dash ? `${dash.nights}박, 1박 평균 ${won(avgNight)}` : undefined },
        { label: "플랫폼 수수료", value: dash ? won(dash.platform_fee) : "—", sub: dash ? `수수료율 ${Math.round(dash.fee_rate * 100)}%` : undefined },
        { label: "2인실 남은 방", value: rooms ? (total ? `${left} / ${total}실` : `${left}실`) : "—", sub: rooms ? `${doubles.length}개 객실 유형 · 지금 기준` : undefined },
      ]} />

      {/* 승인을 기다리는 숙박 */}
      <SectionLabel>승인을 기다리는 숙박</SectionLabel>
      {!rows ? <Spinner /> : (
        <Table cols={[{ label: "신청자" }, { label: "국적" }, { label: "기간" }, { label: "객실" }, { label: "금액" }, { label: "", className: "w-[160px]" }]}>
          {rows.length === 0 && <EmptyRow cols={6}>승인을 기다리는 숙박이 없어요.</EmptyRow>}
          {rows.map((r) => (
            <Tr key={r.item_id} className="h-[75px]">
              <Td className="font-semibold">{r.tourist}</Td>
              <Td className="text-muted">{r.nationality}</Td>
              <Td>{scheduleKo(r.schedule, true)}</Td>
              <Td>{roomTitle(r.title, univId ? univ?.name : undefined)}</Td>
              <Td>{won(r.price)}</Td>
              <Td className="pr-4">
                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" full={false} className={smallBtn} disabled={busy === r.item_id} onClick={() => decide(r, "reject")}>거절</Button>
                  <Button variant="primary" full={false} className={smallBtn} disabled={busy === r.item_id} onClick={() => decide(r, "approve")}>승인</Button>
                </div>
                {rowError[r.item_id] && <div className="mt-1 text-right text-[12px] text-red">{rowError[r.item_id]}</div>}
              </Td>
            </Tr>
          ))}
        </Table>
      )}

      <div className="mt-10">
        <SplitLayout aside={<StatusList dash={dash} />}>
          <SectionLabel className="mb-5">날짜별 예약</SectionLabel>
          {!dash ? <Spinner /> : <DailyBars daily={dash.daily} />}
        </SplitLayout>
      </div>
    </AdminGate>
  );
}

/** 날짜별 예약 수 — 쪽빛 막대, 0인 날은 연한 회색 받침 */
function DailyBars({ daily }: { daily: Dashboard["daily"] }) {
  const max = Math.max(1, ...daily.map((d) => d.bookings));
  const ticks = new Set([0, Math.round((daily.length - 1) / 3), Math.round(((daily.length - 1) * 2) / 3), daily.length - 1]);
  return (
    <div>
      <div className="flex h-[136px] items-end gap-[10px] border-b border-line" role="img" aria-label={`날짜별 예약 수 ${daily.map((d) => `${mdKo(d.date)} ${d.bookings}건`).join(", ")}`}>
        {daily.map((d) => (
          <div key={d.date} className="group relative flex h-full flex-1 flex-col justify-end" title={`${mdKo(d.date)} · ${d.bookings}건 · ${won(d.revenue)}`}>
            <div className={cn("w-full rounded-t-[3px]", d.bookings > 0 ? "bg-navy" : "bg-[#E4E7EB]")} style={{ height: d.bookings > 0 ? `${Math.max(8, (d.bookings / max) * 96)}px` : "4px" }} />
          </div>
        ))}
      </div>
      <div className="relative mt-4 h-5 text-[13px] text-muted">
        {daily.map((d, i) => ticks.has(i) && (
          <span key={d.date} className={cn("absolute top-0 whitespace-nowrap", i === 0 ? "left-0" : i === daily.length - 1 ? "right-0" : "-translate-x-1/2")} style={i === 0 || i === daily.length - 1 ? undefined : { left: `${((i + 0.5) / daily.length) * 100}%` }}>
            {mdKo(d.date)}
          </span>
        ))}
      </div>
    </div>
  );
}

function StatusList({ dash }: { dash: Dashboard | null }) {
  return (
    <>
      <SectionLabel className="mb-3">상태별</SectionLabel>
      <ul className="divide-y divide-line">
        {STATUS_ROWS.map((s) => (
          <li key={s.key} className="flex h-[45px] items-center justify-between">
            <span className="inline-flex items-center gap-2 text-[14px] font-semibold text-ink"><span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />{s.label}</span>
            <span className="text-[14px] font-bold text-ink">{dash ? dash.by_status[s.key] ?? 0 : "—"}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
