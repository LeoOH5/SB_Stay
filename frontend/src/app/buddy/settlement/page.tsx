"use client";
// B13 버디 정산 — GET /buddy/settlement?month= → {pay_date, account, walks, gross, fee, net, meals_approved, meals_pending, payout, items}
// 동행 시간은 GET /buddy/schedule 의 duration_min, 계좌 바꾸기는 PUT /buddy/profile {bank_account}
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { BottomSheet } from "@/components/tourist";
import { DEMO_TODAY, krDate, prevMonth } from "@/components/buddy/format";
import { LoginGate } from "@/components/buddy/login-gate";
import { useToast } from "@/components/buddy/toast";
import { MonthSelect } from "@/components/buddy/ui";
import { Button, Hero, Spinner, StatusPill, cn, inputCls } from "@/components/ui";
import { get, put, won } from "@/lib/api";
import { useUser } from "@/lib/auth";
import type { BuddyProfile, BuddyRequest, BuddySettlement, ListResponse } from "@/lib/types";

const MONTHS = ["2026-11", "2026-12", "2027-01", "2027-02"];
const hours = (min?: number) => { const m = min ?? 120; return m % 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m / 60}시간`; };

function Line({ label, value, tone }: { label: string; value: string; tone?: "red" | "navy" }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 text-[15px]">
      <span className="text-muted">{label}</span>
      <span className={cn("font-bold", tone === "red" ? "text-red" : tone === "navy" ? "text-navy" : "text-ink")}>{value}</span>
    </div>
  );
}

function SettlementPage() {
  const sp = useSearchParams();
  const { user } = useUser();
  const { show, toast } = useToast();
  const [month, setMonth] = useState(sp.get("month") ?? DEMO_TODAY.slice(0, 7));
  const [byMonth, setByMonth] = useState<Record<string, BuddySettlement | "error">>({});
  const [durations, setDurations] = useState<Record<number, number>>({});
  const [profile, setProfile] = useState<BuddyProfile | null>(null);
  const [acctOpen, setAcctOpen] = useState(false);
  const [acct, setAcct] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    get<BuddySettlement>("/buddy/settlement", { month }).then((r) => { if (alive) setByMonth((m) => ({ ...m, [month]: r })); }).catch(() => { if (alive) setByMonth((m) => ({ ...m, [month]: "error" })); });
    return () => { alive = false; };
  }, [month]);
  useEffect(() => {
    get<ListResponse<BuddyRequest>>("/buddy/schedule").then((r) => setDurations(Object.fromEntries(r.items.map((i) => [i.item_id, i.duration_min])))).catch(() => { /* 기본 2시간 */ });
    get<BuddyProfile>("/buddy/profile").then(setProfile).catch(() => setProfile(null));
  }, []);

  const saveAccount = async () => {
    if (!acct.trim()) return;
    setSaving(true);
    try {
      await put<BuddyProfile>("/buddy/profile", { bank_account: acct.trim() });
      const r = await get<BuddySettlement>("/buddy/settlement", { month });
      setByMonth((m) => ({ ...m, [month]: r })); setAcctOpen(false); setAcct(""); show("정산 계좌를 바꿨어요");
    } catch (e) { show(e instanceof Error ? e.message : "저장하지 못했어요"); }
    finally { setSaving(false); }
  };

  const cur = byMonth[month];
  const st = cur && cur !== "error" ? cur : null;
  const err = cur === "error";
  const perWalk = st && st.items.length && st.items.every((i) => i.gross === st.items[0].gross) ? st.items[0].gross : null;
  const pendingClaims = st?.items.filter((i) => i.meal_pending > 0) ?? [];
  const approvedClaims = st?.items.filter((i) => i.meal_approved > 0).length ?? 0;
  const holder = user?.name ?? profile?.name ?? "";
  const options = MONTHS.includes(month) ? MONTHS : [...MONTHS, month].sort();

  return (
    <div className="pb-8">
      <Hero back="/buddy/activity" backLabel="내 활동" right={<MonthSelect value={month} options={options} onChange={setMonth} />}
        title="정산" sub="매달 말일까지 확정된 동행과 승인된 식비를 모아 다음 달 말에 보내요." />
      <LoginGate />

      <div className="px-5">
        {err && <p className="py-8 text-center text-[15px] text-muted">정산 내역을 불러오지 못했어요.</p>}
        {!st && !err && <Spinner />}
        {st && (
          <>
            <div className="rounded-[20px] bg-navy-bg px-5 py-5">
              <div className="text-[15px] text-ink">{krDate(st.pay_date)}에 받을 돈</div>
              <div className="mt-2 text-[34px] font-bold leading-tight tracking-[-0.01em] text-ink">{won(st.payout)}</div>
              <div className="mt-2 text-[15px] text-ink">{st.account ? `${st.account}${holder ? ` · ${holder}` : ""}` : "정산 계좌를 등록해 주세요"}</div>
              {pendingClaims.length > 0 && <p className="mt-2.5 text-[13px] text-muted">식비 {pendingClaims.length}건({won(st.meals_pending)})은 운영팀 확인이 끝나면 더해져요</p>}
            </div>

            <h2 className="mt-9 text-[18px] font-bold text-ink">어떻게 계산했나요</h2>
            <div className="mt-1 divide-y divide-line">
              <Line label={perWalk ? `동행 ${st.walks}회 × ${won(perWalk)}` : `동행 ${st.walks}회`} value={won(st.gross)} />
              <Line label="플랫폼 수수료 10%" value={st.fee ? `−${won(st.fee)}` : won(0)} tone="red" />
              <Line label={`식비 환급 (승인 ${approvedClaims}건)`} value={`+${won(st.meals_approved)}`} />
              <Line label="받을 돈" value={won(st.payout)} tone="navy" />
            </div>

            <h2 className="mt-9 text-[18px] font-bold text-ink">동행별</h2>
            {st.items.length === 0 ? <p className="py-4 text-[15px] text-muted">이 달에 확정된 동행이 없어요.</p> : (
              <div className="mt-1 divide-y divide-line">
                {st.items.map((i) => {
                  const meal = i.meal_approved || i.meal_pending;
                  return (
                    <div key={i.item_id} className="py-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[16px] font-bold text-ink">{i.tourist}</span>
                        <span className="text-[16px] font-bold text-ink">{won(i.net + i.meal_approved)}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-3">
                        <span className="text-[14px] text-muted">{krDate(i.date)} · 동행 {hours(durations[i.item_id])}{meal ? ` + 식비 ${won(meal)}` : ""}</span>
                        <StatusPill status={i.status} label={i.status === "meal_pending" ? "식비 확인 중" : "확정"} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="mt-2 text-[13px] leading-relaxed text-muted">취소된 동행은 여행자 환불 규정에 따라 빠져요. 금액은 수수료를 뺀 값이에요.</p>

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <Button variant="ghost" className="min-h-[48px]! border-[#C9CED3]" onClick={() => setAcctOpen(true)}>계좌 바꾸기</Button>
              <Button variant="ghost" className="min-h-[48px]! border-[#C9CED3]" onClick={() => setMonth(prevMonth(month))}>지난 정산</Button>
            </div>
          </>
        )}
      </div>

      <BottomSheet open={acctOpen} onClose={() => setAcctOpen(false)} title="정산 계좌 바꾸기">
        <p className="mb-3 text-[14px] text-muted">지금: {st?.account ?? "없음"}. 본인 이름의 계좌만 쓸 수 있어요.</p>
        <input className={inputCls} placeholder="은행 계좌번호 (예: 신한 110-123-456789)" value={acct} onChange={(e) => setAcct(e.target.value)} aria-label="정산 계좌" />
        <Button className="mt-4" onClick={saveAccount} disabled={saving || !acct.trim()}>{saving ? "저장하는 중…" : "저장"}</Button>
      </BottomSheet>
      {toast}
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<Spinner />}><SettlementPage /></Suspense>;
}
