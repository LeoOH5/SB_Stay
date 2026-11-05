"use client";
// B4 내 활동 · 정산(목업) + 프로필
// API: GET /buddy/earnings (BD-07), GET/PUT /buddy/profile (BD-03)
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Card, Chip, Empty, Field, Hero, KpiTile, SectionTitle, Spinner, StatusPill, inputCls } from "@/components/ui";
import { get, put, won } from "@/lib/api";
import { session, useUser } from "@/lib/auth";
import type { Buddy } from "@/lib/types";
import { INTEREST_LABEL, LANG_LABEL, fmtShort, interestsLabel, langsLabel, roleLabel, type BuddyEarnings } from "@/components/buddy/format";
import { LoginGate } from "@/components/buddy/login-gate";
import { useToast } from "@/components/buddy/toast";

const MONTHS = ["2026-12", "2027-01", "2027-02"];
const monthLabel = (m: string) => `${Number(m.slice(5))}월`;

export default function Page() {
  const { user } = useUser();
  const router = useRouter();
  const { show, toast } = useToast();
  const [month, setMonth] = useState("2027-01");
  const [monthOpen, setMonthOpen] = useState(false);
  const [earn, setEarn] = useState<BuddyEarnings | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [profile, setProfile] = useState<Buddy | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Pick<Buddy, "major" | "year" | "languages" | "interests" | "intro"> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    get<BuddyEarnings>("/buddy/earnings").then(setEarn).catch(() => setEarn(null));
    get<Buddy>("/buddy/profile").then(setProfile).catch(() => setProfile(null));
  }, []);

  const isGuide = user?.role === "guide";
  const perFee = isGuide ? 20000 : 30000;
  const feeWord = isGuide ? "투어비" : "활동비";
  const name = user?.name ?? profile?.name ?? "지우";
  const email = user?.email ?? "jiwoo@a-univ.ac.kr";
  const items = earn?.items ?? [];
  const shown = showAll ? items : items.slice(0, 3);

  const startEdit = () => { if (!profile) return; setDraft({ major: profile.major, year: profile.year, languages: profile.languages, interests: profile.interests, intro: profile.intro }); setEditing(true); };
  const toggleIn = (arr: string[], k: string) => (arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k]);
  const saveProfile = async () => {
    if (!draft || !profile) return;
    setSaving(true);
    try {
      const r = await put<Buddy>("/buddy/profile", { ...draft, avatar: profile.avatar, hourly_fee: profile.hourly_fee, school_email: email });
      setProfile({ ...profile, ...r }); setEditing(false); show("프로필을 저장했어요");
    } catch (e) { show(e instanceof Error ? e.message : "저장에 실패했어요"); }
    finally { setSaving(false); }
  };
  const logout = () => { session.clear(); show("로그아웃했어요"); router.push("/buddy/login"); };

  return (
    <div className="pb-6">
      <Hero title="내 활동" sub={`${roleLabel(user?.role)} · ${name} · ${month.slice(0, 4)}년 ${monthLabel(month)}`}
        right={<button type="button" onClick={() => setMonthOpen((o) => !o)} className="rounded-full bg-white/15 px-3 py-1.5 text-[13px] font-semibold text-white">{monthLabel(month)} ▾</button>}>
        {monthOpen && (
          <div className="mt-3 flex gap-2">
            {MONTHS.map((m) => <Chip key={m} selected={m === month} onClick={() => { setMonth(m); setMonthOpen(false); }}>{monthLabel(m)}</Chip>)}
          </div>
        )}
      </Hero>
      <LoginGate />

      <div className="px-5">
        {earn === null ? <Spinner /> : (
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <KpiTile label="이번 달 활동" value={`${earn.activities}회`} sub={`${isGuide ? "투어" : "동행"} ${earn.activities} · 평균 ${profile?.rating ?? 4.9}★`} />
            <KpiTile label={`${feeWord} 합계`} value={won(isGuide ? earn.activities * perFee : earn.total_fee)} sub={`회당 ${won(perFee)} (팀 결정 ③)`} accent />
            <div className="col-span-2"><KpiTile label="정산 완료 / 대기" value={<span className="text-[22px]">{won(earn.paid)} / {won(earn.pending)}</span>} sub="매월 말 지급 (목업)" /></div>
          </div>
        )}

        <SectionTitle right={items.length > 3 && <button type="button" className="text-[13px] font-semibold text-navy" onClick={() => setShowAll((s) => !s)}>{showAll ? "접기" : "전체 →"}</button>}>활동 내역</SectionTitle>
        {earn === null ? <Spinner /> : shown.length === 0 ? <Card><Empty>활동 내역이 없어요</Empty></Card> : (
          <div className="space-y-2">
            {shown.map((it, i) => (
              <Card key={`${it.date}-${i}`} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-ink">{fmtShort(it.date)}  {it.tourist}</div>
                  <div className="mt-0.5 truncate text-[12px] text-muted">{it.activity} · {won(isGuide ? perFee : it.amount)}</div>
                </div>
                <StatusPill status={it.status} label={it.status === "paid" ? "정산 완료" : "정산 대기"} />
              </Card>
            ))}
          </div>
        )}

        <SectionTitle right={profile && !editing && <button type="button" className="text-[13px] font-semibold text-navy" onClick={startEdit}>수정</button>}>프로필</SectionTitle>
        {profile === null ? <Spinner /> : !editing ? (
          <Card>
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-navy-bg text-[16px] font-semibold text-navy">{name.slice(0, 1)}</div>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-ink">{name} · {profile.university} {profile.major} {profile.year}학년</div>
                <div className="mt-0.5 text-[12px] text-muted">{langsLabel(profile.languages)} · {interestsLabel(profile.interests)} · 승인됨</div>
                <div className="mt-0.5 text-[12px] text-green-dark">{email} ✓ 학교 이메일 인증</div>
                {profile.intro && <div className="mt-2 text-[12px] leading-relaxed text-ink/80">{profile.intro}</div>}
              </div>
            </div>
          </Card>
        ) : draft && (
          <Card className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="전공"><input className={inputCls} value={draft.major} onChange={(e) => setDraft({ ...draft, major: e.target.value })} /></Field>
              <Field label="학년"><input className={inputCls} type="number" min={1} max={6} value={draft.year} onChange={(e) => setDraft({ ...draft, year: Number(e.target.value) || 1 })} /></Field>
            </div>
            <div>
              <div className="mb-1.5 text-[12px] text-muted">언어</div>
              <div className="flex flex-wrap gap-2">{Object.entries(LANG_LABEL).map(([k, v]) => <Chip key={k} selected={draft.languages.includes(k)} onClick={() => setDraft({ ...draft, languages: toggleIn(draft.languages, k) })}>{v}</Chip>)}</div>
            </div>
            <div>
              <div className="mb-1.5 text-[12px] text-muted">관심사</div>
              <div className="flex flex-wrap gap-2">{Object.entries(INTEREST_LABEL).map(([k, v]) => <Chip key={k} selected={draft.interests.includes(k)} onClick={() => setDraft({ ...draft, interests: toggleIn(draft.interests, k) })}>{v}</Chip>)}</div>
            </div>
            <Field label="소개"><textarea className={`${inputCls} h-24 py-3`} value={draft.intro} onChange={(e) => setDraft({ ...draft, intro: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Button className="h-11! min-h-11!" onClick={saveProfile} disabled={saving}>{saving ? "저장 중…" : "저장"}</Button>
              <Button variant="ghost" className="h-11! min-h-11!" onClick={() => setEditing(false)} disabled={saving}>취소</Button>
            </div>
          </Card>
        )}

        <Card className="mt-4 bg-orange-bg ring-0">
          <p className="text-[13px] leading-relaxed text-orange">팀 결정 ③: 버디 유급(활동비) vs 무급 교류 — 무급이면 금액 열을 숨기고 &lsquo;활동 내역&rsquo;만. 해설사는 투어비 ₩20,000/회로 표시.</p>
        </Card>

        <Button variant="ghost" className="mt-4" onClick={logout}>로그아웃</Button>
      </div>
      {toast}
    </div>
  );
}
