"use client";
// B05 내 활동 — GET /buddy/grade (등급·정산율·실적, 휴면이면 POST /buddy/confirm-active),
// GET /buddy/settlement?month= (동행 수·정산율 적용 활동비·식비·받을 돈), GET /buddy/meal-claims,
// BD-05 GET /buddy/profile, GET /buddy/apply (학교 인증·교육 퀴즈)
import Link from "next/link";
import { useEffect, useState } from "react";
import { DEMO_TODAY, krDate } from "@/components/buddy/format";
import { LoginGate } from "@/components/buddy/login-gate";
import { Avatar, MonthSelect } from "@/components/buddy/ui";
import { Banner, Button, GoalBar, Hero, Icon, LinkButton, Spinner, StatusPill } from "@/components/ui";
import { GRADE, label, pct } from "@/lib/codes";
import { get, post, won } from "@/lib/api";
import { useUser } from "@/lib/auth";
import type { BuddyApplyStatus, BuddyGradeInfo, BuddyProfile, BuddySettlement, ListResponse, MealClaim } from "@/lib/types";

const MONTHS = ["2026-12", "2027-01", "2027-02"];
const CLAIM_LABEL: Record<string, string> = { approved: "승인", requested: "확인 중", rejected: "반려" };

export default function Page() {
  const { user } = useUser();
  const [month, setMonth] = useState(DEMO_TODAY.slice(0, 7));
  const [stByMonth, setStByMonth] = useState<Record<string, BuddySettlement>>({});
  const [claims, setClaims] = useState<MealClaim[] | null>(null);
  const [profile, setProfile] = useState<BuddyProfile | null>(null);
  const [apply, setApply] = useState<BuddyApplyStatus | null>(null);
  const [grade, setGrade] = useState<BuddyGradeInfo | null>(null);

  useEffect(() => {
    let alive = true;
    get<BuddySettlement>("/buddy/settlement", { month }).then((r) => { if (alive) setStByMonth((m) => ({ ...m, [month]: r })); }).catch(() => { /* 불러오는 중으로 남김 */ });
    return () => { alive = false; };
  }, [month]);
  useEffect(() => {
    get<ListResponse<MealClaim>>("/buddy/meal-claims").then((r) => setClaims(r.items)).catch(() => setClaims([]));
    get<BuddyProfile>("/buddy/profile").then(setProfile).catch(() => setProfile(null));
    get<BuddyApplyStatus>("/buddy/apply").then(setApply).catch(() => setApply(null));
    get<BuddyGradeInfo>("/buddy/grade").then(setGrade).catch(() => setGrade(null));
  }, []);

  const st = stByMonth[month] ?? null;
  const monthClaims = claims?.filter((c) => c.date.startsWith(month)) ?? null;
  const name = user?.name ?? profile?.name ?? "";

  return (
    <div className="pb-8">
      <Hero title="내 활동" right={<MonthSelect value={month} options={MONTHS} onChange={setMonth} />} />
      <LoginGate />

      <div className="px-5">
        {/* 이번 달 받을 돈 — 가장 먼저 궁금한 것 하나만 크게 */}
        {!st ? <Spinner /> : (
          <section className="rounded-[18px] bg-navy px-5 pb-5 pt-4 text-white">
            <div className="text-[14px] text-white/70">{Number(month.slice(5, 7))}월에 받을 돈</div>
            <div className="mt-1 text-[32px] font-bold leading-tight">{won(st.payout)}</div>
            <div className="mt-0.5 text-[13px] text-white/70">{krDate(st.pay_date)} 입금 예정</div>
            <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-white/15 pt-3.5 text-center">
              <div><dt className="text-[12px] text-white/60">동행</dt><dd className="mt-0.5 text-[15px] font-bold">{st.walks}회</dd></div>
              <div><dt className="text-[12px] text-white/60">활동비</dt><dd className="mt-0.5 text-[15px] font-bold">{won(st.net)}</dd></div>
              <div><dt className="text-[12px] text-white/60">식비 환급</dt><dd className="mt-0.5 text-[15px] font-bold">{won(st.meals_approved)}</dd></div>
            </dl>
            {st.meals_pending ? <p className="mt-2.5 text-center text-[12px] text-white/60">식비 {won(st.meals_pending)}은 확인 중이에요</p> : null}
          </section>
        )}
        {st && <LinkButton href={`/buddy/settlement?month=${month}`} variant="secondary" className="mt-3 min-h-[46px] text-[15px]">정산 내역 자세히</LinkButton>}

        {grade && <GradeCard g={grade} onActive={setGrade} />}

        <h2 className="mt-9 text-[18px] font-bold text-ink">식비 청구</h2>
        {monthClaims === null ? <Spinner /> : monthClaims.length === 0 ? (
          <p className="py-3 text-[15px] text-muted">이 달에 올린 식비 청구가 없어요.</p>
        ) : (
          <div className="mt-1 divide-y divide-line">
            {[...monthClaims].sort((a, b) => a.date.localeCompare(b.date)).map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 py-3.5">
                <div className="min-w-0">
                  <div className="text-[16px] font-semibold text-ink">{c.place} · {won(c.amount)}</div>
                  <div className="mt-0.5 text-[14px] text-muted">{krDate(c.date)} · {c.tourist.split(" ")[0]}{c.status === "rejected" && c.reason ? ` · ${c.reason}` : ""}</div>
                </div>
                <StatusPill status={c.status} label={CLAIM_LABEL[c.status]} />
              </div>
            ))}
          </div>
        )}

        {/* 내 프로필 — 자세한 건 프로필 화면에서 */}
        {profile && (
          <Link href="/buddy/me" className="mt-8 flex items-center gap-3.5 rounded-[16px] border border-line px-4 py-3.5 transition hover:border-navy">
            <Avatar name={name || profile.name} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[16px] font-bold text-ink">
                {name || profile.name}
                {profile.review_count > 0 && <span className="text-[14px] font-semibold text-[#C98A1B]">★ {profile.rating.toFixed(1)}</span>}
              </div>
              <div className="mt-0.5 truncate text-[13.5px] text-muted">{[profile.verified?.school_email || apply?.email_verified ? "학교 인증" : "학교 인증 전", apply?.quiz_score != null ? `교육 ${apply.quiz_score}/10` : profile.verified?.trained ? "교육 이수" : null, `동행 ${profile.walk_count}회`].filter(Boolean).join(" · ")}</div>
            </div>
            <span className="text-[14px] font-semibold text-navy">내 프로필</span>
          </Link>
        )}
      </div>
    </div>
  );
}

const ym = (m: string) => `${Number(m.slice(0, 4))}년 ${Number(m.slice(5, 7))}월`;

/** 등급 카드 (v3.7): 지금 등급·정산율, 그 등급을 정한 지난달 동행·누적 후기·평점,
 *  다음 1일 평가에서 한 단계 위(우수면 유지) 기준 vs 이번 달 동행·누적 후기·평점. 휴면이면 '계속 활동할게요' */
function GradeCard({ g, onActive }: { g: BuddyGradeInfo; onActive: (g: BuddyGradeInfo) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const confirm = async () => {
    setBusy(true); setErr(null);
    try { onActive(await post<BuddyGradeInfo>("/buddy/confirm-active")); } catch { setErr("잠시 뒤 다시 눌러 주세요"); } finally { setBusy(false); }
  };
  const s = g.stats;
  const goal = g.next?.need ?? g.keep;
  const goalTitle = g.next ? `${label(GRADE, g.next.grade)}(${pct(g.next.payout_rate)})까지` : `${label(GRADE, g.grade)} 지키기`;
  return (
    <section className="mt-6">
      {g.needs_recheck && (
        <Banner variant="warn" className="mb-4">
          30일간 활동이 없어 요청 받기를 멈췄어요
          <p className="mt-0.5 text-[13px] font-normal">지금은 버디 목록과 AI 추천에 보이지 않아요. 등급은 그대로 매달 1일에 다시 정해요.</p>
          <Button onClick={confirm} disabled={busy} full={false} className="mt-3 min-h-[40px] px-4 text-[14px]">{busy ? "확인 중…" : "계속 활동할게요"}</Button>
          {err && <p className="mt-2 text-[13px] text-red">{err}</p>}
        </Banner>
      )}
      <details className="group rounded-[16px] border border-line">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-bg text-orange-ink"><Icon name="sparkle" className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-bold text-ink">{label(GRADE, g.grade)} 버디 · 정산율 {pct(g.payout_rate)}</div>
            <div className="mt-0.5 text-[13.5px] text-muted">{g.next ? `${label(GRADE, g.next.grade)}까지 동행 ${Math.max(0, (g.next.need?.walks ?? 0) - s.this_month_walks)}회 더` : "최고 등급이에요"}</div>
          </div>
          <Icon name="chevron-down" className="h-5 w-5 shrink-0 text-muted transition group-open:rotate-180" />
        </summary>
        <div className="border-t border-line px-4 pb-4">
          <dl className="grid grid-cols-3 py-3 text-center">
            <div><dt className="text-[13px] text-muted">{Number(s.month.slice(5, 7))}월 동행</dt><dd className="mt-0.5 text-[16px] font-semibold text-ink">{s.last_month_walks}회</dd></div>
            <div className="border-x border-line"><dt className="text-[13px] text-muted">누적 후기</dt><dd className="mt-0.5 text-[16px] font-semibold text-ink">{s.reviews}건</dd></div>
            <div><dt className="text-[13px] text-muted">평점</dt><dd className="mt-0.5 text-[16px] font-semibold text-ink">{s.rating != null ? s.rating.toFixed(1) : "—"}</dd></div>
          </dl>
          {goal && (
            <>
              <div className="pt-1 text-[14px] font-semibold text-ink">{krDate(g.next_eval_on)} 평가 · {goalTitle}</div>
              <div className="mt-3 space-y-2.5">
                <GoalBar label="동행" value={s.this_month_walks} goal={goal.walks} format={(v) => `${v}회`} />
                <GoalBar label="후기" value={s.reviews} goal={goal.reviews} format={(v) => `${v}건`} />
                <GoalBar label="평점" value={s.rating ?? 0} goal={goal.rating} format={(v) => v.toFixed(1)} />
              </div>
            </>
          )}
          {g.first_month && <p className="mt-3 text-[13px] font-semibold text-orange">승인 후 첫 달은 기본 등급이에요. 다음 달 평가부터 올라갈 수 있어요.</p>}
          <p className="mt-3 text-[13px] leading-relaxed text-muted">{g.evaluated_for ? `${ym(g.evaluated_for)} 동행으로 정한 등급이에요. ` : ""}{g.note} 예약이 확정될 때의 정산율로 고정돼요.</p>
        </div>
      </details>
    </section>
  );
}
