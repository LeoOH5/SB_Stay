"use client";
// 예약 관리 (전체 목록) + 정산 관리
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { get, post, won } from "@/lib/api";
import { useUser } from "@/lib/auth";
import type { AdminBookingRow, ItemStatus, ItemType, ListResponse } from "@/lib/types";
import { Chip, Spinner, StatusPill } from "@/components/ui";
import { AdminGate, AdminHeader, EmptyRow, ErrorText, Note, TYPE_LABEL, Table, Td, Tr, adminInput, errMsg, linkCls } from "@/components/admin/shell";
import { SettlementSection } from "@/components/admin/settlement-section";

const TYPES: { key: ItemType | ""; label: string }[] = [{ key: "", label: "전체" }, { key: "dorm", label: "숙박" }, { key: "tour", label: "투어" }, { key: "buddy", label: "버디" }];
const STATUSES: { key: ItemStatus | ""; label: string }[] = [{ key: "", label: "전체" }, { key: "requested", label: "신청" }, { key: "approved", label: "승인" }, { key: "confirmed", label: "확정" }, { key: "cancelled", label: "취소" }];
const PILL_LABEL: Record<ItemStatus, string> = { requested: "신청", approved: "승인", confirmed: "확정", cancelled: "취소", rejected: "거절" };

export default function AdminBookingsPage() {
  return (
    <AdminGate>
      <Suspense fallback={<Spinner />}><BookingsBody /></Suspense>
      <div className="mt-10"><SettlementSection /></div>
    </AdminGate>
  );
}

function BookingsBody() {
  const sp = useSearchParams();
  const { user } = useUser();
  const [type, setType] = useState<ItemType | "">("");
  const [status, setStatus] = useState<ItemStatus | "">("");
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [rows, setRows] = useState<AdminBookingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    const r = await get<ListResponse<AdminBookingRow>>("/admin/bookings", { type: type || undefined, status: status || undefined });
    setRows(r.items);
  }, [type, status]);

  useEffect(() => {
    let alive = true;
    (async () => { try { await load(); if (alive) setError(null); } catch (e) { if (alive) setError(errMsg(e)); } })();
    return () => { alive = false; };
  }, [load]);

  const term = q.trim().toLowerCase();
  const visible = (rows ?? []).filter((r) => !term || r.code.toLowerCase().includes(term) || r.tourist.toLowerCase().includes(term));
  const canCancel = user?.role === "operator";

  async function cancel(row: AdminBookingRow) {
    if (!window.confirm(`${row.code} (${row.tourist}) 예약 전체를 취소할까요?\n모든 항목이 취소 상태가 됩니다.`)) return;
    setBusy(row.booking_id); setError(null);
    try {
      await post(`/bookings/${row.booking_id}/cancel`);
      // 목 /admin/bookings 는 취소 결과를 반영하지 않으므로 로컬 행을 갱신한다
      setRows((rs) => rs?.map((r) => (r.booking_id === row.booking_id ? { ...r, status: "cancelled" } : r)) ?? rs);
    } catch (e) { setError(errMsg(e)); } finally { setBusy(null); }
  }

  return (
    <>
      <AdminHeader title="예약 관리 · 전체" right={<select className={adminInput + " w-[200px]"} aria-label="대학 필터" defaultValue="all"><option value="all">{user?.role === "univ_admin" ? "내 대학" : "전체 대학"}</option></select>} />
      {error && <ErrorText>{error}</ErrorText>}

      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 mb-4">
        <div className="flex items-center gap-2"><span className="text-[13px] text-muted">유형</span>{TYPES.map((t) => <Chip key={t.key} selected={type === t.key} onClick={() => { setType(t.key); setRows(null); }}>{t.label}</Chip>)}</div>
        <div className="flex items-center gap-2"><span className="text-[13px] text-muted">상태</span>{STATUSES.map((s) => <Chip key={s.key} selected={status === s.key} onClick={() => { setStatus(s.key); setRows(null); }}>{s.label}</Chip>)}</div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="예약번호 · 이름 검색" className={adminInput + " w-[220px] ml-auto"} />
      </div>

      {!rows ? <Spinner /> : (
        <Table cols={[{ label: "예약번호" }, { label: "신청자" }, { label: "유형" }, { label: "항목" }, { label: "일정" }, { label: "금액" }, { label: "상태" }, { label: "" }]}>
          {visible.length === 0 && <EmptyRow cols={8}>조건에 맞는 예약이 없어요.</EmptyRow>}
          {visible.map((r) => (
            <Tr key={r.item_id} className={detail === r.item_id ? "bg-navy-bg/40" : undefined}>
              <Td className="font-semibold">{r.code}</Td>
              <Td>{r.tourist}<span className="text-muted text-[12px]"> · {r.nationality}</span></Td>
              <Td>{TYPE_LABEL[r.type]}</Td>
              <Td>{r.title}</Td>
              <Td>{r.schedule}</Td>
              <Td className="font-semibold">{won(r.price)}</Td>
              <Td><StatusPill status={r.status} label={PILL_LABEL[r.status]} /></Td>
              <Td>
                <div className="flex items-center gap-3">
                  <button type="button" className={linkCls} onClick={() => setDetail((d) => (d === r.item_id ? null : r.item_id))}>상세</button>
                  {r.status !== "cancelled" && canCancel && <button type="button" className={linkCls + " text-muted"} disabled={busy === r.booking_id} onClick={() => cancel(r)}>취소</button>}
                </div>
                {detail === r.item_id && (
                  <div className="mt-1 text-[12px] text-muted whitespace-normal">
                    booking_id {r.booking_id} · item_id {r.item_id} · university_id {r.university_id ?? "—"} · 상태 {r.status}
                  </div>
                )}
              </Td>
            </Tr>
          ))}
        </Table>
      )}
      <Note className="mt-3">투어 항목은 즉시 확정되고, 버디 항목은 버디가 수락하면 확정돼요.</Note>
    </>
  );
}
