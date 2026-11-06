"use client";
// T4c 버디 목록 (AI 매칭) — BD-01 GET /buddies, AI-03 POST /ai/buddy-match
import Link from "next/link";
import { useEffect, useState } from "react";
import { AiBlock, Card, Chip, Hero, inputCls, Spinner } from "@/components/ui";
import { ErrorBox } from "@/components/tourist";
import { DEFAULT_TOUR_DATE, errMsg, INTEREST_LABEL, interestsLabel, langsShort, md } from "@/components/tourist/format";
import { get, post } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import type { Buddy, BuddyMatch, ListResponse } from "@/lib/types";

const INTEREST_CHIPS: string[] = ["literature", "independence", "food", "hanok", "craft", "walking"];

function BuddyCard({ b, reason }: { b: Buddy; reason?: string }) {
  return (
    <Link href={`/buddies/${b.id}`} className="block">
      <Card className="flex items-center gap-3 p-3">
        <div className="h-11 w-11 shrink-0 rounded-full bg-navy-bg flex items-center justify-center text-[16px] font-semibold text-navy">{b.name[0]}</div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-ink break-keep">{b.name} · {b.university.replace("학교", "")} {b.major} {b.year}학년</div>
          <div className="text-[12px] text-muted break-keep">{langsShort(b.languages)} · {interestsLabel(b.interests)} · ★ {b.rating} ({b.review_count})</div>
          {reason && <div className="text-[12px] text-green-dark mt-0.5">AI · {reason}</div>}
        </div>
        <span className="text-muted">›</span>
      </Card>
    </Link>
  );
}

export default function BuddiesPage() {
  const { lang } = useLang();
  const [language, setLanguage] = useState<string>("en");
  const [date, setDate] = useState(DEFAULT_TOUR_DATE);
  const [useDate, setUseDate] = useState(true);
  const [interest, setInterest] = useState<string>("literature");
  const [buddies, setBuddies] = useState<Buddy[] | null>(null);
  const [all, setAll] = useState<Buddy[]>([]);
  const [match, setMatch] = useState<BuddyMatch | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    get<ListResponse<Buddy>>("/buddies").then((r) => { if (alive) setAll(r.items); }).catch(() => { /* 추천 카드 보조용 */ });
    return () => { alive = false; };
  }, []);

  /** 필터 변경 시 목록·추천·오류를 비우고(로딩 표시) 조건을 바꾼다 */
  const pick = (fn: () => void) => { setErr(null); setBuddies(null); setMatch(null); fn(); };

  useEffect(() => {
    let alive = true;
    const d = useDate ? date : undefined;
    get<ListResponse<Buddy>>("/buddies", { language: language || undefined, date: d, interest: interest || undefined })
      .then((r) => { if (alive) setBuddies(r.items); })
      .catch((e: unknown) => { if (alive) setErr(errMsg(e)); });
    post<BuddyMatch>("/ai/buddy-match", { language: language || lang, date: d, interests: interest ? [interest] : [] })
      .then((m) => { if (alive) setMatch(m); })
      .catch(() => { /* 추천은 선택 */ });
    return () => { alive = false; };
  }, [language, date, useDate, interest, lang]);

  const byId = new Map<number, Buddy>([...all, ...(buddies ?? [])].map((b) => [b.id, b]));
  const top = (match?.matches ?? []).slice(0, 3).map((m) => ({ m, b: byId.get(m.buddy_id) })).filter((x): x is { m: BuddyMatch["matches"][number]; b: Buddy } => !!x.b);
  const topIds = new Set(top.map((x) => x.b.id));
  const rest = (buddies ?? []).filter((b) => !topIds.has(b.id));

  return (
    <>
      <Hero back="/home" title="Buddies" sub="성북구 대학생과 캠퍼스·동네를 함께 걸어요" />
      <div className="px-5 pb-6 pt-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Chip selected={language === "en"} onClick={() => pick(() => setLanguage((v) => (v === "en" ? "" : "en")))}>EN</Chip>
          <Chip selected={language === "ja"} onClick={() => pick(() => setLanguage((v) => (v === "ja" ? "" : "ja")))}>JA</Chip>
          <Chip selected={language === "zh"} onClick={() => pick(() => setLanguage((v) => (v === "zh" ? "" : "zh")))}>ZH</Chip>
          <Chip selected={useDate} onClick={() => pick(() => setUseDate((v) => !v))}>{useDate ? md(date) : "날짜 전체"}</Chip>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip selected={interest === ""} onClick={() => pick(() => setInterest(""))}>관심사 전체</Chip>
          {INTEREST_CHIPS.map((k) => <Chip key={k} selected={interest === k} onClick={() => pick(() => setInterest(k))}>{INTEREST_LABEL[k]}</Chip>)}
        </div>
        {useDate && <input type="date" className={inputCls} value={date} min="2027-01-05" max="2027-02-20" onChange={(e) => pick(() => setDate(e.target.value))} />}

        <AiBlock title={`추천 ${top.length || 3}명`}>{match?.reason ?? "조건에 맞는 버디를 고르는 중…"}</AiBlock>
        {top.map(({ m, b }) => <BuddyCard key={b.id} b={b} reason={m.reason} />)}

        <ErrorBox message={err} />
        {!buddies && !err && <Spinner />}
        {buddies && rest.length > 0 && <div className="text-[13px] font-semibold text-ink pt-2">다른 버디 {rest.length}명</div>}
        {rest.map((b) => <BuddyCard key={b.id} b={b} />)}
        {buddies && buddies.length === 0 && top.length === 0 && <Card tint className="text-center text-[13px] text-muted py-6">이 조건에 가능한 버디가 없어요. 날짜·언어를 바꿔 보세요.</Card>}
      </div>
    </>
  );
}
