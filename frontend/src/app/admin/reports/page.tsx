"use client";
// A08 신고 (운영팀 전용) — 신고가 2건(기각 제외) 쌓이면 버디 활동이 자동으로 멈춘다. 확인 후 경고·정지·정지 풀기·기각
import { useEffect, useMemo, useState } from "react";
import { get, patch } from "@/lib/api";
import { REPORT_SUSPEND_AT } from "@/lib/codes";
import type { AdminBookingRow, AdminBuddyRow, AdminReportRow, ListResponse, ReportAction, ReportCategory, ReportStatus } from "@/lib/types";
import { Button, Spinner, StatusPill } from "@/components/ui";
import {
  AdminHeader, EmptyRow, ErrorText, KeyValues, Note, OperatorOnly, SectionLabel, Select, SplitLayout, Table, Td, Tr, dateTimeKo, errMsg, scheduleKo, smallBtn, univShort,
} from "@/components/admin/shell";

/** 표에 들어가는 짧은 유형 이름 (긴 이름은 lib/codes REPORT_CATEGORY) */
const CATEGORY_SHORT: Record<ReportCategory, string> = { no_show: "약속 장소에 안 옴", rude: "불편한 말이나 행동", money: "돈·선물 요구", unsafe: "안전이 걱정됨", other: "기타" };
const ACTION_DONE: Record<string, string> = { warn: "경고 완료", suspend: "활동 정지", unsuspend: "정지 풀림", dismiss: "기각" };
type Filter = "all" | ReportStatus;
/** 목업·백엔드 응답에는 신고 원본 필드(booking_item_id, resolved_at)도 함께 오지만 AdminReportRow 타입에는 없다 */
type Row = AdminReportRow & { booking_item_id?: number | null; resolved_at?: string | null };

function ReportStatusPill({ r }: { r: AdminReportRow }) {
  if (r.status === "open") return r.auto_suspended && r.buddy_status === "suspended" ? <StatusPill status="suspended" label="자동 정지됨" /> : <StatusPill status="open" label="처리 전" />;
  if (r.status === "dismissed") return <StatusPill status="dismissed" label="기각" />;
  return r.action === "suspend" ? <StatusPill status="suspended" label="활동 정지" /> : <StatusPill status="x" tone="gray" label={ACTION_DONE[r.action ?? ""] ?? "처리 완료"} />;
}

export default function AdminReportsPage() {
  return <OperatorOnly title="신고"><Reports /></OperatorOnly>;
}

function Reports() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [buddies, setBuddies] = useState<AdminBuddyRow[]>([]);
  const [bookings, setBookings] = useState<AdminBookingRow[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await get<ListResponse<Row>>("/admin/reports");
        if (!alive) return;
        // 처리 전이 위로, 그 안에서는 최근 순
        const sorted = [...r.items].sort((a, b) => Number(b.status === "open") - Number(a.status === "open") || b.created_at.localeCompare(a.created_at));
        setRows(sorted);
        setSelected((s) => s ?? sorted[0]?.id ?? null);
      } catch (e) { if (alive) setError(errMsg(e)); }
    })();
    // 패널 보조 정보 (버디 학과, 신고된 동행 일정·남은 예약) — 없어도 화면은 동작
    get<ListResponse<AdminBuddyRow>>("/admin/buddies").then((r) => { if (alive) setBuddies(r.items); }).catch(() => {});
    get<ListResponse<AdminBookingRow>>("/admin/bookings", { type: "buddy" }).then((r) => { if (alive) setBookings(r.items); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // 누적: 그 신고가 들어온 시점까지 같은 버디에게 쌓인 신고 수 (기각 제외)
  const running = useMemo(() => {
    const out: Record<number, number> = {};
    const byBuddy: Record<number, number> = {};
    for (const r of [...(rows ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
      if (r.status !== "dismissed") byBuddy[r.buddy_id] = (byBuddy[r.buddy_id] ?? 0) + 1;
      out[r.id] = byBuddy[r.buddy_id] ?? 0;
    }
    return out;
  }, [rows]);

  const openCount = (rows ?? []).filter((r) => r.status === "open").length;
  const visible = (rows ?? []).filter((r) => filter === "all" || r.status === filter);
  const current = (rows ?? []).find((r) => r.id === selected) ?? null;

  function applyResult(out: Row) {
    // 같은 버디의 다른 신고 행도 버디 상태를 맞춘다
    setRows((rs) => rs?.map((x) => (x.id === out.id ? { ...x, ...out } : x.buddy_id === out.buddy_id ? { ...x, buddy_status: out.buddy_status } : x)) ?? rs);
    setBuddies((bs) => bs.map((b) => (b.id === out.buddy_id ? { ...b, status: out.buddy_status } : b)));
  }

  return (
    <>
      <AdminHeader
        title="신고"
        sub={`신고가 ${REPORT_SUSPEND_AT}건 쌓이면 버디 활동이 자동으로 멈춰요. 확인한 뒤 풀거나 정지해요.`}
        right={
          <Select label="상태" value={filter} onChange={(v) => setFilter(v as Filter)} className="w-[150px]" options={[
            { value: "all", label: `처리 전 ${openCount} · 전체` },
            { value: "open", label: `처리 전 ${openCount}` },
            { value: "resolved", label: "처리 완료" },
            { value: "dismissed", label: "기각" },
          ]} />
        }
      />
      {error && <ErrorText>{error}</ErrorText>}

      <SplitLayout aside={current ? <ReportPanel key={current.id} r={current} buddy={buddies.find((b) => b.id === current.buddy_id)} bookings={bookings} onDone={applyResult} /> : rows && <Note className="pt-10">왼쪽에서 신고를 고르면 내용이 보여요.</Note>}>
        {!rows ? <Spinner /> : (
          <Table dense cols={[{ label: "접수" }, { label: "대상" }, { label: "신고한 사람" }, { label: "예약" }, { label: "유형" }, { label: "누적" }, { label: "상태" }]}>
            {visible.length === 0 && <EmptyRow cols={7}>{filter === "open" ? "처리할 신고가 없어요." : "신고가 없어요."}</EmptyRow>}
            {visible.map((r) => (
              <Tr key={r.id} selected={r.id === selected} onClick={() => setSelected(r.id)}>
                <Td className="font-semibold">
                  <button type="button" className="text-left font-semibold" aria-pressed={r.id === selected} onClick={(e) => { e.stopPropagation(); setSelected(r.id); }}>{dateTimeKo(r.created_at)}</button>
                </Td>
                <Td>버디 {r.buddy_name}</Td>
                <Td>{r.reporter}</Td>
                <Td className="text-muted">{r.booking_code ?? "—"}</Td>
                <Td>{CATEGORY_SHORT[r.category] ?? r.category}</Td>
                <Td>{running[r.id] ?? r.count_for_buddy}건</Td>
                <Td><ReportStatusPill r={r} /></Td>
              </Tr>
            ))}
          </Table>
        )}
      </SplitLayout>
    </>
  );
}

function ReportPanel({ r, buddy, bookings, onDone }: { r: Row; buddy?: AdminBuddyRow; bookings: AdminBookingRow[]; onDone: (r: Row) => void }) {
  const [busy, setBusy] = useState<ReportAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: ReportAction) {
    const ask: Partial<Record<ReportAction, string>> = {
      suspend: `${r.buddy_name} 버디 활동을 정지할까요? 새 요청을 받지 않아요.`,
      unsuspend: `${r.buddy_name} 버디 정지를 풀까요? 다시 요청을 받을 수 있어요.`,
      dismiss: "이 신고를 기각할까요? 누적 신고 수에서 빠져요.",
    };
    if (ask[action] && !window.confirm(ask[action])) return;
    setBusy(action); setError(null);
    try { onDone(await patch<Row>(`/admin/reports/${r.id}`, { action })); }
    catch (e) { setError(errMsg(e)); }
    finally { setBusy(null); }
  }

  // 신고된 동행 · 이 버디의 남은 예약 (신고 접수 시점 이후 일정)
  const item = bookings.find((b) => (r.booking_item_id != null ? b.item_id === r.booking_item_id : b.code === r.booking_code && b.title.startsWith(r.buddy_name)));
  const reportDay = r.created_at.slice(0, 10);
  const remaining = bookings.filter((b) => {
    if (!b.title.startsWith(r.buddy_name) || !["requested", "approved", "confirmed"].includes(b.status)) return false;
    const m = b.schedule.match(/^(\d{1,2})\/(\d{1,2})/);
    if (!m) return false;
    const iso = `${reportDay.slice(0, 4)}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
    return iso > reportDay;
  }).length;

  const suspended = r.buddy_status === "suspended";
  const who = buddy ? `${r.buddy_name} · ${univShort(r.buddy_university || buddy.university)} ${buddy.major}${buddy.year ? ` ${buddy.year}학년` : ""}` : `${r.buddy_name} · ${univShort(r.buddy_university)}`;
  const meta = [r.photo_url && "사진 1장 첨부", item && `${scheduleKo(item.schedule)} 동행`].filter(Boolean).join(" · ");

  return (
    <div>
      <SectionLabel className="mb-4">신고 내용</SectionLabel>
      <div className="rounded-[14px] border border-[#CDD3DA] px-5 py-4">
        <p className="text-[15px] font-semibold leading-relaxed text-ink">“{r.text}”</p>
        {meta && <p className="mt-2 text-[13px] text-muted">{meta}</p>}
      </div>

      <KeyValues className="mt-2" rows={[
        { label: "버디", value: who },
        { label: "지금 상태", value: suspended ? "요청 받기 멈춤" : buddy?.status === "pending" ? "승인 전" : "활동 중", tone: suspended ? "red" : undefined },
        { label: "누적 신고", value: `${r.count_for_buddy}건 (기각 제외)` },
        { label: "남은 예약", value: remaining ? `${remaining}건 → 다른 버디로 안내` : "없음" },
      ]} />

      {r.auto_suspended && r.status === "open" && suspended && (
        <Note tone="orange" className="mt-3">신고가 {REPORT_SUSPEND_AT}건 쌓여 자동으로 정지됐어요. 내용을 확인하고 정지를 풀거나 활동 정지로 확정해 주세요.</Note>
      )}
      {error && <ErrorText className="mt-3">{error}</ErrorText>}

      {r.status === "open" ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {suspended
              ? <Button variant="ghost" className={smallBtn} disabled={!!busy} onClick={() => act("unsuspend")}>정지 풀기</Button>
              : <Button variant="ghost" className={smallBtn} disabled={!!busy} onClick={() => act("warn")}>경고</Button>}
            <Button variant="danger" className={smallBtn} disabled={!!busy} onClick={() => act("suspend")}>활동 정지</Button>
          </div>
          <div className="mt-3 flex items-center justify-center gap-4 text-[13px]">
            {suspended && <button type="button" className="font-semibold text-muted hover:text-ink hover:underline disabled:opacity-40" disabled={!!busy} onClick={() => act("warn")}>경고만 하기</button>}
            <button type="button" className="font-semibold text-muted hover:text-ink hover:underline disabled:opacity-40" disabled={!!busy} onClick={() => act("dismiss")}>신고 기각</button>
          </div>
        </>
      ) : (
        <div className="mt-4 flex items-center justify-between gap-3">
          <Note>{r.status === "dismissed" ? "기각한 신고예요." : `${ACTION_DONE[r.action ?? ""] ?? "처리 완료"}${r.resolved_at ? ` · ${dateTimeKo(r.resolved_at)}` : ""}`}</Note>
          {suspended && <Button variant="ghost" full={false} className={smallBtn} disabled={!!busy} onClick={() => act("unsuspend")}>정지 풀기</Button>}
        </div>
      )}
    </div>
  );
}
