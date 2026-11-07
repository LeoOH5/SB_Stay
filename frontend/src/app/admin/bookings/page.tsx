"use client";
// A02 예약 — 종류(전체/숙박/버디) · 상태 필터, 예약번호·이름 검색, 상세 펼침, 운영자만 취소
import { Fragment, Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { get, post, won } from "@/lib/api";
import { useUser } from "@/lib/auth";
import type { AdminBookingRow, ItemStatus, ItemType, ListResponse } from "@/lib/types";
import { Chip, Spinner, StatusPill } from "@/components/ui";
import {
  AdminGate, AdminHeader, BoxTag, EmptyRow, ErrorText, SearchInput, Select, TYPE_LABEL, Table, Td, Tr, errMsg, linkCls, scheduleKo, univShort, Pager, usePaged } from "@/components/admin/shell";

const TYPES: { key: ItemType | ""; label: string }[] = [{ key: "", label: "전체" }, { key: "dorm", label: "숙박" }, { key: "buddy", label: "버디" }];
const STATUSES: { key: ItemStatus | ""; label: string }[] = [{ key: "", label: "전체" }, { key: "requested", label: "신청" }, { key: "approved", label: "승인" }, { key: "confirmed", label: "확정" }, { key: "cancelled", label: "취소" }];
const PILL_LABEL: Record<ItemStatus, string> = { requested: "신청", approved: "승인", confirmed: "확정", cancelled: "취소", rejected: "거절" };
const chipCls = "h-9 px-3.5 text-[14px]";

export default function AdminBookingsPage() {
  return (
    <AdminGate>
      <Suspense fallback={<Spinner />}><BookingsBody /></Suspense>
    </AdminGate>
  );
}

function BookingsBody() {
  const sp = useSearchParams();
  const { user } = useUser();
  const isOperator = user?.role === "operator";
  const [type, setType] = useState<ItemType | "">("");
  const [status, setStatus] = useState<ItemStatus | "">("");
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [rows, setRows] = useState<AdminBookingRow[] | null>(null);
  const [univName, setUnivName] = useState<string | null>(null);
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

  // 대학 담당자: 부제에 쓸 대학 이름
  useEffect(() => {
    if (user?.role !== "univ_admin" || !user.university_id) return;
    let alive = true;
    get<ListResponse<{ university: { id: number; name: string } }>>("/admin/dorms")
      .then((r) => { if (alive) setUnivName(r.items.find((d) => d.university.id === user.university_id)?.university.name ?? null); })
      .catch(() => { /* 부제만 */ });
    return () => { alive = false; };
  }, [user?.role, user?.university_id]);

  const term = q.trim().toLowerCase();
  const visible = (rows ?? []).filter((r) => !term || r.code.toLowerCase().includes(term) || r.tourist.toLowerCase().includes(term));
  const pgVisible = usePaged(visible);

  async function cancel(row: AdminBookingRow) {
    if (!window.confirm(`${row.code} (${row.tourist}) 예약 전체를 취소할까요?\n모든 항목이 취소돼요.`)) return;
    setBusy(row.booking_id); setError(null);
    try {
      await post(`/bookings/${row.booking_id}/cancel`);
      // 목 /admin/bookings 는 취소 결과를 반영하지 않으므로 로컬 행을 갱신한다
      setRows((rs) => rs?.map((r) => (r.booking_id === row.booking_id ? { ...r, status: "cancelled" } : r)) ?? rs);
    } catch (e) { setError(errMsg(e)); } finally { setBusy(null); }
  }

  const sub = isOperator
    ? "모든 대학의 숙박·버디 항목이 보여요. 예약 취소는 운영자만 할 수 있어요."
    : `${univName ?? "우리 대학"} 항목만 보여요. 취소는 운영자만 할 수 있어요.`;

  return (
    <>
      <AdminHeader
        title="예약"
        sub={sub}
        right={<Select label="대학" value="mine" onChange={() => {}} options={[{ value: "mine", label: isOperator ? "전체 대학" : univShort(univName) || "내 대학" }]} className="w-[128px]" />}
      />
      {error && <ErrorText>{error}</ErrorText>}

      {/* 필터 */}
      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="종류">
          <span className="mr-1 text-[14px] text-muted">종류</span>
          {TYPES.map((t) => <Chip key={t.key} className={chipCls} selected={type === t.key} onClick={() => { setType(t.key); setRows(null); }}>{t.label}</Chip>)}
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="상태">
          <span className="mr-1 text-[14px] text-muted">상태</span>
          {STATUSES.map((s) => <Chip key={s.key} className={chipCls} selected={status === s.key} onClick={() => { setStatus(s.key); setRows(null); }}>{s.label}</Chip>)}
        </div>
        <SearchInput value={q} onChange={setQ} placeholder="예약번호나 이름" className="w-full sm:ml-auto sm:w-[280px]" />
      </div>

      {!rows ? <Spinner /> : (
        <><Table cols={[{ label: "예약번호" }, { label: "신청자" }, { label: "종류" }, { label: "항목" }, { label: "일정" }, { label: "금액" }, { label: "상태" }, { label: "", className: "w-[90px]" }]}>
          {visible.length === 0 && <EmptyRow cols={8}>조건에 맞는 예약이 없어요.</EmptyRow>}
          {pgVisible.items.map((r) => {
            const open = detail === r.item_id;
            return (
              <Fragment key={r.item_id}>
                <Tr selected={open}>
                  <Td className="font-semibold">{r.code}</Td>
                  <Td>{r.tourist} <span className="text-[13px] text-muted">{r.nationality}</span></Td>
                  <Td><BoxTag>{TYPE_LABEL[r.type]}</BoxTag></Td>
                  <Td>{r.title.replace(/^\S+학교\s+/, "")}</Td>
                  <Td>{scheduleKo(r.schedule)}</Td>
                  <Td>{won(r.price)}</Td>
                  <Td><StatusPill status={r.status} label={PILL_LABEL[r.status]} /></Td>
                  <Td className="pr-10 text-right">
                    <button type="button" className={linkCls + " text-ink"} aria-expanded={open} onClick={() => setDetail(open ? null : r.item_id)}>상세</button>
                  </Td>
                </Tr>
                {open && (
                  <tr className="border-b border-line bg-[#F7F8FA]">
                    <td colSpan={8} className="px-0 py-4">
                      <div className="flex flex-wrap items-center gap-x-8 gap-y-2 px-4 text-[13px]">
                        <span><span className="text-muted">예약번호</span> <b className="font-semibold">{r.code}</b></span>
                        <span><span className="text-muted">항목</span> {r.title}</span>
                        <span><span className="text-muted">일정</span> {scheduleKo(r.schedule, r.type === "dorm")}</span>
                        <span><span className="text-muted">항목 상태</span> {PILL_LABEL[r.status]}</span>
                        <span className="text-muted">{r.type === "dorm" ? "숙박은 대학 담당자가 승인해요" : "버디가 직접 수락해요"}</span>
                        {isOperator && r.status !== "cancelled" && (
                          <button type="button" className="ml-auto text-[13px] font-semibold text-red hover:underline disabled:opacity-40" disabled={busy === r.booking_id} onClick={() => cancel(r)}>예약 전체 취소</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </Table>
        <Pager {...pgVisible} /></>
      )}
    </>
  );
}
