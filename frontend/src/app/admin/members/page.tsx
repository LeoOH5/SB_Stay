"use client";
// A03 회원과 버디 — 지원 5단계를 마친 버디 승인(학교 메일·약속·퀴즈), 활동 중 버디의 동행·평점·신고·정지
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ApiError, get, patch } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { CAN_HELP, QUIZ_PASS, QUIZ_TOTAL, REPORT_SUSPEND_AT, labels } from "@/lib/codes";
import type { AdminBuddyRow, ListResponse } from "@/lib/types";
import { Button, Spinner, StatusPill } from "@/components/ui";
import { AdminGate, AdminHeader, EmptyRow, ErrorText, Note, SectionLabel, Table, Td, Tr, errMsg, langNames, linkCls, smallBtn, univShort } from "@/components/admin/shell";

/** 버디 약속(행동 규칙) 항목 수 — 동의하면 6/6 */
const CODE_ITEMS = 6;
type Action = "approve" | "reject" | "suspend" | "unsuspend";

export default function AdminMembersPage() {
  const { user } = useUser();
  const isOperator = user?.role === "operator";
  const myUniv = user?.role === "univ_admin" ? user.university_id : null;
  const [buddies, setBuddies] = useState<AdminBuddyRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notReady, setNotReady] = useState<{ id: number; message: string } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    const r = await get<ListResponse<AdminBuddyRow>>("/admin/buddies");
    setBuddies(r.items.filter((b) => !myUniv || !b.university_id || b.university_id === myUniv));
  }, [myUniv]);

  useEffect(() => {
    let alive = true;
    (async () => { try { await load(); } catch (e) { if (alive) setError(errMsg(e)); } })();
    return () => { alive = false; };
  }, [load]);

  async function act(row: AdminBuddyRow, action: Action) {
    if (action === "suspend" && !window.confirm(`${row.name} 버디의 활동을 정지할까요?\n새 요청을 받지 않고 목록에서 빠져요.`)) return;
    if (action === "reject" && !window.confirm(`${row.name} 버디 지원을 반려할까요?`)) return;
    setBusy(row.id); setError(null); setNotReady(null);
    try { await patch(`/admin/buddies/${row.id}`, { action }); await load(); }
    catch (e) {
      if (e instanceof ApiError && e.code === "NOT_READY") setNotReady({ id: row.id, message: e.message });
      else setError(errMsg(e));
    }
    finally { setBusy(null); }
  }

  const pending = (buddies ?? []).filter((b) => b.status === "pending");
  const active = (buddies ?? []).filter((b) => b.status !== "pending");

  return (
    <AdminGate>
      <AdminHeader title="회원과 버디" sub="지원 5단계를 마친 버디를 승인하고, 신고가 쌓인 버디를 관리해요." />
      {error && <ErrorText>{error}</ErrorText>}

      <SectionLabel>승인을 기다리는 버디 {buddies ? `${pending.length}명` : ""}</SectionLabel>
      {!buddies ? <Spinner /> : (
        <Table cols={[{ label: "이름" }, { label: "학교·학과" }, { label: "나이" }, { label: "언어" }, { label: "도와줄 수 있어요" }, { label: "학교 메일" }, { label: "약속" }, { label: "퀴즈" }, { label: "", className: "w-[170px]" }]}>
          {pending.length === 0 && <EmptyRow cols={9}>승인을 기다리는 버디가 없어요.</EmptyRow>}
          {pending.map((b) => {
            const quizOk = (b.quiz_score ?? 0) >= QUIZ_PASS;
            return (
              <Tr key={b.id} className="h-[75px]">
                <Td className="font-semibold">{b.name}</Td>
                <Td>{univShort(b.university)} {b.major} {b.year ? `${b.year}학년` : ""}</Td>
                <Td>{b.age != null ? `만 ${b.age}세` : <span className="text-muted">모름</span>}</Td>
                <Td>{langNames(b.languages)}</Td>
                <Td className="max-w-[200px] truncate" title={labels(CAN_HELP, b.can_help).join(", ")}>{labels(CAN_HELP, b.can_help).join(", ") || <span className="text-muted">—</span>}</Td>
                <Td>{b.school_email_verified ? <StatusPill status="approved" label="인증" /> : <StatusPill status="x" tone="red" label="미인증" />}</Td>
                <Td>{b.code_agreed ? <StatusPill status="approved" label={`${CODE_ITEMS}/${CODE_ITEMS}`} /> : <StatusPill status="x" tone="red" label={`0/${CODE_ITEMS}`} />}</Td>
                <Td>
                  {b.quiz_score == null
                    ? <StatusPill status="x" tone="gray" label="응시 전" />
                    : <StatusPill status="x" tone={quizOk ? "navy" : "red"} label={`${b.quiz_score}/${QUIZ_TOTAL}${quizOk ? "" : " 재응시"}`} />}
                </Td>
                <Td className="pr-4">
                  <div className="flex items-center justify-end gap-2">
                    {quizOk ? (
                      <>
                        <Button variant="ghost" full={false} className={smallBtn} disabled={busy === b.id} onClick={() => act(b, "reject")}>반려</Button>
                        <Button variant="primary" full={false} className={smallBtn} disabled={busy === b.id} onClick={() => act(b, "approve")}>승인</Button>
                      </>
                    ) : (
                      <button type="button" disabled title={`퀴즈 ${QUIZ_PASS}점 이상이어야 승인할 수 있어요`} className="inline-flex h-[42px] cursor-not-allowed items-center rounded-[12px] border border-[#CDD3DA] bg-white px-4 text-[15px] font-semibold text-muted">퀴즈 통과 후 승인</button>
                    )}
                  </div>
                  {notReady?.id === b.id && <div role="alert" className="mt-1 whitespace-normal text-right text-[12px] font-semibold text-red">{notReady.message}</div>}
                </Td>
              </Tr>
            );
          })}
        </Table>
      )}

      <SectionLabel className="mt-10">활동 중인 버디</SectionLabel>
      {!buddies ? <Spinner /> : (
        <Table cols={[{ label: "이름" }, { label: "학과" }, { label: "동행" }, { label: "평점" }, { label: "신고" }, { label: "상태" }, { label: "", className: "w-[160px]" }]}>
          {active.length === 0 && <EmptyRow cols={7}>활동 중인 버디가 없어요.</EmptyRow>}
          {active.map((b) => {
            const suspended = b.status === "suspended";
            const auto = suspended && b.report_count >= REPORT_SUSPEND_AT;
            return (
              <Tr key={b.id}>
                <Td className="font-semibold">{b.name}</Td>
                <Td title={b.university}>{b.major} {b.year ? `${b.year}학년` : ""}</Td>
                <Td>{b.walk_count ?? 0}회</Td>
                <Td>{b.rating ? b.rating.toFixed(1) : <span className="text-muted">—</span>}</Td>
                <Td className={b.report_count > 0 ? "font-semibold" : undefined}>{b.report_count}</Td>
                <Td>
                  {!suspended ? <StatusPill status="approved" label="활동 중" />
                    : <StatusPill status="suspended" label={auto ? "자동 정지 · 확인 필요" : "정지"} />}
                </Td>
                <Td className="pr-4">
                  {!suspended && <button type="button" className="text-[14px] font-semibold text-red hover:underline disabled:opacity-40" disabled={busy === b.id} onClick={() => act(b, "suspend")}>정지</button>}
                  {suspended && auto && isOperator && <Link href="/admin/reports" className={linkCls}>신고 보기</Link>}
                  {suspended && (!auto || !isOperator) && <button type="button" className={linkCls} disabled={busy === b.id} onClick={() => act(b, "unsuspend")}>정지 풀기</button>}
                </Td>
              </Tr>
            );
          })}
        </Table>
      )}

      <Note className="mt-9">
        승인하려면 학교 메일 인증, 만 19세 이상, 약속 동의, 퀴즈 {QUIZ_PASS}점 이상이 모두 필요해요. 신고가 {REPORT_SUSPEND_AT}건 쌓이면 활동이 자동으로 멈춰요.
        {!isOperator && " 대학 담당자는 우리 학교 버디만 볼 수 있어요."}
      </Note>
    </AdminGate>
  );
}
