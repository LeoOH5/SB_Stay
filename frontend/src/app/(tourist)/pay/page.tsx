"use client";
// 결제 — 국내: 토스 결제위젯 (PM-01 prepare → /pay/success 에서 PM-02 confirm)
//        외국인: PayPal 버튼 (PM-04 주문 생성 → 승인 → PM-05 캡처). PM-06 으로 서버에 켜진 수단 확인
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Button, Card, Chip, Hero, Spinner } from "@/components/ui";
import { ErrorBox } from "@/components/tourist";
import { errMsg, okv } from "@/components/tourist/format";
import { get, post, won } from "@/lib/api";
import { money, tr, useLang } from "@/lib/i18n";
import { loadPayPal, PAYPAL_CLIENT_ID } from "@/lib/paypal";
import { loadTossPayments, TOSS_CLIENT_KEY, type PaymentOrder } from "@/lib/toss";
import type { Booking } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Method = "toss" | "paypal";
interface Methods { toss: boolean; paypal: boolean; usd_krw_rate: number }

function Pay() {
  const params = useSearchParams();
  const router = useRouter();
  const { lang, currency } = useLang();
  const bookingId = Number(params.get("booking"));
  const [booking, setBooking] = useState<Booking | null>(null);
  const [avail, setAvail] = useState<Methods | null>(null);
  const [picked, setPicked] = useState<Method | null>(null);
  const [tossOrder, setTossOrder] = useState<PaymentOrder | null>(null);
  const [tossReady, setTossReady] = useState(false);
  const [paypalReady, setPaypalReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const widgets = useRef<any>(null);
  const tossStarted = useRef(false);
  const paypalStarted = useRef(false);

  // 예약 금액 + 서버에 켜진 결제수단
  useEffect(() => {
    if (!bookingId) return;
    let alive = true;
    Promise.all([okv(get<Booking>(`/bookings/${bookingId}`)), get<Methods>("/payments/methods")])
      .then(([b, m]) => { if (!alive) return; setBooking(b); setAvail({ ...m, toss: m.toss && !!TOSS_CLIENT_KEY, paypal: m.paypal && !!PAYPAL_CLIENT_ID }); })
      .catch((e: unknown) => { if (alive) setErr(errMsg(e)); });
    return () => { alive = false; };
  }, [bookingId]);

  // 고르지 않았으면 언어 기준 기본값 (영어 → PayPal)
  const method: Method | null = picked ?? (avail ? (lang === "en" && avail.paypal ? "paypal" : avail.toss ? "toss" : avail.paypal ? "paypal" : null) : null);

  // 토스 위젯 (처음 고를 때 한 번만)
  useEffect(() => {
    if (method !== "toss" || tossStarted.current || !booking) return;
    tossStarted.current = true;
    (async () => {
      try {
        const o = await post<PaymentOrder>("/payments/prepare", { booking_id: booking.id });
        setTossOrder(o);
        const TossPayments = await loadTossPayments();
        const w = TossPayments(TOSS_CLIENT_KEY).widgets({ customerKey: o.customer_key });
        await w.setAmount({ currency: "KRW", value: o.amount });
        await Promise.all([
          w.renderPaymentMethods({ selector: "#payment-method", variantKey: "DEFAULT" }),
          w.renderAgreement({ selector: "#agreement", variantKey: "AGREEMENT" }),
        ]);
        widgets.current = w;
        setTossReady(true);
      } catch (e) { setErr(errMsg(e)); }
    })();
  }, [method, booking]);

  // PayPal 버튼 (처음 고를 때 한 번만). 주문 생성·캡처는 모두 서버에서
  useEffect(() => {
    if (method !== "paypal" || paypalStarted.current || !booking) return;
    paypalStarted.current = true;
    (async () => {
      try {
        const paypal = await loadPayPal();
        await paypal.Buttons({
          style: { layout: "vertical", shape: "rect", label: "pay" },
          createOrder: async () => {
            setErr(null);
            const o = await post<{ paypal_order_id: string }>("/payments/paypal/orders", { booking_id: booking.id });
            return o.paypal_order_id;
          },
          onApprove: async (data: { orderID: string }) => {
            setBusy(true);
            try {
              const r = await post<{ booking_id: number }>("/payments/paypal/capture", { paypal_order_id: data.orderID });
              router.replace(`/cart/done?id=${r.booking_id}`);
            } catch (e) { setErr(errMsg(e)); setBusy(false); }
          },
          onCancel: () => setErr(lang === "en" ? "Payment was cancelled." : "결제를 취소했어요"),
          onError: (e: unknown) => setErr(errMsg(e)),
        }).render("#paypal-buttons");
        setPaypalReady(true);
      } catch (e) { setErr(errMsg(e)); }
    })();
  }, [method, booking, router, lang]);

  const payToss = async () => {
    if (!widgets.current || !tossOrder) return;
    setBusy(true); setErr(null);
    const origin = window.location.origin;
    try {
      await widgets.current.requestPayment({
        orderId: tossOrder.order_id, orderName: tossOrder.order_name,
        customerName: tossOrder.customer_name, customerEmail: tossOrder.customer_email,
        successUrl: `${origin}/pay/success?booking=${tossOrder.booking_id}`,
        failUrl: `${origin}/pay/fail?booking=${tossOrder.booking_id}`,
      });
    } catch (e) { setErr(errMsg(e)); setBusy(false); }
  };

  if (!bookingId) return <div className="px-5 pt-4"><ErrorBox message={tr("결제할 예약이 없어요", "No booking to pay for")} /></div>;
  const usd = booking && avail ? Math.ceil((booking.total_price / avail.usd_krw_rate) * 100) / 100 : null;

  return (
    <div className="px-5 pb-6 pt-4 space-y-3">
      {booking && (
        <Card className="flex items-center justify-between gap-3">
          <div className="min-w-0"><div className="text-[12px] text-muted">{lang === "en" ? "Booking" : "예약"} {booking.code}</div><div className="text-[13px] text-ink break-keep">{booking.items.map((i) => i.title).join(" · ")}</div></div>
          <div className="shrink-0 text-right">
            <div className="text-[20px] font-bold text-navy">{money(booking.total_price)}</div>
            {method === "paypal" && usd !== null && currency !== "USD" && <div className="text-[12px] text-muted">≈ ${usd.toFixed(2)} USD</div>}
          </div>
        </Card>
      )}

      {avail && avail.toss && avail.paypal && (
        <div className="grid grid-cols-2 gap-2">
          <Chip selected={method === "toss"} onClick={() => setPicked("toss")} className="justify-center">{tr("국내 카드·간편결제", "Korean card · easy pay")}</Chip>
          <Chip selected={method === "paypal"} onClick={() => setPicked("paypal")} className="justify-center">Overseas card · PayPal</Chip>
        </div>
      )}
      {avail && !avail.toss && !avail.paypal && <ErrorBox message={tr("사용할 수 있는 결제수단이 없어요. 결제 키 설정을 확인해 주세요.", "No payment method is available. Please check the payment key settings.")} />}
      {!avail && !err && <Spinner />}

      {/* 두 영역 모두 그려 두고 숨기기만 한다 (위젯이 다시 그려지지 않게) */}
      <div className={method === "toss" ? "space-y-3" : "hidden"}>
        {!tossReady && !err && method === "toss" && <Spinner />}
        <div id="payment-method" />
        <div id="agreement" />
        {tossReady && tossOrder && <Button onClick={payToss} disabled={busy}>{busy ? tr("결제창 여는 중…", "Opening payment…") : tr(`${won(tossOrder.amount)} 결제하기`, `Pay ${won(tossOrder.amount)}`)}</Button>}
      </div>
      <div className={method === "paypal" ? "space-y-3" : "hidden"}>
        {!paypalReady && !err && method === "paypal" && <Spinner />}
        <p className="text-[13px] leading-relaxed text-ink">Pay in USD with PayPal or any international credit/debit card. No PayPal account needed for card payments.</p>
        <div id="paypal-buttons" />
        {busy && <p className="text-center text-[13px] text-muted">Confirming payment…</p>}
      </div>

      <ErrorBox message={err} />
      <p className="text-[12px] leading-relaxed text-muted">
        {method === "paypal"
          ? `Charged in USD at a fixed rate of ₩${avail?.usd_krw_rate.toLocaleString() ?? "1,400"} = $1. Refunds follow the same policy in USD.`
          : tr("테스트 결제는 실제로 돈이 빠져나가지 않아요. 숙박·버디가 거절되면 해당 금액은 환불돼요.", "Test payments don't charge real money. If a stay or buddy is declined, that amount is refunded. Korean cards are charged in KRW.")}
      </p>
    </div>
  );
}

export default function PayPage() {
  useLang();
  return (
    <>
      <Hero back="/trips" title={tr("결제", "Payment")} sub={tr("국내 결제는 토스페이먼츠, 해외 카드는 PayPal", "Korean cards via Toss Payments, international cards via PayPal")} />
      <Suspense fallback={<Spinner />}><Pay /></Suspense>
    </>
  );
}
