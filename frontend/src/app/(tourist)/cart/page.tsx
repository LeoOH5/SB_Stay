"use client";
// T13 장바구니 — 숙박 + 버디 규칙(버디 1명 필수 · 버디 날짜는 숙박 기간 안) 확인 → BK-01 POST /bookings (여행자 정보 없으면 /checkout)
// 버디가 없으면(T13b) 신청 버튼을 막고 같은 대학 버디 고르기로 보낸다
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Banner, Button, LinkButton, ListRow, Spinner, TagChip, TopBar } from "@/components/ui";
import { ErrorBox } from "@/components/tourist";
import { submitBooking } from "@/components/tourist/booking";
import { loginHref, nightsBetween, okv, SS_TRAVELER } from "@/components/tourist/format";
import { useSS } from "@/components/tourist/session";
import { BottomBar, Headline, TotalLine, useHydrated } from "@/components/tourist/v3";
import { EMPTY_REQUEST, bookingErr, buddiesIn, iga, inStay, isBuddyRequest, isDormRequest, koDay, koDuration, koRange, saveDraft, stayIn, univShort } from "@/components/tourist/v3/flow";
import { get, won } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { ALBUM_FEE, DORM_REQUEST, MEAL_LIMIT, keysOf, label, requestChips } from "@/lib/codes";
import type { Buddy, CartItem, DormRoom, ListResponse, Traveler } from "@/lib/types";

const NATION_KO: Record<string, string> = { US: "미국", JP: "일본", KR: "한국", FR: "프랑스", DE: "독일", AU: "호주", CN: "중국", GB: "영국", OTHER: "기타" };

function RemoveBtn({ onClick, what }: { onClick: () => void; what: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={`${what} 빼기`} className="-mr-1.5 flex h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-gray-bg">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
    </button>
  );
}

/** "지우와 동네 걷기" → "지우" */
const buddyName = (i: CartItem) => i.title.replace(/(와|과) 동네 걷기$/, "").replace(/^버디 /, "").split(" ")[0];

export default function CartPage() {
  const router = useRouter();
  const cart = useCart();
  const hydrated = useHydrated();
  const { user } = useUser();
  const traveler = useSS<Traveler | null>(SS_TRAVELER, null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [univ, setUniv] = useState<{ id: number; name: string } | null>(null);
  const [sameUniv, setSameUniv] = useState<number | null>(null);

  const stay = stayIn(cart.items);
  const dorms = cart.items.filter((i) => i.type === "dorm");
  const buddies = buddiesIn(cart.items);
  const outside = stay ? buddies.filter((b) => !inStay(stay, b.date)) : [];
  const missing = !!stay && buddies.length === 0;
  const blocked = missing || outside.length > 0 || dorms.length > 1;
  const stayKey = stay ? `${stay.ref_id}|${stay.date_from}|${stay.date_to}` : "";

  // 숙박 대학 + 그 기간에 만날 수 있는 같은 대학 버디 수 (T13b)
  useEffect(() => {
    if (!stayKey) return;
    const [ref, from, to] = stayKey.split("|");
    let alive = true;
    okv(get<DormRoom>(`/dorms/${ref}`)).then(async (d) => {
      if (!alive) return;
      setUniv({ id: d.university.id, name: d.university.name });
      const r = await get<ListResponse<Buddy>>("/buddies", { university_id: d.university.id });
      if (alive) setSameUniv(r.items.filter((b) => b.available_dates.some((x) => from <= x && x <= to)).length);
    }).catch(() => { /* 안내 문구만 영향 */ });
    return () => { alive = false; };
  }, [stayKey]);

  const pickHref = stay ? `/buddies?stay=${stay.ref_id}&from=${stay.date_from}&to=${stay.date_to}` : "/buddies";
  const editBuddy = (i: CartItem) => {
    saveDraft({ buddy_id: i.ref_id, date: i.date ?? "", time: i.time ?? "14:00", course_id: i.course_id ?? null, request: isBuddyRequest(i.request) ? i.request : EMPTY_REQUEST, meal_count: i.meal_count ?? 0, album: !!i.album });
    router.push(`/buddies/${i.ref_id}/request`);
  };

  const submit = async () => {
    if (cart.items.length === 0 || blocked) return;
    if (!user) { router.push(loginHref("/cart")); return; }
    if (!traveler) { router.push("/checkout"); return; }
    setBusy(true); setErr(null);
    try {
      const { booking, needsPayment } = await submitBooking(traveler, cart.items);
      router.push(needsPayment ? `/pay?booking=${booking.id}` : `/cart/done?id=${booking.id}`);
    } catch (e) { setErr(bookingErr(e)); setBusy(false); }
  };

  if (!hydrated) return <Spinner />;

  const nights = stay ? nightsBetween(stay.date_from!, stay.date_to!) : 0;
  const ruleBanner = dorms.length > 1
    ? <Banner variant="warn">숙박은 한 번에 한 곳만 신청할 수 있어요. 하나만 남겨 주세요</Banner>
    : missing
      ? <Banner variant="warn">기숙사 숙박에는 버디가 1명 필요해요. 숙박 기간({koRange(stay!.date_from, stay!.date_to)}) 안에서 골라 주세요</Banner>
      : outside.length
        ? <Banner variant="warn">버디 날짜({koDay(outside[0].date)})가 숙박 기간({koRange(stay!.date_from, stay!.date_to)}) 밖이에요. 기간 안으로 다시 골라 주세요</Banner>
        : stay
          ? <Banner icon="check">숙박 {nights}박에 버디 {buddies.length}명 · 버디 날짜가 숙박 기간 안이에요</Banner>
          : null;

  return (
    <>
      <TopBar back="/home" />
      <Headline className="pt-2" title="장바구니" sub="숙박과 버디를 한 번에 신청해요." />

      {cart.items.length === 0 ? (
        <div className="px-5 pb-8 pt-8">
          <p className="text-[16px] font-semibold text-ink">아직 담은 게 없어요</p>
          <p className="mt-1 text-[14.5px] text-muted">AI에게 일정을 맡기거나 직접 골라 보세요.</p>
          <LinkButton href="/plan" className="mt-5">AI에게 일정 맡기기</LinkButton>
          <div className="mt-4 divide-y divide-line">
            <ListRow href="/stay" icon="bed" title="기숙사 숙박" meta="버디 1명과 함께 신청해요" />
            <ListRow href="/buddies" icon="users" title="대학생 버디만" meta="숙박 없이 동네 걷기만 해도 돼요" />
          </div>
        </div>
      ) : (
        <div className="px-5 pt-6">
          {ruleBanner}

          <div className="mt-2 divide-y divide-line">
            {dorms.map((i) => {
              const req = isDormRequest(i.request) ? keysOf(DORM_REQUEST).filter((k) => (i.request as Record<string, boolean>)[k]).map((k) => label(DORM_REQUEST, k)) : [];
              return (
                <div key={`dorm-${i.ref_id}`} className="py-5">
                  <div className="flex items-center justify-between gap-3"><TagChip variant="outline" className="h-6 px-2 text-[12px]">숙박</TagChip><span className="text-[17px] font-bold text-ink">{won(i.price)}</span></div>
                  <div className="mt-2 flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/stay/${i.ref_id}`} className="text-[16px] font-semibold text-ink">{i.title}</Link>
                      <div className="mt-1.5 text-[15px] text-muted">{koRange(i.date_from, i.date_to)}, {nightsBetween(i.date_from!, i.date_to!)}박</div>
                      <div className="mt-1.5 text-[13.5px] text-muted">대학 담당자가 승인해요{req.length ? ` · 요청: ${req.join(", ")}` : ""}</div>
                    </div>
                    <RemoveBtn what="숙박" onClick={() => cart.remove("dorm", i.ref_id)} />
                  </div>
                </div>
              );
            })}

            {buddies.map((i) => {
              const name = buddyName(i);
              const extras = [i.meal_count ? `식사 ${i.meal_count}회 ${won(i.meal_count * MEAL_LIMIT)}` : "", i.album ? `앨범 ${won(ALBUM_FEE)}` : ""].filter(Boolean).join(" · ");
              const chips = isBuddyRequest(i.request) ? requestChips(i.request) : [];
              const bad = stay && !inStay(stay, i.date);
              return (
                <div key={`buddy-${i.ref_id}`} className="py-5">
                  <div className="flex items-center justify-between gap-3"><TagChip variant="outline" className="h-6 px-2 text-[12px]">버디</TagChip><span className="text-[17px] font-bold text-ink">{won(i.price)}</span></div>
                  <div className="mt-2 flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <button type="button" onClick={() => editBuddy(i)} className="text-left text-[16px] font-semibold text-ink">{i.title}</button>
                      <div className={`mt-1.5 text-[15px] ${bad ? "font-semibold text-orange-ink" : "text-muted"}`}>{koDay(i.date)} {i.time}, {koDuration(i.duration_min)}</div>
                      {i.course_title && <div className="mt-1 text-[15px] text-muted">코스: {i.course_title}</div>}
                      {extras && <div className="mt-1 text-[15px] text-muted">{extras} 포함</div>}
                      {chips.length > 0 && <div className="mt-2.5 flex flex-wrap gap-1.5">{chips.map((c) => <TagChip key={c}>{c}</TagChip>)}</div>}
                      <div className="mt-2 flex items-center gap-3 text-[13.5px]">
                        <span className="text-muted">{name ? `${name}${iga(name)} 수락해요` : "버디가 수락해요"}</span>
                        <button type="button" onClick={() => (bad ? router.push(`/buddies/${i.ref_id}?from=${stay!.date_from}&to=${stay!.date_to}`) : editBuddy(i))} className="font-semibold text-navy">{bad ? "날짜 바꾸기" : "요청·옵션 바꾸기"}</button>
                      </div>
                    </div>
                    <RemoveBtn what="버디" onClick={() => cart.remove("buddy", i.ref_id)} />
                  </div>
                </div>
              );
            })}

            {missing && (
              <div className="flex items-center gap-3 py-5">
                <div className="min-w-0 flex-1">
                  <TagChip variant="outline" className="h-6 px-2 text-[12px]">버디</TagChip>
                  <div className="mt-2 text-[16px] font-semibold text-ink">아직 고르지 않았어요</div>
                  <div className="mt-1.5 text-[14.5px] text-muted">{univ && sameUniv !== null ? (sameUniv > 0 ? `같은 ${univShort(univ.name)} 버디 ${sameUniv}명이 이 기간에 가능해요` : "이 기간에 가능한 다른 학교 버디를 찾아 드려요") : "같은 학교 버디를 먼저 보여 드려요"}</div>
                </div>
                <LinkButton href={pickHref} variant="secondary" full={false} className="min-h-[48px] shrink-0 px-5">버디 고르기</LinkButton>
              </div>
            )}

            {!blocked && (
              <>
                <div className="flex items-center gap-3 py-5">
                  <div className="min-w-0 flex-1">
                    <div className="text-[16px] font-semibold text-ink">여행자 정보</div>
                    <div className="mt-1.5 text-[15px] text-muted">{traveler ? `${traveler.name} · ${NATION_KO[traveler.nationality] ?? traveler.nationality}` : "아직 입력하지 않았어요"}</div>
                  </div>
                  <Link href="/checkout" className="shrink-0 text-[15px] font-semibold text-navy">{traveler ? "수정" : "입력"}</Link>
                </div>
                <div className="py-5">
                  <div className="text-[16px] font-semibold text-ink">결제 수단</div>
                  <div className="mt-1.5 text-[15px] text-muted">다음 단계에서 국내 카드·간편결제 또는 해외 카드·PayPal 중에 골라요</div>
                </div>
              </>
            )}
          </div>
          {!blocked && <p className="pb-6 text-[14px] leading-relaxed text-muted">환불은 체크인 7일 전까지 전액, 3일 전까지 절반, 그 뒤에는 안 돼요. 식사비는 쓰고 남은 만큼 돌려드려요.</p>}
          <ErrorBox message={err} className="mb-6" />
        </div>
      )}

      {cart.items.length > 0 && (
        <BottomBar>
          <TotalLine label={`합계 ${cart.items.length}개`} amount={won(cart.total)} />
          {!blocked && <p className="mt-1 text-[13px] text-muted">{stay ? "대학과 버디가 모두 수락하면 결제가 확정돼요" : "버디가 수락하면 결제가 확정돼요"}</p>}
          <Button className="mt-3" onClick={() => void submit()} disabled={busy || blocked}>
            {missing ? "버디를 고르면 신청할 수 있어요" : outside.length ? "버디 날짜를 숙박 기간 안으로 바꿔 주세요" : dorms.length > 1 ? "숙박을 하나만 남겨 주세요" : busy ? "신청 중…" : "예약 신청하기"}
          </Button>
          {!user && !blocked && <p className="mt-2 text-center text-[13px] text-muted">예약 신청에는 로그인이 필요해요. <Link href={loginHref("/cart")} className="font-semibold text-navy">로그인</Link></p>}
        </BottomBar>
      )}
    </>
  );
}
