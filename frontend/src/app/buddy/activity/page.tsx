"use client";
// B05 내 활동 — GET /buddy/grade (등급·정산율·실적, 휴면이면 POST /buddy/confirm-active),
// GET /buddy/settlement?month= (동행 수·정산율 적용 활동비·식비·받을 돈), GET /buddy/meal-claims,
// BD-05 GET /buddy/profile, GET /buddy/apply (학교 인증·교육 퀴즈)
import Link from "next/link";
import { useEffect, useState } from "react";
import { DEMO_TODAY, krDate } from "@/components/buddy/format";
import { LoginGate } from "@/components/buddy/login-gate";
import { InfoRow, MonthSelect } from "@/components/buddy/ui";
import { Banner, Button, GoalBar, Hero, LinkButton, Spinner, StatusPill, TagChip } from "@/components/ui";
import { CAN_HELP, GRADE, PERSONALITY, label, pct } from "@/lib/codes";
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
  const walkFee = (profile?.hourly_fee ?? 15000) * 2;
  const monthClaims = claims?.filter((c) => c.date.startsWith(month)) ?? null;
  const name = user?.name ?? profile?.name ?? "";
  const tags = profile ? [...profile.personality.slice(0, 1).map((p) => label(PERSONALITY, p)), ...profile.can_help.slice(0, 2).map((c) => label(CAN_HELP, c))] : [];

  return (
    <div className="pb-8">
      <Hero title="내 활동" right={<MonthSelect value={month} options={MONTHS} onChange={setMonth} />} />
      <LoginGate />

      <div className="px-5">
        {grade && <GradeCard g={grade} onActive={setGrade} />}

        {!st ? <Spinner /> : (
          <>
            <div className="divide-y divide-line">
              <InfoRow label="이번 달 동행" value={`${st.walks}회`} />
              <InfoRow label={`활동비${st.album ? " + 사진 기록" : ""} (정산율 ${pct(st.payout_rate)} 적용)`} value={won(st.net)} />
              <InfoRow label="식비 환급" value={won(st.meals_approved)} sub={st.meals_pending ? ` (확인 중 ${won(st.meals_pending)})` : ""} />
              <InfoRow label="받을 돈" value={<span className="text-navy">{won(st.payout)} · {krDate(st.pay_date)}</span>} />
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">활동비는 2시간 {won(walkFee)}이에요. 사진 기록(앨범) 요금도 같은 정산율로 받아요. 식비는 영수증을 운영팀이 확인하면 수수료 없이 돌려받아요.</p>
            <LinkButton href={`/buddy/settlement?month=${month}`} variant="secondary" className="mt-4 min-h-[48px]">정산 내역 자세히</LinkButton>
          </>
        )}

        <h2 className="mt-10 text-[18px] font-bold text-ink">식비 청구</h2>
        {monthClaims === null ? <Spinner /> : monthClaims.length === 0 ? (
          <p className="py-4 text-[15px] text-muted">이 달에 올린 식비 청구가 없어요.</p>
        ) : (
          <div className="mt-1 divide-y divide-line">
            {[...monthClaims].sort((a, b) => a.date.localeCompare(b.date)).map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <div className="text-[16px] font-semibold text-ink">{c.place} · {c.tourist.split(" ")[0]}</div>
                  <div className="mt-0.5 text-[14px] text-muted">{krDate(c.date)} · {won(c.amount)}{c.over_limit ? ` · 한도 ${won(c.amount - c.limit)} 넘음` : ""}{c.status === "rejected" && c.reason ? ` · ${c.reason}` : ""}</div>
                </div>
                <StatusPill status={c.status} label={CLAIM_LABEL[c.status]} />
              </div>
            ))}
          </div>
        )}

        <div className="mt-10 flex items-center justify-between">
          <h2 className="text-[18px] font-bold text-ink">내 프로필</h2>
          <Link href="/buddy/me" className="text-[15px] font-semibold text-ink">수정</Link>
        </div>
        {!profile ? <Spinner /> : (
          <div className="mt-4 flex gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-navy-bg text-[18px] font-bold text-navy" aria-hidden>{(name || profile.name).charAt(0)}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[17px] font-bold text-ink">
                {name || profile.name}
                {profile.review_count > 0 && <span className="flex items-center gap-1"><svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden><path d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9L12 2.8Z" fill="#C98A1B" /></svg>{profile.rating.toFixed(1)}</span>}
              </div>
              <div className="mt-0.5 text-[14px] text-muted">{profile.university} {profile.major} {profile.year}학년</div>
              {tags.length > 0 && <div className="mt-2.5 flex flex-wrap gap-1.5">{tags.map((t) => <TagChip key={t} variant="navy">{t}</TagChip>)}</div>}
              <div className="mt-2.5 flex items-center gap-1.5 text-[14px] font-semibold text-navy">
                <span className="h-1.5 w-1.5 rounded-full bg-navy" />
                {[profile.verified?.school_email || apply?.email_verified ? "학교 인증" : profile.verified?.residence || apply?.eligibility === "residence" ? "성북구 거주 확인" : "학교 인증 전", apply?.quiz_score != null ? `교육 ${apply.quiz_score}/10` : profile.verified?.trained ? "교육 이수" : null, `동행 ${profile.walk_count}회`].filter(Boolean).join(" · ")}
              </div>
            </div>
          </div>
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
    <section className="mb-9">
      {g.needs_recheck && (
        <Banner variant="warn" className="mb-5">
          30일간 활동이 없어 요청 받기를 멈췄어요
          <p className="mt-0.5 text-[13px] font-normal">지금은 버디 목록과 AI 추천에 보이지 않아요. 등급은 그대로 매달 1일에 다시 정해요.</p>
          <Button onClick={confirm} disabled={busy} full={false} className="mt-3 min-h-[40px] px-4 text-[14px]">{busy ? "확인 중…" : "계속 활동할게요"}</Button>
          {err && <p className="mt-2 text-[13px] text-red">{err}</p>}
        </Banner>
      )}
      <div className="flex items-end justify-between gap-3 border-b border-line pb-3.5">
        <div>
          <div className="text-[13px] text-muted">내 등급</div>
          <div className="mt-0.5 text-[20px] font-bold text-ink">{label(GRADE, g.grade)} 버디</div>
        </div>
        <div className="text-right">
          <div className="text-[13px] text-muted">정산율</div>
          <div className="mt-0.5 text-[20px] font-bold text-navy">{pct(g.payout_rate)}</div>
        </div>
      </div>
      <dl className="grid grid-cols-3 border-b border-line py-3 text-center">
        <div><dt className="text-[13px] text-muted">{Number(s.month.slice(5, 7))}월 동행</dt><dd className="mt-0.5 text-[16px] font-semibold text-ink">{s.last_month_walks}회</dd></div>
        <div className="border-x border-line"><dt className="text-[13px] text-muted">누적 후기</dt><dd className="mt-0.5 text-[16px] font-semibold text-ink">{s.reviews}건</dd></div>
        <div><dt className="text-[13px] text-muted">평점</dt><dd className="mt-0.5 text-[16px] font-semibold text-ink">{s.rating != null ? s.rating.toFixed(1) : "—"}</dd></div>
      </dl>
      <p className="mt-2 text-[13px] text-muted">{g.evaluated_for ? `${ym(g.evaluated_for)} 동행으로 정한 등급이에요` : "아직 평가 전이에요"}</p>
      {goal && (
        <>
          <div className="flex items-baseline justify-between pt-4 text-[14px]">
            <span className="font-semibold text-ink">{krDate(g.next_eval_on)} 평가 · {goalTitle}</span>
            <span className="text-[13px] text-muted">이번 달 동행</span>
          </div>
          <div className="mt-3 space-y-2.5">
            <GoalBar label="동행" value={s.this_month_walks} goal={goal.walks} format={(v) => `${v}회`} />
            <GoalBar label="후기" value={s.reviews} goal={goal.reviews} format={(v) => `${v}건`} />
            <GoalBar label="평점" value={s.rating ?? 0} goal={goal.rating} format={(v) => v.toFixed(1)} />
          </div>
        </>
      )}
      {g.first_month && <p className="mt-3 text-[13px] font-semibold text-orange">승인 후 첫 달은 기본 등급이에요. 다음 달 평가부터 올라갈 수 있어요.</p>}
      <p className="mt-3 text-[13px] leading-relaxed text-muted">{g.note} 예약이 확정될 때의 정산율로 고정돼요.</p>
    </section>
  );
}
