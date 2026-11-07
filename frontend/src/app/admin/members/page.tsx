"use client";
// A03 회원과 버디 — 지원 6단계를 마친 버디 승인(자격 경로·국적·약속·교육 영상·퀴즈), 활동 중 버디의 지난달 동행·누적 후기·평점·등급·정산율·신고·정지
// v3.7 자격 경로: 대학 메일 / 성북구 거주(주소 증빙·재학 증명 사진 두 장 — 운영자가 보고 승인하면 확인)
// 등급 다시 계산(운영자): POST /admin/buddies/recompute-grades → 이번 달 1일 평가(지난달 동행)를 아직 안 한 버디만, 바뀐 버디 행
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ApiError, get, patch, post } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { BUDDY_PROMISES, CAN_HELP, ELIGIBILITY, GRADE, QUIZ_PASS, QUIZ_TOTAL, REPORT_SUSPEND_AT, label, labels, pct } from "@/lib/codes";
import { mediaSrc } from "@/lib/uploads";
import type { AdminBuddyRow, ListResponse } from "@/lib/types";
import { Button, Icon, Spinner, StatusPill } from "@/components/ui";
import { OperatorOnly, AdminHeader, EmptyRow, ErrorText, Note, SectionLabel, Table, Td, Tr, errMsg, langNames, linkCls, smallBtn, univShort, Pager, usePaged } from "@/components/admin/shell";

/** 버디 약속(행동 규칙) 항목 수 — 동의하면 7/7 */
const CODE_ITEMS = BUDDY_PROMISES.length;
const ym = (m?: string | null) => (m ? `${Number(m.slice(5, 7))}월` : "지난달");

/** 거주 경로 서류 한 장: 올린 사진(/media)은 눌러서 크게, 예전 데모 값은 자리 표시 */
function ProofThumb({ value, title }: { value: string | null; title: string }) {
  const src = mediaSrc(value);
  const box = "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[8px]";
  if (!value) return <span title={`${title} 없음`} className={`${box} border border-dashed border-red/60 text-[10px] font-semibold text-red`}>없음</span>;
  if (!src) return <span title={`${title} (데모 자리 표시)`} className={`${box} bg-[#3B4652] text-white/80`}><Icon name="image" className="h-4 w-4" strokeWidth={1.8} /></span>;
  return (
    <a href={src} target="_blank" rel="noreferrer" title={`${title} 크게 보기`} className={`${box} bg-[#3B4652]`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={title} className="h-full w-full object-cover" />
    </a>
  );
}

/** 자격 경로 칸: 대학 메일(인증 여부) 또는 성북구 거주(서류 두 장) */
function EligibilityCell({ b }: { b: AdminBuddyRow }) {
  if (b.eligibility === "residence") {
    return (
      <div className="flex items-center gap-2">
        <ProofThumb value={b.residence_proof_url} title="주소 증빙" />
        <ProofThumb value={b.enrollment_proof_url} title="재학 증명" />
        <span className="leading-tight"><span className="block font-semibold">{label(ELIGIBILITY, "residence")}</span><span className="text-[12px] text-muted">주소 · 재학 증명</span></span>
      </div>
    );
  }
  return b.school_email_verified ? <StatusPill status="approved" label={`${label(ELIGIBILITY, "school_email")} 인증`} /> : <StatusPill status="x" tone="red" label="자격 확인 전" />;
}
type Action = "approve" | "reject" | "suspend" | "unsuspend";

export default function AdminMembersPage() {
  const { user } = useUser();
  const isOperator = user?.role === "operator";
  const myUniv = user?.role === "univ_admin" ? user.university_id : null;
  const [buddies, setBuddies] = useState<AdminBuddyRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notReady, setNotReady] = useState<{ id: number; message: string } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [recompute, setRecompute] = useState<{ busy: boolean; msg?: string }>({ busy: false });

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

  async function recomputeGrades() {
    setRecompute({ busy: true }); setError(null);
    try {
      const r = await post<ListResponse<AdminBuddyRow>>("/admin/buddies/recompute-grades");
      await load();
      setRecompute({ busy: false, msg: r.items.length ? `${r.items.map((b) => `${b.name} ${label(GRADE, b.grade)}`).join(", ")}(으)로 바뀌었어요` : "바뀐 버디가 없어요" });
    } catch (e) { setRecompute({ busy: false }); setError(errMsg(e)); }
  }

  const pending = (buddies ?? []).filter((b) => b.status === "pending");
  const pgPending = usePaged(pending);
  const active = (buddies ?? []).filter((b) => b.status !== "pending");
  const pgActive = usePaged(active);

  return (
    <OperatorOnly title="회원·버디 승인">
      <AdminHeader title="회원과 버디" sub="지원 6단계를 마친 버디를 승인하고, 등급·신고를 관리해요. 등급은 매달 1일 지난달 동행으로 정해요." />
      {error && <ErrorText>{error}</ErrorText>}

      <SectionLabel>승인을 기다리는 버디 {buddies ? `${pending.length}명` : ""}</SectionLabel>
      {!buddies ? <Spinner /> : (
        <><Table cols={[{ label: "이름" }, { label: "학교·학과" }, { label: "나이" }, { label: "언어" }, { label: "자격 경로" }, { label: "국적 확인" }, { label: "약속" }, { label: "교육 영상" }, { label: "퀴즈" }, { label: "", className: "w-[170px]" }]}>
          {pending.length === 0 && <EmptyRow cols={10}>승인을 기다리는 버디가 없어요.</EmptyRow>}
          {pgPending.items.map((b) => {
            const quizOk = (b.quiz_score ?? 0) >= QUIZ_PASS;
            const videosOk = b.videos_watched >= b.videos_total;
            const ready = quizOk && videosOk;
            return (
              <Tr key={b.id} className="h-[75px]">
                <Td className="font-semibold" title={labels(CAN_HELP, b.can_help).join(", ")}>{b.name}</Td>
                <Td>{univShort(b.university)} {b.major} {b.year ? `${b.year}학년` : ""}</Td>
                <Td>{b.age != null ? `만 ${b.age}세` : <span className="text-muted">모름</span>}</Td>
                <Td>{langNames(b.languages)}</Td>
                <Td><EligibilityCell b={b} /></Td>
                <Td title="외국인 유학생은 시간제 취업 허가 문제로 지원할 수 없어요">{b.korean_national ? <StatusPill status="approved" label="대한민국" /> : <StatusPill status="x" tone="red" label="확인 전" />}</Td>
                <Td>{b.code_agreed ? <StatusPill status="approved" label={`${CODE_ITEMS}/${CODE_ITEMS}`} /> : <StatusPill status="x" tone="red" label={`0/${CODE_ITEMS}`} />}</Td>
                <Td>{videosOk ? <StatusPill status="approved" label={`${b.videos_watched}/${b.videos_total}`} /> : <StatusPill status="x" tone="red" label={`${b.videos_watched}/${b.videos_total}`} />}</Td>
                <Td>
                  {b.quiz_score == null
                    ? <StatusPill status="x" tone="gray" label="응시 전" />
                    : <StatusPill status="x" tone={quizOk ? "navy" : "red"} label={`${b.quiz_score}/${QUIZ_TOTAL}${quizOk ? "" : " 재응시"}`} />}
                </Td>
                <Td className="pr-4">
                  <div className="flex items-center justify-end gap-2">
                    {ready ? (
                      <>
                        <Button variant="ghost" full={false} className={smallBtn} disabled={busy === b.id} onClick={() => act(b, "reject")}>반려</Button>
                        <Button variant="primary" full={false} className={smallBtn} disabled={busy === b.id} onClick={() => act(b, "approve")}>{b.eligibility === "residence" ? "서류 확인 · 승인" : "승인"}</Button>
                      </>
                    ) : (
                      <button type="button" disabled title={`교육 영상을 다 보고 퀴즈 ${QUIZ_PASS}점 이상이어야 승인할 수 있어요`} className="inline-flex h-[42px] cursor-not-allowed items-center rounded-[12px] border border-[#CDD3DA] bg-white px-4 text-[15px] font-semibold text-muted">{videosOk ? "퀴즈 통과 후 승인" : "교육 영상 뒤 승인"}</button>
                    )}
                  </div>
                  {notReady?.id === b.id && <div role="alert" className="mt-1 whitespace-normal text-right text-[12px] font-semibold text-red">{notReady.message}</div>}
                </Td>
              </Tr>
            );
          })}
        </Table>
        <Pager {...pgPending} /></>
      )}

      <SectionLabel className="mt-10" right={isOperator && (
        <span className="inline-flex items-center gap-3">
          {recompute.msg && <span role="status">{recompute.msg}</span>}
          <Button variant="ghost" full={false} className={smallBtn} disabled={recompute.busy} onClick={recomputeGrades}>{recompute.busy ? "계산 중…" : "등급 다시 계산"}</Button>
        </span>
      )}>활동 중인 버디</SectionLabel>
      {!buddies ? <Spinner /> : (
        <><Table cols={[{ label: "이름" }, { label: "학과" }, { label: "자격 경로" }, { label: `${ym(active[0]?.eval_month)} 동행` }, { label: "누적 후기" }, { label: "평점" }, { label: "등급" }, { label: "정산율" }, { label: "운전" }, { label: "신고" }, { label: "상태" }, { label: "", className: "w-[140px]" }]}>
          {active.length === 0 && <EmptyRow cols={12}>활동 중인 버디가 없어요.</EmptyRow>}
          {pgActive.items.map((b) => {
            const suspended = b.status === "suspended";
            const auto = suspended && b.report_count >= REPORT_SUSPEND_AT;
            return (
              <Tr key={b.id}>
                <Td className="font-semibold">{b.name}</Td>
                <Td title={b.university}>{b.major} {b.year ? `${b.year}학년` : ""}</Td>
                <Td className="text-muted">{b.eligibility ? label(ELIGIBILITY, b.eligibility) : "—"}</Td>
                <Td title="지난달 완료 동행 (누적 아님) — 이 수로 매달 1일 등급을 정해요">{b.last_month_walks}회</Td>
                <Td>{b.total_reviews}건</Td>
                <Td>{b.avg_rating != null ? b.avg_rating.toFixed(1) : <span className="text-muted">—</span>}</Td>
                <Td className={b.grade !== "basic" ? "font-semibold" : undefined} title={b.evaluated_for ? `${ym(b.evaluated_for)} 동행으로 정함` : undefined}>{label(GRADE, b.grade)}</Td>
                <Td>{pct(b.payout_rate)}</Td>
                <Td title="표시만 · 차량 동행 없음">{b.can_drive ? "가능" : <span className="text-muted">—</span>}</Td>
                <Td className={b.report_count > 0 ? "font-semibold" : undefined}>{b.report_count}</Td>
                <Td>
                  {!suspended ? (b.needs_recheck ? <StatusPill status="pending" label="휴면 · 활동 확인 전" /> : <StatusPill status="approved" label="활동 중" />)
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
        <Pager {...pgActive} /></>
      )}

      <Note className="mt-9">
        승인하려면 자격 경로 하나(성북구 대학 메일 인증, 또는 성북구 거주 — 주소 증빙과 재학 증명 사진을 보고 승인하면 확인한 것으로 남아요), 대한민국 국적, 만 19세 이상, 약속 동의, 교육 영상 5개, 퀴즈 {QUIZ_PASS}점 이상이 모두 필요해요. 신고가 {REPORT_SUSPEND_AT}건 쌓이면 활동이 자동으로 멈춰요.
        등급은 매달 1일, 지난달 동행(누적 아님)과 누적 후기·평점으로 다시 정해요(기본 70% · 성장 75% · 우수 80%). 올라갈 때는 한 단계씩, 내려갈 때는 바로 가요. 승인 후 첫 달은 기본이고, 정산율은 예약 확정 때 고정돼요. 운영 기간 중 30일간 활동이 없으면 휴면으로 목록에서 빠져요(등급은 그대로 매달 평가).
        {!isOperator && " 대학 담당자는 우리 학교 버디만 볼 수 있어요."}
      </Note>
    </OperatorOnly>
  );
}
