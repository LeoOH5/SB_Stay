"use client";
// B05 내 활동 — GET /buddy/settlement?month= (동행 수·수수료 뺀 활동비·식비·받을 돈), GET /buddy/meal-claims,
// BD-05 GET /buddy/profile, GET /buddy/apply (학교 인증·교육 퀴즈)
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DEMO_TODAY, krDate } from "@/components/buddy/format";
import { LoginGate } from "@/components/buddy/login-gate";
import { InfoRow, MonthSelect } from "@/components/buddy/ui";
import { Hero, LinkButton, Spinner, StatusPill, TagChip } from "@/components/ui";
import { CAN_HELP, PERSONALITY, label } from "@/lib/codes";
import { get, won } from "@/lib/api";
import { session, useUser } from "@/lib/auth";
import type { BuddyApplyStatus, BuddyProfile, BuddySettlement, ListResponse, MealClaim } from "@/lib/types";

const MONTHS = ["2026-12", "2027-01", "2027-02"];
const CLAIM_LABEL: Record<string, string> = { approved: "승인", requested: "확인 중", rejected: "반려" };

export default function Page() {
  const router = useRouter();
  const { user } = useUser();
  const [month, setMonth] = useState(DEMO_TODAY.slice(0, 7));
  const [stByMonth, setStByMonth] = useState<Record<string, BuddySettlement>>({});
  const [claims, setClaims] = useState<MealClaim[] | null>(null);
  const [profile, setProfile] = useState<BuddyProfile | null>(null);
  const [apply, setApply] = useState<BuddyApplyStatus | null>(null);

  useEffect(() => {
    let alive = true;
    get<BuddySettlement>("/buddy/settlement", { month }).then((r) => { if (alive) setStByMonth((m) => ({ ...m, [month]: r })); }).catch(() => { /* 불러오는 중으로 남김 */ });
    return () => { alive = false; };
  }, [month]);
  useEffect(() => {
    get<ListResponse<MealClaim>>("/buddy/meal-claims").then((r) => setClaims(r.items)).catch(() => setClaims([]));
    get<BuddyProfile>("/buddy/profile").then(setProfile).catch(() => setProfile(null));
    get<BuddyApplyStatus>("/buddy/apply").then(setApply).catch(() => setApply(null));
  }, []);

  const st = stByMonth[month] ?? null;
  const walkFee = (profile?.hourly_fee ?? 15000) * 2;
  const monthClaims = claims?.filter((c) => c.date.startsWith(month)) ?? null;
  const name = user?.name ?? profile?.name ?? "";
  const tags = profile ? [...profile.personality.slice(0, 1).map((p) => label(PERSONALITY, p)), ...profile.can_help.slice(0, 2).map((c) => label(CAN_HELP, c))] : [];
  const logout = () => { session.clear(); router.push("/buddy/login"); };

  return (
    <div className="pb-8">
      <Hero title="내 활동" right={<MonthSelect value={month} options={MONTHS} onChange={setMonth} />} />
      <LoginGate />

      <div className="px-5">
        {!st ? <Spinner /> : (
          <>
            <div className="divide-y divide-line">
              <InfoRow label="이번 달 동행" value={`${st.walks}회`} />
              <InfoRow label="활동비 (수수료 10% 뺀 금액)" value={won(st.net)} />
              <InfoRow label="식비 환급" value={won(st.meals_approved)} sub={st.meals_pending ? ` (확인 중 ${won(st.meals_pending)})` : ""} />
              <InfoRow label="받을 돈" value={<span className="text-navy">{won(st.payout)} · {krDate(st.pay_date)}</span>} />
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">활동비는 2시간 {won(walkFee)}이에요. 식비는 영수증을 운영팀이 확인하면 수수료 없이 돌려받아요.</p>
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
                {[profile.verified?.school_email || apply?.email_verified ? "학교 인증" : "학교 인증 전", apply?.quiz_score != null ? `교육 ${apply.quiz_score}/10` : profile.verified?.trained ? "교육 이수" : null, `동행 ${profile.walk_count}회`].filter(Boolean).join(" · ")}
              </div>
            </div>
          </div>
        )}
        <button type="button" onClick={logout} className="mt-6 py-2 text-[15px] text-muted">로그아웃</button>
      </div>
    </div>
  );
}
