"use client";
// T12 AI 추천 일정 — AI-01 응답(sessionStorage). 코스는 무료(담지 않음), 경고 NO_BUDDY·OVER_BUDGET, 장바구니에 모두 담기
// 버디 줄 '다른 버디 고르기': AI-03 POST /ai/buddy-match(그날·일정 언어·관심사·숙소 대학)로 3명까지 → 고르면 일정의 버디 항목만 바꾼다
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AiBlock, Banner, Button, Icon, LinkButton, Spinner, TopBar, cn } from "@/components/ui";
import { ErrorBox } from "@/components/tourist";
import { errMsg, nightsBetween, okv, parseDate, SS_PLAN, SS_PLAN_BUDDY, SS_PLAN_INPUT } from "@/components/tourist/format";
import { useSS, writeSS } from "@/components/tourist/session";
import { BottomBar, Headline, TotalLine, useHydrated } from "@/components/tourist/v3";
import { DOW, koDay, koDuration, koMD, koRange, langNames, univShort, wa } from "@/components/tourist/v3/flow";
import { get, post, won } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { buddyItemPrice } from "@/lib/codes";
import type { AiPlan, Buddy, BuddyMatch, CartItem, DormRoom, PlanItem, PlanWarning, Tour } from "@/lib/types";

/** 일정을 만들 때 고른 값 (plan 화면이 저장) */
type PlanInput = { check_in: string; check_out: string; interests: string[]; language: "ko" | "en" };
/** 직접 고른 버디: 이 일정(plan_id)의 그 날짜 버디 항목을 item 으로 바꾼다. ai_* = AI가 처음 고른 버디 */
type PlanBuddy = { plan_id: string; date: string; item: PlanItem; ai_ref_id: number; ai_name: string };

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
        const courseItem = it.course_id ? day.items.find((x) => x.type === "course" && x.ref_id === it.course_id) : undefined;
        // 버디가 있으면 코스는 버디 항목(course_id)에만 붙어 있다 → 제목은 TR-02에서
        const course = courseItem ?? (it.course_id ? await okv(get<Tour>(`/tours/${it.course_id}`)).catch(() => null) : null);
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

/** 버디 항목을 고른 버디로: 제목·meta 의 이름과 언어, 가격(시간당 × 시간), ref_id. 코스·시간·날짜는 그대로.
 *  일정 글의 언어(한국어/영어)는 AI-01 이 쓴 그대로 따른다 */
function swapBuddy(it: PlanItem, oldName: string, b: Buddy): PlanItem {
  const lang: "ko" | "en" = it.title.startsWith("버디") || (it.meta ?? "").startsWith("버디") ? "ko" : "en";
  const ko = `버디 ${oldName}`;
  let title: string;
  if (it.title.startsWith(ko)) title = `버디 ${b.name}${wa(b.name)}${it.title.slice(ko.length + 1)}`;
  else if (it.title.endsWith(` ${oldName}`)) title = `${it.title.slice(0, -oldName.length)}${b.name}`;
  else title = lang === "en" ? `Walk the neighborhood with ${b.name}` : `버디 ${b.name}${wa(b.name)} 동네 걷기`;
  const parts = (it.meta ?? "").split(" · ");
  if (parts[0]?.startsWith("버디 ") || parts[0]?.startsWith("Buddy ")) {
    parts[0] = lang === "en" ? `Buddy ${b.name}` : `버디 ${b.name}`;
    if (parts.length > 1) parts[1] = langNames(b.languages, lang);
  }
  return { ...it, ref_id: b.id, title, meta: parts.join(" · "), price: buddyItemPrice(b.hourly_fee ?? 15000, it.duration_min ?? 120) };
}

/** 직접 고른 버디를 일정에 반영 (합계도 바뀐 가격만큼) */
function withBuddy(plan: AiPlan, pick: PlanBuddy | null): AiPlan {
  if (!pick || pick.plan_id !== plan.plan_id) return plan;
  let diff = 0;
  const days = plan.days.map((d) => d.date !== pick.date ? d : {
    ...d, items: d.items.map((it) => { if (it.type !== "buddy") return it; diff = pick.item.price - it.price; return pick.item; }),
  });
  return { ...plan, days, total_price: plan.total_price + diff };
}

type Cand = { b: Buddy; reason: string | null };

/** '다른 버디 고르기' — AI-03 후보 3명까지 + 지금 버디(목록에 없으면 맨 위) */
function BuddyPicker({ date, current, aiRefId, input, stayId, durationMin, moreHref, onPick }: {
  date: string; current: number; aiRefId: number; input: PlanInput | null; stayId: number | null; durationMin: number; moreHref: string;
  onPick: (b: Buddy, oldName: string) => void;
}) {
  const [cands, setCands] = useState<Cand[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const univ = stayId ? await okv(get<DormRoom>(`/dorms/${stayId}`)).then((d) => d.university.id).catch(() => undefined) : undefined;
      const m = await post<BuddyMatch>("/ai/buddy-match", { language: input?.language, date, interests: input?.interests ?? [], university_id: univ });
      // 지금 버디·AI가 고른 버디는 후보에 없어도 맨 위에 둔다 (언제든 되돌릴 수 있게)
      const ids = [...new Set([current, aiRefId].filter((id) => !m.matches.some((x) => x.buddy_id === id)).concat(m.matches.slice(0, 3).map((x) => x.buddy_id)))];
      const reasons = new Map(m.matches.map((x) => [x.buddy_id, x.reason]));
      const rows = await Promise.all(ids.map((id) => okv(get<Buddy>(`/buddies/${id}`)).then((b) => ({ b, reason: reasons.get(id) ?? null })).catch(() => null)));
      if (alive) setCands(rows.filter((r): r is Cand => !!r));
    })().catch((e: unknown) => { if (alive) setErr(errMsg(e)); });
    return () => { alive = false; };
  }, [date, current, aiRefId, input?.language, input?.interests, stayId]);

  const currentName = cands?.find((c) => c.b.id === current)?.b.name ?? "";
  return (
    <div className="mt-3 rounded-[14px] border border-line p-3">
      <div className="px-1 text-[13px] text-muted">{koDay(date)}에 만날 수 있는 버디</div>
      <ErrorBox message={err} className="mt-2" />
      {!cands && !err && <div className="py-3"><Spinner /></div>}
      {cands?.length === 0 && <p className="px-1 py-2 text-[14px] text-muted">그날 만날 수 있는 다른 버디가 없어요.</p>}
      <div className="mt-1.5 space-y-1.5">
        {cands?.map(({ b, reason }) => {
          const on = b.id === current;
          return (
            <button key={b.id} type="button" aria-pressed={on} onClick={() => { if (!on) onPick(b, currentName); }}
              className={cn("w-full rounded-[12px] border px-3 py-2.5 text-left transition", on ? "border-navy bg-navy-bg" : "border-transparent hover:border-line")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 text-[14px] text-muted">
                  <span className="text-[15.5px] font-bold text-ink">{b.name}</span> {univShort(b.university)} · {b.major}
                  {b.review_count > 0 ? <span className="ml-1.5 inline-flex items-center gap-0.5 align-[-2px]"><Icon name="star" className="h-[15px] w-[15px] fill-orange text-orange" />{b.rating.toFixed(1)}</span> : <span className="ml-1.5">새 버디</span>}
                </div>
                <span className="shrink-0 text-[15px] font-bold text-ink">{won(buddyItemPrice(b.hourly_fee ?? 15000, durationMin))}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                {on && <span className="shrink-0 rounded-md bg-navy px-1.5 py-0.5 text-[11.5px] font-semibold text-white">지금</span>}
                {b.id === aiRefId && <span className="shrink-0 rounded-md border border-navy/40 px-1.5 py-0.5 text-[11.5px] font-semibold text-navy">AI 추천</span>}
                {reason && <span className="truncate text-[13.5px] text-navy">{reason}</span>}
              </div>
            </button>
          );
        })}
      </div>
      <Link href={moreHref} className="mt-2 inline-flex items-center gap-0.5 px-1 text-[14px] font-semibold text-navy">버디 목록에서 더 보기<Icon name="chevron-right" className="h-4 w-4" /></Link>
    </div>
  );
}

export default function PlanResultPage() {
  const router = useRouter();
  const cart = useCart();
  const hydrated = useHydrated();
  const saved = useSS<AiPlan | null>(SS_PLAN, null);
  const input = useSS<PlanInput | null>(SS_PLAN_INPUT, null);
  const pick = useSS<PlanBuddy | null>(SS_PLAN_BUDDY, null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!hydrated) return <Spinner />;
  if (!saved) {
    return (
      <>
        <TopBar back="/home" />
        <Headline className="pt-2" title="아직 만든 일정이 없어요" sub="날짜와 관심사만 고르면 AI가 숙소·버디·산책 코스를 묶어 드려요." />
        <div className="px-5 pt-6"><LinkButton href="/plan">일정 만들기</LinkButton></div>
      </>
    );
  }

  const plan = withBuddy(saved, pick);
  const swapped = !!pick && pick.plan_id === saved.plan_id;
  const first = plan.days[0]?.date, last = plan.days[plan.days.length - 1]?.date;
  const stayId = plan.days.flatMap((d) => d.items).find((i) => i.type === "dorm")?.ref_id ?? null;
  const aiBuddy = saved.days.flatMap((d) => d.items).find((i) => i.type === "buddy");
  const moreHref = (date: string, it: PlanItem) => {
    const qs = new URLSearchParams();
    if (stayId && first && last) { qs.set("stay", String(stayId)); qs.set("from", first); qs.set("to", last); }
    if (it.course_id) qs.set("course", String(it.course_id));
    qs.set("date", date);
    return `/buddies?${qs}`;
  };
  const choose = (date: string, it: PlanItem, b: Buddy, oldName: string) => {
    if (!aiBuddy?.ref_id) return;
    const aiName = swapped ? pick.ai_name : oldName;
    // AI가 고른 버디로 돌아가면 직접 고른 표시를 지운다
    writeSS<PlanBuddy>(SS_PLAN_BUDDY, b.id === aiBuddy.ref_id ? null : { plan_id: saved.plan_id, date, item: swapBuddy(it, oldName, b), ai_ref_id: aiBuddy.ref_id, ai_name: aiName });
    setPicking(false);
  };
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
        <AiBlock title="AI가 고른 이유">
          {plan.reason}
          {swapped && <p className="mt-1.5 text-[13.5px] text-muted">직접 고른 버디예요{pick.ai_name ? ` · AI 추천: ${pick.ai_name}` : ""}</p>}
        </AiBlock>
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
                    {it.type === "buddy" && it.ref_id !== null && (
                      <>
                        <button type="button" onClick={() => setPicking((v) => !v)} aria-expanded={picking}
                          className="mt-1.5 inline-flex items-center gap-0.5 text-[14px] font-semibold text-navy">
                          {picking ? "닫기" : "다른 버디 고르기"}<Icon name="chevron-right" className={cn("h-4 w-4 transition", picking ? "-rotate-90" : "rotate-90")} />
                        </button>
                        {picking && <BuddyPicker date={d.date} current={it.ref_id} aiRefId={aiBuddy?.ref_id ?? it.ref_id} input={input} stayId={stayId}
                          durationMin={it.duration_min ?? 120} moreHref={moreHref(d.date, it)} onPick={(b, oldName) => choose(d.date, it, b, oldName)} />}
                      </>
                    )}
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
