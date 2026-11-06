"use client";
// T11 일정 만들기 — AI-01 POST /ai/plan (날짜·예산·관심사·버디·언어·메모)
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Chip, Icon, TopBar } from "@/components/ui";
import { ErrorBox, textareaCls } from "@/components/tourist";
import { DEFAULT_FROM, DEFAULT_TO, errMsg, INTERESTS, nightsBetween, SS_PLAN, SS_PLAN_BUDDY, SS_PLAN_INPUT } from "@/components/tourist/format";
import { writeSS } from "@/components/tourist/session";
import { BottomBar, DateBox, FieldLabel, Headline, Segmented } from "@/components/tourist/v3";
import { post } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import type { AiPlan, Lang } from "@/lib/types";

const OPEN_FROM = "2027-01-05", OPEN_TO = "2027-02-20";
const BUDGETS: { value: number; label: string }[] = [
  { value: 100000, label: "10만 원 이하" },
  { value: 200000, label: "20만 원 이하" },
  { value: 300000, label: "30만 원 이하" },
  { value: 500000, label: "50만 원 이하" },
  { value: 0, label: "상관없어요" },
];

export default function PlanPage() {
  const router = useRouter();
  const { lang } = useLang();
  const [checkIn, setCheckIn] = useState(DEFAULT_FROM);
  const [checkOut, setCheckOut] = useState(DEFAULT_TO);
  const [budget, setBudget] = useState(200000);
  const [interests, setInterests] = useState<string[]>(["literature", "independence"]);
  const [withBuddy, setWithBuddy] = useState<"yes" | "no">("yes");
  const [language, setLanguage] = useState<Lang>(lang);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const nights = nightsBetween(checkIn, checkOut);

  const toggle = (k: string) => setInterests((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));

  const submit = async () => {
    setErr(null);
    if (nights <= 0) { setErr("떠나는 날은 오는 날보다 뒤여야 해요"); return; }
    setBusy(true);
    try {
      const plan = await post<AiPlan>("/ai/plan", { check_in: checkIn, check_out: checkOut, budget: budget || undefined, interests, with_buddy: withBuddy === "yes", language, note: note.trim() || undefined });
      writeSS(SS_PLAN, plan);
      writeSS(SS_PLAN_INPUT, { check_in: checkIn, check_out: checkOut, interests, language });
      writeSS(SS_PLAN_BUDDY, null);
      router.push("/plan/result");
    } catch (e) { setErr(errMsg(e)); setBusy(false); }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <TopBar back="/home" />
      <Headline className="pt-2" title="일정 만들기" sub="고르기만 하면 돼요. 하고 싶은 말은 마지막 칸에 적어 주세요." />
      <div className="px-5 pb-4 pt-6">
        <FieldLabel>머무는 날</FieldLabel>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <DateBox label="오는 날" value={checkIn} min={OPEN_FROM} max={OPEN_TO} onChange={setCheckIn} />
          <span className="text-muted">–</span>
          <DateBox label="떠나는 날" value={checkOut} min={OPEN_FROM} max={OPEN_TO} onChange={setCheckOut} />
        </div>
        <p className="mt-2 text-[13.5px] text-muted">{nights > 0 ? `${nights}박 ${nights + 1}일` : "떠나는 날을 다시 골라 주세요"}</p>

        <FieldLabel className="mt-6">예산</FieldLabel>
        <div className="relative">
          <select className="h-[52px] w-full appearance-none rounded-[14px] border border-line bg-white px-4 text-[16px] text-ink focus:border-navy focus:outline-none" value={budget} onChange={(e) => setBudget(Number(e.target.value))} aria-label="예산">
            {BUDGETS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
          <Icon name="chevron-down" className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink" />
        </div>

        <FieldLabel className="mt-6">관심사</FieldLabel>
        <div className="flex flex-wrap gap-2">{INTERESTS.map((i) => <Chip key={i.key} selected={interests.includes(i.key)} onClick={() => toggle(i.key)}>{i.label}</Chip>)}</div>

        <FieldLabel className="mt-6">버디와 걷기</FieldLabel>
        <Segmented value={withBuddy} onChange={setWithBuddy} options={[{ value: "yes", label: "원해요" }, { value: "no", label: "괜찮아요" }]} />

        <FieldLabel className="mt-6">안내 언어</FieldLabel>
        <Segmented<Lang> value={language} onChange={setLanguage} options={[{ value: "en", label: "English" }, { value: "ko", label: "한국어" }]} />

        <FieldLabel className="mt-6">더 알려 줄 것</FieldLabel>
        <textarea className={`${textareaCls} min-h-[88px] text-[15px]`} placeholder="I love Korean poetry…" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
        <ErrorBox message={err} className="mt-4" />
      </div>

      <BottomBar>
        <Button type="submit" disabled={busy}>{busy ? "AI가 일정을 짜는 중…" : "일정 만들기"}</Button>
        <p className="mt-2.5 text-center text-[13px] leading-relaxed text-muted">가격과 운영일은 실제 정보로 먼저 거르고, AI는 고르고 설명만 해요</p>
      </BottomBar>
    </form>
  );
}
