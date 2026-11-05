"use client";
// A1 대시보드 + 숙박 승인 — GET /admin/dashboard (AD-01), GET /admin/bookings?type=dorm&status=requested (AD-02), PATCH /bookings/{id}/items/{itemId} (BK-04)
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { get, patch, won } from "@/lib/api";
import type { AdminBookingRow, Dashboard, ListResponse } from "@/lib/types";
import { Button, Card, KpiTile, Spinner } from "@/components/ui";
import { AdminGate, AdminHeader, EmptyRow, ErrorText, Note, ROOM_LABEL, SectionLabel, Table, Td, Tr, adminInput, errMsg, linkCls, smallBtn } from "@/components/admin/shell";

const PERIODS = [
  { key: "winter", label: "1/5 – 2/20", from: "2027-01-05", to: "2027-02-20" },
  { key: "jan", label: "1/5 – 1/31", from: "2027-01-05", to: "2027-01-31" },
];
const NIGHT_PRICE = 35000; // 2인실 1박 가정값 — KPI 부제 "72박 × ₩35,000"
const STATUS_ROWS: { key: string; label: string; cls: string }[] = [
  { key: "requested", label: "신청", cls: "text-orange" },
  { key: "approved", label: "승인", cls: "text-navy" },
  { key: "confirmed", label: "확정", cls: "text-green-dark" },
  { key: "cancelled", label: "취소", cls: "text-muted" },
];

/** 승인한 금액만큼 KPI 를 올려서 보여준다 (데모 포인트: 목 대시보드는 고정 응답이라 로컬에서 가산) */
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

// 객실명("A대 국제관 2인실")에서 객실 유형만 뽑는다
function roomOf(title: string) {
  for (const l of Object.values(ROOM_LABEL)) if (title.includes(l)) return l;
  return title;
}

export default function AdminDashboardPage() {
  const [period, setPeriod] = useState(PERIODS[0].key);
  const [raw, setRaw] = useState<Dashboard | null>(null);
  const [adjust, setAdjust] = useState<Adjust>(ZERO);
  const [rows, setRows] = useState<AdminBookingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);

  const p = PERIODS.find((x) => x.key === period) ?? PERIODS[0];

  const loadDashboard = useCallback(async (from: string, to: string) => {
    const d = await get<Dashboard>("/admin/dashboard", { from, to });
    setRaw(d);
  }, []);
  const loadRows = useCallback(async () => {
    const r = await get<ListResponse<AdminBookingRow>>("/admin/bookings", { type: "dorm", status: "requested" });
    setRows(r.items);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try { setError(null); await Promise.all([loadDashboard(p.from, p.to), loadRows()]); }
      catch (e) { if (alive) setError(errMsg(e)); }
    })();
    return () => { alive = false; };
  }, [p.from, p.to, loadDashboard, loadRows]);

  async function decide(row: AdminBookingRow, action: "approve" | "reject") {
    let reason: string | undefined;
    if (action === "reject") {
      const r = window.prompt("거절 사유를 입력하세요 (관광객에게 표시됩니다)", "해당 기간 만실");
      if (r === null) return;
      reason = r || undefined;
    }
    setBusy(row.item_id);
    setRowError((m) => ({ ...m, [row.item_id]: "" }));
    try {
      await patch(`/bookings/${row.booking_id}/items/${row.item_id}`, { action, reason });
      // 승인 시 매출·수수료·박수 가산, 거절 시 대기 건수만 감소
      setAdjust((a) => action === "approve"
        ? { ...a, revenue: a.revenue + row.price, nights: a.nights + Math.max(1, Math.round(row.price / NIGHT_PRICE)), approved: a.approved + 1 }
        : { ...a, rejected: a.rejected + 1 });
      await Promise.all([loadRows(), loadDashboard(p.from, p.to)]);
    } catch (e) {
      setRowError((m) => ({ ...m, [row.item_id]: errMsg(e) }));
    } finally {
      setBusy(null);
    }
  }

  const dash = raw ? applyAdjust(raw, adjust) : null;
  const maxDaily = dash ? Math.max(1, ...dash.daily.map((d) => d.bookings)) : 1;

  return (
    <AdminGate>
      <AdminHeader
        title="대시보드 · 2027 겨울방학"
        right={
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className={adminInput + " w-[200px]"} aria-label="집계 기간">
            {PERIODS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
          </select>
        }
      />
      {error && <ErrorText>{error}</ErrorText>}

      {/* KPI 3개 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiTile label="겨울방학 예약" value={dash ? `${dash.bookings}건` : "—"} sub={dash ? `승인 대기 ${dash.pending}건` : undefined} />
        <KpiTile label="숙박 매출 (학교)" value={dash ? won(dash.dorm_revenue) : "—"} sub={dash ? `${dash.nights}박 × ${won(NIGHT_PRICE)}` : undefined} />
        <KpiTile label="플랫폼 수수료" value={dash ? won(dash.platform_fee) : "—"} sub={dash ? `수수료율 ${Math.round(dash.fee_rate * 100)}% 가정` : undefined} accent />
      </div>

      {/* 숙박 승인 대기 */}
      <SectionLabel right="PATCH /bookings/{id}/items/{itemId} (BK-04)">숙박 승인 대기</SectionLabel>
      {!rows ? <Spinner /> : (
        <Table cols={[{ label: "신청자" }, { label: "국적" }, { label: "기간" }, { label: "객실" }, { label: "금액" }, { label: "" }]}>
          {rows.length === 0 && <EmptyRow cols={6}>승인 대기 중인 숙박 신청이 없어요.</EmptyRow>}
          {rows.map((r) => (
            <Tr key={r.item_id}>
              <Td className="font-semibold">{r.tourist}</Td>
              <Td>{r.nationality}</Td>
              <Td>{r.schedule}</Td>
              <Td>{roomOf(r.title)}</Td>
              <Td className="font-semibold">{won(r.price)}</Td>
              <Td>
                <div className="flex items-center gap-2">
                  <Button variant="primary" full={false} className={smallBtn} disabled={busy === r.item_id} onClick={() => decide(r, "approve")}>승인</Button>
                  <Button variant="ghost" full={false} className={smallBtn} disabled={busy === r.item_id} onClick={() => decide(r, "reject")}>거절</Button>
                  <Link href={`/admin/bookings?q=${encodeURIComponent(r.code)}`} className={linkCls + " ml-2"}>상세 →</Link>
                </div>
                {rowError[r.item_id] && <div className="text-[12px] text-orange mt-1">{rowError[r.item_id]}</div>}
              </Td>
            </Tr>
          ))}
        </Table>
      )}

      {/* 최근 예약 흐름 */}
      <SectionLabel>최근 예약 흐름 (샘플 20~30건 · 상태 섞어서)</SectionLabel>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[14px] font-semibold text-ink">일별 예약 수</div>
            <div className="text-[12px] text-muted">{dash ? `${dash.period.from} – ${dash.period.to}` : ""}</div>
          </div>
          {!dash ? <Spinner /> : (
            <div className="flex items-end gap-1.5 h-[120px]">
              {dash.daily.map((d) => (
                <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full gap-1" title={`${d.date} · ${d.bookings}건 · ${won(d.revenue)}`}>
                  <div className="text-[11px] text-muted leading-none">{d.bookings}</div>
                  <div className="w-full rounded-t-md bg-navy" style={{ height: `${Math.max(6, (d.bookings / maxDaily) * 80)}px` }} />
                  <div className="text-[10px] text-muted leading-none">{Number(d.date.slice(8))}일</div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <div className="text-[14px] font-semibold text-ink mb-2">상태별 건수</div>
          <table className="w-full text-[13px]">
            <tbody>
              {STATUS_ROWS.map((s) => (
                <tr key={s.key} className="h-7">
                  <td className={s.cls}>{s.label}</td>
                  <td className="text-right font-semibold text-ink">{dash ? dash.by_status[s.key] ?? 0 : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
      <Note className="mt-4">객실 단가는 방학 중 기숙사를 일반에 개방한 국내 대학 사례(2인실 1박 3만5천 원)를 참고한 가정값. 수수료율도 가정값.</Note>
    </AdminGate>
  );
}
