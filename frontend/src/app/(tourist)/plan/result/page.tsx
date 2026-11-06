"use client";
// T12 AI 추천 일정 — AI-01 응답(sessionStorage). 코스는 무료(담지 않음), 경고 NO_BUDDY·OVER_BUDGET, 장바구니에 모두 담기
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AiBlock, Banner, Button, LinkButton, Spinner, TopBar, cn } from "@/components/ui";
import { ErrorBox } from "@/components/tourist";
import { errMsg, nightsBetween, okv, parseDate, SS_PLAN } from "@/components/tourist/format";
import { useSS } from "@/components/tourist/session";
import { BottomBar, Headline, TotalLine, useHydrated } from "@/components/tourist/v3";
import { DOW, koDay, koDuration, koMD, koRange, wa } from "@/components/tourist/v3/flow";
import { get, won } from "@/lib/api";
import { useCart } from "@/lib/cart";
import type { AiPlan, Buddy, CartItem, PlanItem, PlanWarning } from "@/lib/types";

const WARN: Record<PlanWarning, string> = {
  NO_BUDDY: "이 기간에 함께 걸을 버디를 찾지 못했어요. 기숙사 숙박에는 버디가 꼭 필요해서, 장바구니에서 버디를 골라 주세요.",
  OVER_BUDGET: "예산을 조금 넘었어요. 숙박에는 버디가 꼭 필요해서 버디는 빼지 않았어요.",
};

/** 일정 항목(dorm/buddy) → CartItem. dorm 은 첫날~마지막날, buddy 는 그 날짜·시간 + 같이 걸을 코스 */
async function planToCart(plan: AiPlan): Promise<CartItem[]> {
  const first = plan.days[0]?.date;
  const last = plan.days[plan.days.length - 1]?.date;
  const out: CartItem[] = [];
  for (const day of plan.days) {
    for (const it of day.items) {
      if (it.ref_id === null) continue;
      if (it.type === "dorm") {
        const from = first ?? day.date, to = last ?? day.date;
        out.push({ type: "dorm", ref_id: it.ref_id, title: it.title, meta: `${koRange(from, to)}, ${nightsBetween(from, to)}박`, price: it.price, date_from: from, date_to: to, guests: 1, request: null });
      } else if (it.type === "buddy") {
        const b = await okv(get<Buddy>(`/buddies/${it.ref_id}`)).catch(() => null);
        const course = it.course_id ? day.items.find((x) => x.type === "course" && x.ref_id === it.course_id) : undefined;
        out.push({
          type: "buddy", ref_id: it.ref_id, title: b ? `${b.name}${wa(b.name)} 동네 걷기` : it.title,
          meta: `${koDay(day.date)} ${it.time ?? "14:00"}, ${koDuration(it.duration_min)}`, price: it.price,
          date: day.date, time: it.time ?? "14:00", duration_min: it.duration_min ?? 120, course_id: it.course_id ?? null, course_title: course?.title ?? null,
          meal_count: 0, album: false, hourly_fee: b?.hourly_fee, university_id: b?.university_id, request: null,
        });
      }
    }
  }
  return out;
}

function Dot({ type }: { type: PlanItem["type"] }) {
  if (type === "dorm") return <span className="mt-[7px] h-3 w-3 shrink-0 rounded-full bg-ink" />;
  if (type === "buddy") return <span className="mt-[7px] h-3 w-3 shrink-0 rounded-full bg-navy" />;
  return <span className="mt-[7px] h-3 w-3 shrink-0 rounded-full border-2 border-ink bg-white" />;
}

function itemMeta(it: PlanItem): string {
  if (!it.meta || it.meta === it.time) return it.time ?? "자유";
  return it.time ? `${it.time}, ${it.meta}` : it.meta;
}

export default function PlanResultPage() {
  const router = useRouter();
  const cart = useCart();
  const hydrated = useHydrated();
  const plan = useSS<AiPlan | null>(SS_PLAN, null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!hydrated) return <Spinner />;
  if (!plan) {
    return (
      <>
        <TopBar back="/home" />
        <Headline className="pt-2" title="아직 만든 일정이 없어요" sub="날짜와 관심사만 고르면 AI가 숙소·버디·산책 코스를 묶어 드려요." />
        <div className="px-5 pt-6"><LinkButton href="/plan">일정 만들기</LinkButton></div>
      </>
    );
  }

  const first = plan.days[0]?.date, last = plan.days[plan.days.length - 1]?.date;
  const nights = first && last ? nightsBetween(first, last) : 0;
  const longDay = (s: string) => `${DOW[parseDate(s).getDay()]}요일`;
  const sameMonth = first && last && parseDate(first).getMonth() === parseDate(last).getMonth();

  const addAll = async () => {
    setBusy(true); setErr(null);
    try {
      const items = await planToCart(plan);
      // 숙박은 한 곳, 버디는 한 명 — 같은 유형은 바꾼다
      for (const old of cart.items) if (items.some((n) => n.type === old.type)) cart.remove(old.type, old.ref_id);
      items.forEach((i) => cart.add(i));
      router.push("/cart");
    } catch (e) { setErr(errMsg(e)); setBusy(false); }
  };

  return (
    <>
      <TopBar back="/plan" right={<Link href="/plan" className="font-semibold text-navy">다시 짜기</Link>} />
      <Headline className="pt-2" title={nights > 0 ? `${nights}박 ${nights + 1}일 일정` : "하루 일정"}
        sub={first && last ? `${koMD(first)} ${longDay(first)}부터 ${sameMonth ? `${parseDate(last).getDate()}일` : koMD(last)} ${longDay(last)}까지` : undefined} />
      <div className="px-5 pb-6 pt-5">
        <AiBlock title="AI가 고른 이유">{plan.reason}</AiBlock>
        {plan.warnings?.map((w) => <Banner key={w} variant="warn" className="mt-3">{WARN[w] ?? w}</Banner>)}

        <div className="mt-6 border-t border-line">
          {plan.days.map((d) => (
            <section key={d.date} className="pt-6">
              <h2 className="text-[14px] font-semibold text-muted">{koDay(d.date)}</h2>
              {d.items.length === 0 && <p className="mt-3 pl-7 text-[14px] text-muted">자유롭게 쉬어요</p>}
              {d.items.map((it, k) => (
                <div key={k} className="mt-3.5 flex gap-4">
                  <Dot type={it.type} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[16px] font-semibold text-ink">{it.title}</span>
                      {it.price > 0 ? <span className="shrink-0 text-[16px] font-bold text-ink">{won(it.price)}</span> : it.type === "course" ? <span className="shrink-0 text-[15px] font-bold text-navy">무료</span> : null}
                    </div>
                    <div className={cn("mt-1 text-[14px] text-muted")}>{itemMeta(it)}</div>
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
        <p className="mt-6 text-[13.5px] text-muted">코스와 자유 일정은 무료라 장바구니에 담기지 않아요.</p>
        <ErrorBox message={err} className="mt-3" />
      </div>

      <BottomBar>
        <TotalLine label="모두 합해서" amount={won(plan.total_price)} />
        <Button className="mt-3" onClick={() => void addAll()} disabled={busy}>{busy ? "담는 중…" : "장바구니에 모두 담기"}</Button>
      </BottomBar>
    </>
  );
}
