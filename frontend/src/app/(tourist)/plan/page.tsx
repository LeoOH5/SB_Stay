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
import { money, tr, useLang } from "@/lib/i18n";
import type { AiPlan, Lang } from "@/lib/types";

const OPEN_FROM = "2027-01-05", OPEN_TO = "2027-02-20";
const BUDGETS: { value: number; label: () => string }[] = [
  { value: 100000, label: () => tr("10만 원 이하", `Up to ${money(100000)}`) },
  { value: 200000, label: () => tr("20만 원 이하", `Up to ${money(200000)}`) },
  { value: 300000, label: () => tr("30만 원 이하", `Up to ${money(300000)}`) },
  { value: 500000, label: () => tr("50만 원 이하", `Up to ${money(500000)}`) },
  { value: 0, label: () => tr("상관없어요", "No limit") },
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
    if (nights <= 0) { setErr(tr("떠나는 날은 오는 날보다 뒤여야 해요", "Check-out must be after check-in")); return; }
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
      <Headline className="pt-2" title={tr("일정 만들기", "Plan my stay")} sub={tr("고르기만 하면 돼요. 하고 싶은 말은 마지막 칸에 적어 주세요.", "Just tap your choices. Anything else goes in the last box.")} />
      <div className="px-5 pb-4 pt-6">
        <FieldLabel>{tr("머무는 날", "Dates")}</FieldLabel>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <DateBox label={tr("오는 날", "Check-in")} value={checkIn} min={OPEN_FROM} max={OPEN_TO} onChange={setCheckIn} />
          <span className="text-muted">–</span>
          <DateBox label={tr("떠나는 날", "Check-out")} value={checkOut} min={OPEN_FROM} max={OPEN_TO} onChange={setCheckOut} />
        </div>
        <p className="mt-2 text-[13.5px] text-muted">{nights > 0 ? tr(`${nights}박 ${nights + 1}일`, `${nights} night${nights === 1 ? "" : "s"}, ${nights + 1} days`) : tr("떠나는 날을 다시 골라 주세요", "Please pick the check-out date again")}</p>

        <FieldLabel className="mt-6">{tr("예산", "Budget")}</FieldLabel>
        <div className="relative">
          <select className="h-[52px] w-full appearance-none rounded-[14px] border border-line bg-white px-4 text-[16px] text-ink focus:border-navy focus:outline-none" value={budget} onChange={(e) => setBudget(Number(e.target.value))} aria-label={tr("예산", "Budget")}>
            {BUDGETS.map((b) => <option key={b.value} value={b.value}>{b.label()}</option>)}
          </select>
          <Icon name="chevron-down" className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink" />
        </div>

        <FieldLabel className="mt-6">{tr("관심사", "Interests")}</FieldLabel>
        <div className="flex flex-wrap gap-2">{INTERESTS.map((i) => <Chip key={i.key} selected={interests.includes(i.key)} onClick={() => toggle(i.key)}>{i.label}</Chip>)}</div>

        <FieldLabel className="mt-6">{tr("버디와 걷기", "Walk with a buddy")}</FieldLabel>
        <Segmented value={withBuddy} onChange={setWithBuddy} options={[{ value: "yes", label: tr("원해요", "Yes, please") }, { value: "no", label: tr("괜찮아요", "No thanks") }]} />

        <FieldLabel className="mt-6">{tr("안내 언어", "Guide language")}</FieldLabel>
        <Segmented<Lang> value={language} onChange={setLanguage} options={[{ value: "en", label: "English" }, { value: "ko", label: "한국어" }]} />

        <FieldLabel className="mt-6">{tr("더 알려 줄 것", "Anything else?")}</FieldLabel>
        <textarea className={`${textareaCls} min-h-[88px] text-[15px]`} placeholder="I love Korean poetry…" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
        <ErrorBox message={err} className="mt-4" />
      </div>

      <BottomBar>
        <Button type="submit" disabled={busy}>{busy ? tr("AI가 일정을 짜는 중…", "AI is planning…") : tr("일정 만들기", "Make my plan")}</Button>
        <p className="mt-2.5 text-center text-[13px] leading-relaxed text-muted">{tr("가격과 운영일은 실제 정보로 먼저 거르고, AI는 고르고 설명만 해요", "Prices and opening days come from real data first. AI only picks and explains.")}</p>
      </BottomBar>
    </form>
  );
}
