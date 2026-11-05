"use client";
// T2 AI 여행 설계 입력 — AI-01 POST /ai/plan
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Chip, Field, Hero, inputCls } from "@/components/ui";
import { ErrorBox, selectCls, textareaCls } from "@/components/tourist";
import { DEFAULT_FROM, DEFAULT_TO, errMsg, INTERESTS, nightsBetween, SS_PLAN } from "@/components/tourist/format";
import { writeSS } from "@/components/tourist/session";
import { post } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import type { AiPlan, Lang } from "@/lib/types";

const BUDGETS: { value: number; label: string }[] = [
  { value: 100000, label: "₩100,000 이하" },
  { value: 200000, label: "₩200,000 이하" },
  { value: 300000, label: "₩300,000 이하" },
  { value: 500000, label: "₩500,000 이하" },
  { value: 0, label: "상관없음" },
];

export default function PlanPage() {
  const router = useRouter();
  const { lang } = useLang();
  const [checkIn, setCheckIn] = useState(DEFAULT_FROM);
  const [checkOut, setCheckOut] = useState(DEFAULT_TO);
  const [budget, setBudget] = useState(200000);
  const [interests, setInterests] = useState<string[]>(["literature", "independence"]);
  const [withBuddy, setWithBuddy] = useState(true);
  const [language, setLanguage] = useState<Lang>(lang);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const nights = nightsBetween(checkIn, checkOut);

  const toggle = (k: string) => setInterests((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));

  const submit = async () => {
    setErr(null);
    if (nights <= 0) { setErr("종료일은 시작일보다 뒤여야 해요"); return; }
    setBusy(true);
    try {
      const plan = await post<AiPlan>("/ai/plan", { check_in: checkIn, check_out: checkOut, budget: budget || undefined, interests, with_buddy: withBuddy, language, note: note.trim() || undefined });
      writeSS(SS_PLAN, plan);
      router.push("/plan/result");
    } catch (e) { setErr(errMsg(e)); }
    finally { setBusy(false); }
  };

  return (
    <>
      <Hero title="Plan my stay" sub="선택형 버튼으로 간단히. 자유 입력은 한 칸만." />
      <form className="px-5 pb-6 pt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <div>
          <span className="block text-[12px] text-muted mb-1.5">체류 기간</span>
          <div className="flex items-center gap-2">
            <input type="date" className={inputCls} value={checkIn} min="2027-01-05" max="2027-02-20" onChange={(e) => setCheckIn(e.target.value)} />
            <span className="text-muted">–</span>
            <input type="date" className={inputCls} value={checkOut} min="2027-01-05" max="2027-02-20" onChange={(e) => setCheckOut(e.target.value)} />
            <span className="shrink-0 text-[13px] font-semibold text-navy">{nights}박</span>
          </div>
          <span className="block text-[12px] text-muted mt-1">겨울방학 개방 기간 2027.1.5 – 2.20</span>
        </div>
        <Field label="총 예산">
          <select className={selectCls} value={budget} onChange={(e) => setBudget(Number(e.target.value))}>
            {BUDGETS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </Field>
        <div>
          <span className="block text-[12px] text-muted mb-1.5">관심사 (여러 개)</span>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((i) => <Chip key={i.key} selected={interests.includes(i.key)} onClick={() => toggle(i.key)}>{i.label}</Chip>)}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-[90px] text-[13px] text-muted">버디와 걷기</span>
          <Chip selected={withBuddy} onClick={() => setWithBuddy(true)}>원해요</Chip>
          <Chip selected={!withBuddy} onClick={() => setWithBuddy(false)}>괜찮아요</Chip>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-[90px] text-[13px] text-muted">언어</span>
          <Chip selected={language === "en"} onClick={() => setLanguage("en")}>English</Chip>
          <Chip selected={language === "ko"} onClick={() => setLanguage("ko")}>한국어</Chip>
        </div>
        <Field label="더 알려줄 것">
          <textarea className={textareaCls} placeholder="I love Korean poetry…" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <ErrorBox message={err} />
        <Button type="submit" disabled={busy}>{busy ? "AI가 일정을 짜는 중…" : "일정 만들기"}</Button>
        <p className="text-[12px] text-muted">가격·운영시간·가능 날짜는 DB 값으로 먼저 거르고, AI는 선택·순서·설명만 해요.</p>
      </form>
    </>
  );
}
