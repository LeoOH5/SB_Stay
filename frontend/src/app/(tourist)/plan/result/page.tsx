"use client";
// T3 AI 추천 일정 — AI-01 응답(sessionStorage), 장바구니 담기
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AiBlock, Button, Card, Hero, LinkButton } from "@/components/ui";
import { TypeBadge } from "@/components/tourist";
import { dayLabel, nightsBetween, SS_PLAN } from "@/components/tourist/format";
import { useSS } from "@/components/tourist/session";
import { won } from "@/lib/api";
import { useCart } from "@/lib/cart";
import type { AiPlan, CartItem, ItemType } from "@/lib/types";

const isBookable = (t: ItemType | "free"): t is ItemType => t === "dorm" || t === "tour" || t === "buddy";

/** 일정 항목(dorm/tour/buddy) → CartItem. dorm 은 첫날~마지막날, tour/buddy 는 그 날짜·시간 */
function planToCart(plan: AiPlan): CartItem[] {
  const first = plan.days[0]?.date;
  const last = plan.days[plan.days.length - 1]?.date;
  const out: CartItem[] = [];
  for (const day of plan.days) {
    for (const it of day.items) {
      if (!isBookable(it.type) || it.ref_id === null) continue;
      const base = { ref_id: it.ref_id, title: it.title, meta: it.meta ?? "", price: it.price };
      if (it.type === "dorm") out.push({ type: "dorm", ...base, date_from: first ?? day.date, date_to: last ?? day.date, guests: 1 });
      else out.push({ type: it.type, ...base, date: day.date, time: it.time ?? "10:00", duration_min: it.type === "buddy" ? 120 : undefined });
    }
  }
  return out;
}

export default function PlanResultPage() {
  const router = useRouter();
  const cart = useCart();
  const plan = useSS<AiPlan | null>(SS_PLAN, null);

  if (!plan) {
    return (
      <>
        <Hero title="Your plan" />
        <div className="px-5 pb-6 pt-4 space-y-3">
          <Card tint className="text-center py-8"><div className="text-[14px] text-ink">아직 만든 일정이 없어요.</div><LinkButton href="/plan" className="mt-4">AI로 여행 설계하기</LinkButton></Card>
        </div>
      </>
    );
  }

  const nights = plan.days.length > 1 ? nightsBetween(plan.days[0].date, plan.days[plan.days.length - 1].date) : 0;
  const addAll = () => {
    planToCart(plan).forEach((i) => cart.add(i));
    router.push("/cart");
  };

  return (
    <>
      <Hero title={`Your ${nights}-night plan`} sub={`${plan.days[0]?.date ?? ""} – ${plan.days[plan.days.length - 1]?.date ?? ""}`}
        right={<Link href="/plan" className="rounded-lg bg-green px-2.5 py-1 text-[12px] font-semibold text-navy">다시 짜기</Link>} />
      <div className="px-5 pb-6 pt-4 space-y-3">
        <AiBlock title="추천 이유">{plan.reason}</AiBlock>
        <div className="space-y-1">
          {plan.days.map((d) => (
            <div key={d.date} className="pt-2">
              <div className="text-[13px] font-semibold text-navy mb-1">{dayLabel(d.date)}</div>
              {d.items.map((it, k) => (
                <div key={k} className="flex items-start gap-3 py-1.5">
                  <span className="w-12 shrink-0 text-[12px] text-muted pt-0.5">{it.time ?? "자유"}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><span className="text-[14px] text-ink">{it.title}</span>{isBookable(it.type) && <TypeBadge type={it.type} className="px-2 py-0.5 text-[10px]" />}</div>
                    <div className="text-[12px] text-muted">{it.meta}{it.price > 0 ? ` · ${won(it.price)}` : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-end justify-between pt-1"><span className="text-[13px] text-muted">예상 합계</span><span className="text-[22px] font-bold text-navy">{won(plan.total_price)}</span></div>
        <p className="text-[12px] text-muted">자유 일정은 장바구니에 담기지 않아요.</p>
        <Button onClick={addAll}>모두 장바구니에 담기</Button>
      </div>
    </>
  );
}
