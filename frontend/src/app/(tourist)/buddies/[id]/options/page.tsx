"use client";
// T19 식사 맡기기(0~4회, 보증금 = 횟수 × 20,000) · 여행 앨범(5,000) → 버디 항목 하나를 장바구니에 담는다
// 가격 = buddyItemPrice(hourly_fee, 시간, meal_count, album) — src/lib/codes.ts
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Icon, Spinner, Stepper, TopBar } from "@/components/ui";
import { ErrorBox } from "@/components/tourist";
import { errMsg, okv } from "@/components/tourist/format";
import { useSS } from "@/components/tourist/session";
import { BottomBar, Headline, OutlineBox, Toggle, TotalLine, useHydrated } from "@/components/tourist/v3";
import { SS_BUDDY_DRAFT, buddiesIn, clearDraft, iga, koDay, koDuration, saveDraft, wa, type BuddyDraft } from "@/components/tourist/v3/flow";
import { get, won } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { ALBUM_FEE, MEAL_LIMIT, MEAL_MAX, buddyItemPrice, requestChips } from "@/lib/codes";
import type { Buddy, BuddyRequestBody, Tour } from "@/lib/types";

const DURATION = 120;

export default function BuddyOptionsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const cart = useCart();
  const hydrated = useHydrated();
  const stored = useSS<BuddyDraft | null>(SS_BUDDY_DRAFT, null);
  const draft = stored && stored.buddy_id === Number(id) ? stored : null;
  const [buddy, setBuddy] = useState<Buddy | null>(null);
  const [course, setCourse] = useState<Tour | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const courseId = draft?.course_id ?? null;

  useEffect(() => {
    let alive = true;
    okv(get<Buddy>(`/buddies/${id}`)).then((b) => { if (alive) setBuddy(b); }).catch((e: unknown) => { if (alive) setErr(errMsg(e)); });
    return () => { alive = false; };
  }, [id]);
  useEffect(() => {
    if (courseId === null) return;
    let alive = true;
    okv(get<Tour>(`/tours/${courseId}`)).then((t) => { if (alive) setCourse(t); }).catch(() => { /* 코스 이름은 보조 */ });
    return () => { alive = false; };
  }, [courseId]);

  if (!hydrated) return <Spinner />;
  if (!draft) {
    return (
      <>
        <TopBar back={`/buddies/${id}`} />
        <div className="px-5 py-10 text-center">
          <p className="text-[15px] text-muted">버디와 만날 날짜를 먼저 골라 주세요.</p>
          <Link href={`/buddies/${id}`} className="mt-3 inline-block text-[15px] font-semibold text-navy">버디 보러 가기</Link>
        </div>
      </>
    );
  }

  const fee = buddy?.hourly_fee ?? 15000;
  const walk = buddyItemPrice(fee, DURATION);
  const meals = draft.meal_count * MEAL_LIMIT;
  const total = buddyItemPrice(fee, DURATION, draft.meal_count, draft.album);
  const reqText = requestChips(draft.request).filter((c) => !c.includes("천천히"));
  const set = (patch: Partial<BuddyDraft>) => saveDraft({ ...draft, ...patch });

  const addToCart = () => {
    if (!buddy) return;
    const r = draft.request;
    const hasReq = r.diet.length || r.allergies.length || r.pace === "slow" || r.places.length || r.note.trim();
    const request: BuddyRequestBody | null = hasReq ? { ...r, note: r.note.trim() } : null;
    const tourCourse = course && course.id === draft.course_id ? course : null;
    // 버디 항목은 하나 — 이미 담긴 버디는 바꾼다
    buddiesIn(cart.items).forEach((i) => cart.remove("buddy", i.ref_id));
    cart.add({
      type: "buddy", ref_id: buddy.id, title: `${buddy.name}${wa(buddy.name)} 동네 걷기`,
      meta: `${koDay(draft.date)} ${draft.time}, ${koDuration(DURATION)}${tourCourse ? ` · ${tourCourse.title}` : ""}`,
      price: total, date: draft.date, time: draft.time, duration_min: DURATION,
      request, course_id: draft.course_id, course_title: tourCourse?.title ?? null,
      meal_count: draft.meal_count, album: draft.album, hourly_fee: fee, university_id: buddy.university_id,
    });
    clearDraft();
    router.push("/cart");
  };

  return (
    <>
      <TopBar back={`/buddies/${id}/request`} />
      <Headline className="pt-2" title="식사와 사진" sub="필요한 것만 더해요. 둘 다 안 골라도 돼요." />
      <div className="space-y-4 px-5 pb-6 pt-6">
        <ErrorBox message={err} />
        <OutlineBox>
          <div className="flex gap-3">
            <Icon name="fork" className="mt-0.5 h-[22px] w-[22px] text-ink" />
            <div>
              <div className="text-[16px] font-semibold text-ink">식사 맡기기</div>
              <p className="mt-1 text-[14.5px] leading-relaxed text-muted">{buddy ? `${buddy.name}${iga(buddy.name)}` : "버디가"} 식당을 고르고 먼저 계산해요. 영수증만큼만 쓰고 남은 돈은 돌려드려요.</p>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-between">
            <span className="text-[15px] text-ink">식사 횟수</span>
            <div className="rounded-[14px] border border-line px-2 py-1.5">
              <Stepper label="식사 횟수" value={draft.meal_count} min={0} max={MEAL_MAX} onChange={(meal_count) => set({ meal_count })} className="[&_button]:border-0" />
            </div>
          </div>
          <div className="mt-4 divide-y divide-line text-[15px]">
            <div className="flex justify-between py-3"><span className="text-muted">1회 한도 (2인)</span><span className="font-bold text-ink">{won(MEAL_LIMIT)}</span></div>
            <div className="flex justify-between py-3"><span className="text-muted">미리 맡기는 금액</span><span className="font-bold text-ink">{won(meals)}</span></div>
          </div>
          <p className="mt-2 text-[13.5px] text-muted">수수료 없음{reqText.length ? ` · ${reqText.join(", ")}가 버디에게 전달돼요` : ""}</p>
        </OutlineBox>

        <OutlineBox>
          <div className="flex items-start gap-3">
            <Icon name="camera" className="mt-0.5 h-[22px] w-[22px] text-ink" />
            <div className="min-w-0 flex-1">
              <div className="text-[16px] font-semibold text-ink">여행 앨범</div>
              <p className="mt-1 text-[14.5px] leading-relaxed text-muted">{buddy ? `${buddy.name}${iga(buddy.name)}` : "버디가"} 찍어 준 사진을 앨범으로 모아 드려요.</p>
            </div>
            <Toggle label="여행 앨범" checked={draft.album} onChange={(album) => set({ album })} />
          </div>
          <div className="mt-4 flex justify-between border-t border-line pt-3 text-[15px]"><span className="text-muted">앨범</span><span className="font-bold text-ink">{won(ALBUM_FEE)}</span></div>
        </OutlineBox>
        <p className="text-[14px] text-muted">식사 기록과 사진은 여행이 끝나도 내 여행에 남아요.</p>
      </div>

      <BottomBar>
        <p className="text-[14px] text-muted">버디 {won(walk)}{draft.meal_count ? ` + 식사 ${won(meals)}` : ""}{draft.album ? ` + 앨범 ${won(ALBUM_FEE)}` : ""}</p>
        <TotalLine className="mt-1.5" label="버디 합계" amount={won(total)} />
        <Button className="mt-3" onClick={addToCart} disabled={!buddy}>장바구니에 담기</Button>
      </BottomBar>
    </>
  );
}
