"use client";
// A07 식비 청구 (운영팀 전용) — 버디가 올린 영수증 확인. 승인한 금액만 버디에게, 남은 보증금은 여행자에게 환불
import { useEffect, useState } from "react";
import { get, patch, won } from "@/lib/api";
import type { AdminMealClaimRow, ListResponse, MealClaimStatus } from "@/lib/types";
import { mediaSrc } from "@/lib/uploads";
import { Button, ImageBlock, Spinner, StatusPill } from "@/components/ui";
import {
  AdminHeader, EmptyRow, ErrorText, KeyValues, Note, OperatorOnly, SectionLabel, Select, SplitLayout, Table, Td, Tr, adminInput, errMsg, mdKo, smallBtn, Pager, usePaged } from "@/components/admin/shell";

/** 목업 행에는 traveler_agreed_over 가 있을 수 있지만 AdminMealClaimRow 타입에는 없다 */
type Row = AdminMealClaimRow & { traveler_agreed_over?: boolean | null };
type Filter = "all" | MealClaimStatus;

const refundOf = (c: Row) => Math.max(0, c.deposit_left - c.amount);

function ClaimStatus({ c }: { c: Row }) {
  if (c.status === "approved") return <StatusPill status="approved" label={`승인 · 환불 ${won(refundOf(c))}`} />;
  if (c.status === "rejected") return <StatusPill status="rejected" label="반려" />;
  return <StatusPill status="requested" label={c.over_limit ? `한도 초과 ${won(c.amount - c.limit)}` : "확인 중"} />;
}

export default function AdminMealClaimsPage() {
  return <OperatorOnly title="식비 청구"><MealClaims /></OperatorOnly>;
}

function MealClaims() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await get<ListResponse<Row>>("/admin/meal-claims");
        if (!alive) return;
        setRows(r.items);
        setSelected((s) => s ?? (r.items.find((c) => c.status === "requested") ?? r.items[0])?.id ?? null);
      } catch (e) { if (alive) setError(errMsg(e)); }
    })();
    return () => { alive = false; };
  }, []);

  const waiting = (rows ?? []).filter((c) => c.status === "requested").length;
  const visible = (rows ?? []).filter((c) => filter === "all" || c.status === filter);
  const pgVisible = usePaged(visible);
  const current = (rows ?? []).find((c) => c.id === selected) ?? null;

  return (
    <>
      <AdminHeader
        title="식비 청구"
        sub="버디가 올린 영수증을 확인해요. 승인한 금액만 버디에게 돌려주고, 남은 보증금은 여행자에게 환불돼요."
        right={
          <Select label="상태" value={filter} onChange={(v) => setFilter(v as Filter)} className="w-[170px]" options={[
            { value: "all", label: `확인 기다림 ${waiting} · 전체` },
            { value: "requested", label: `확인 기다림 ${waiting}` },
            { value: "approved", label: "승인" },
            { value: "rejected", label: "반려" },
          ]} />
        }
      />
      {error && <ErrorText>{error}</ErrorText>}

      <SplitLayout aside={current ? <ClaimPanel key={current.id} c={current} onDone={(c) => setRows((rs) => rs?.map((x) => (x.id === c.id ? { ...x, ...c } : x)) ?? rs)} /> : rows && <Note className="pt-10">왼쪽에서 청구를 고르면 영수증이 보여요.</Note>}>
        {!rows ? <Spinner /> : (
          <><Table dense cols={[{ label: "예약" }, { label: "버디" }, { label: "여행자" }, { label: "날짜" }, { label: "가게" }, { label: "청구" }, { label: "보증금 남음" }, { label: "상태" }]}>
            {visible.length === 0 && <EmptyRow cols={8}>{filter === "requested" ? "확인을 기다리는 청구가 없어요." : "청구가 없어요."}</EmptyRow>}
            {pgVisible.items.map((c) => (
              <Tr key={c.id} selected={c.id === selected} onClick={() => setSelected(c.id)}>
                <Td className="font-semibold">
                  <button type="button" className="text-left font-semibold" aria-pressed={c.id === selected} onClick={(e) => { e.stopPropagation(); setSelected(c.id); }}>{c.booking_code}</button>
                </Td>
                <Td>{c.buddy_name}</Td>
                <Td>{c.tourist}</Td>
                <Td className="text-muted">{mdKo(c.date)}</Td>
                <Td>{c.place}</Td>
                <Td>{won(c.amount)}</Td>
                <Td>{won(c.deposit_left)}</Td>
                <Td><ClaimStatus c={c} /></Td>
              </Tr>
            ))}
          </Table>
          <Pager {...pgVisible} /></>
        )}
      </SplitLayout>
    </>
  );
}

function ClaimPanel({ c, onDone }: { c: Row; onDone: (c: Row) => void }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(action: "approve" | "reject") {
    setBusy(true); setError(null);
    try {
      const out = await patch<Row>(`/admin/meal-claims/${c.id}`, action === "reject" ? { action, reason: reason.trim() || undefined } : { action });
      onDone({ ...c, ...out, status: out?.status ?? (action === "approve" ? "approved" : "rejected"), reason: out?.reason ?? (action === "reject" ? reason.trim() || null : c.reason) });
      setRejecting(false);
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }

  const agreed = c.traveler_agreed_over;
  const rows: { label: string; value: React.ReactNode; tone?: "red" | "orange" | "navy" }[] = [
    { label: "가게 · 메뉴", value: `${c.place} · ${c.items || "—"}` },
    { label: "요청 사항", value: c.request_summary || "없음" },
    { label: "1회 한도", value: won(c.limit) },
    { label: "보증금", value: `${won(c.deposit_left)} 남음 / ${won(c.deposit)}` },
  ];
  if (c.over_limit) rows.push({ label: "여행자 동의", value: agreed === true ? "초과분 동의함" : agreed === false ? "동의하지 않음" : "초과분 확인 필요", tone: agreed === true ? undefined : agreed === false ? "red" : "orange" });

  return (
    <div>
      <SectionLabel className="mb-4">영수증 · {c.booking_code}</SectionLabel>
      {mediaSrc(c.receipt_url) ? (
        <a href={mediaSrc(c.receipt_url)!} target="_blank" rel="noreferrer" className="block h-[220px] overflow-hidden rounded-[14px] bg-[#3B4652]" aria-label="영수증 사진 크게 보기">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mediaSrc(c.receipt_url)!} alt={`${c.place} 영수증`} className="h-full w-full object-contain" />
        </a>
      ) : <ImageBlock label={c.receipt_url ? "영수증 사진 자리 (예전 데모 값)" : "영수증 사진 없음"} h="h-[220px]" className="rounded-[14px]" />}
      <KeyValues className="mt-4" rows={rows} />

      {error && <ErrorText className="mt-3">{error}</ErrorText>}
      {c.status === "requested" && !rejecting && (
        <>
          {c.amount > c.deposit_left && <Note tone="orange" className="mt-3">남은 보증금({won(c.deposit_left)})보다 청구가 커요. 영수증과 여행자 동의를 확인하고 승인해 주세요.</Note>}
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <Button variant="ghost" className={smallBtn} disabled={busy} onClick={() => setRejecting(true)}>반려</Button>
            <Button variant="primary" className={smallBtn} disabled={busy} onClick={() => decide("approve")}>{won(c.amount)} 승인</Button>
          </div>
        </>
      )}
      {c.status === "requested" && rejecting && (
        <div className="mt-4">
          <label className="block text-[13px] text-muted">반려 이유 (버디에게 보여요)
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="예: 영수증 글자가 안 보여요. 다시 찍어 올려 주세요." className={adminInput + " mt-1.5 h-auto w-full resize-none py-2.5 leading-relaxed"} />
          </label>
          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            <Button variant="ghost" className={smallBtn} disabled={busy} onClick={() => setRejecting(false)}>취소</Button>
            <Button variant="danger" className={smallBtn} disabled={busy} onClick={() => decide("reject")}>반려하기</Button>
          </div>
        </div>
      )}
      {c.status === "approved" && <Note className="mt-4">승인했어요. 버디에게 {won(c.amount)}을 정산하고, 여행이 끝나면 남은 보증금 {won(refundOf(c))}을 여행자에게 돌려줘요.</Note>}
      {c.status === "rejected" && <Note className="mt-4">반려했어요{c.reason ? ` · ${c.reason}` : ""}. 버디가 다시 올릴 수 있어요.</Note>}
    </div>
  );
}
