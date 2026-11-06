"use client";
// 내 활동 · 정산
import { HeaderActions } from "@/components/tourist/header-actions";
import { useEffect, useState } from "react";
import { Card, Chip, Empty, Hero, KpiTile, SectionTitle, Spinner, StatusPill } from "@/components/ui";
import { get, won } from "@/lib/api";
import { useUser } from "@/lib/auth";
import type { Buddy } from "@/lib/types";
import { fmtShort, roleLabel, type BuddyEarnings } from "@/components/buddy/format";
import { LoginGate } from "@/components/buddy/login-gate";
import { useToast } from "@/components/buddy/toast";

const MONTHS = ["2026-12", "2027-01", "2027-02"];
const monthLabel = (m: string) => `${Number(m.slice(5))}월`;

export default function Page() {
  const { user } = useUser();
  const { toast } = useToast();
  const [month, setMonth] = useState("2027-01");
  const [monthOpen, setMonthOpen] = useState(false);
  const [earn, setEarn] = useState<BuddyEarnings | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [profile, setProfile] = useState<Buddy | null>(null);

  useEffect(() => {
    get<BuddyEarnings>("/buddy/earnings").then(setEarn).catch(() => setEarn(null));
    get<Buddy>("/buddy/profile").then(setProfile).catch(() => setProfile(null));
  }, []);

  const isGuide = user?.role === "guide";
  const perFee = isGuide ? 20000 : 30000;
  const feeWord = isGuide ? "투어비" : "활동비";
  const name = user?.name ?? profile?.name ?? "지우";
  const items = earn?.items ?? [];
  const shown = showAll ? items : items.slice(0, 3);


  return (
    <div className="pb-6">
      <Hero title="내 활동" sub={`${roleLabel(user?.role)} · ${name} · ${month.slice(0, 4)}년 ${monthLabel(month)}`} right={<HeaderActions />}>
        <button type="button" onClick={() => setMonthOpen((o) => !o)} className="mt-3 rounded-full bg-white/15 px-3 py-1.5 text-[13px] font-semibold text-white">{monthLabel(month)} ▾</button>
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
            <KpiTile label={`${feeWord} 합계`} value={won(isGuide ? earn.activities * perFee : earn.total_fee)} sub={`회당 ${won(perFee)}`} accent />
            <div className="col-span-2"><KpiTile label="정산 완료 / 대기" value={<span className="text-[22px]">{won(earn.paid)} / {won(earn.pending)}</span>} sub="매월 말 지급" /></div>
          </div>
        )}

        <SectionTitle right={items.length > 3 && <button type="button" className="text-[13px] font-semibold text-navy" onClick={() => setShowAll((s) => !s)}>{showAll ? "접기" : "전체 →"}</button>}>활동 내역</SectionTitle>
        {earn === null ? <Spinner /> : shown.length === 0 ? <Card><Empty>활동 내역이 없어요</Empty></Card> : (
          <div className="space-y-2">
            {shown.map((it, i) => (
              <Card key={`${it.date}-${i}`} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-ink">{fmtShort(it.date)}  {it.tourist}</div>
                  <div className="mt-0.5 break-keep text-[12px] text-muted">{it.activity} · {won(isGuide ? perFee : it.amount)}</div>
                </div>
                <StatusPill status={it.status} label={it.status === "paid" ? "정산 완료" : "정산 대기"} />
              </Card>
            ))}
          </div>
        )}

      </div>
      {toast}
    </div>
  );
}
