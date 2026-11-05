"use client";
// 결제 — PM-01 POST /payments/prepare → 토스 결제위젯 → 성공 시 /pay/success 에서 PM-02 승인
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Button, Card, Hero, Spinner } from "@/components/ui";
import { ErrorBox } from "@/components/tourist";
import { errMsg } from "@/components/tourist/format";
import { post, won } from "@/lib/api";
import { loadTossPayments, TOSS_CLIENT_KEY, type PaymentOrder } from "@/lib/toss";

/* eslint-disable @typescript-eslint/no-explicit-any */
function Pay() {
  const params = useSearchParams();
  const bookingId = Number(params.get("booking"));
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const widgets = useRef<any>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!bookingId || started.current) return;
    started.current = true; // 개발 모드에서 두 번 실행돼 위젯이 두 번 그려지는 것 방지
    (async () => {
      try {
        const o = await post<PaymentOrder>("/payments/prepare", { booking_id: bookingId });
        setOrder(o);
        const TossPayments = await loadTossPayments();
        const w = TossPayments(TOSS_CLIENT_KEY).widgets({ customerKey: o.customer_key });
        await w.setAmount({ currency: "KRW", value: o.amount });
        await Promise.all([
          w.renderPaymentMethods({ selector: "#payment-method", variantKey: "DEFAULT" }),
          w.renderAgreement({ selector: "#agreement", variantKey: "AGREEMENT" }),
        ]);
        widgets.current = w;
        setReady(true);
      } catch (e) { setErr(errMsg(e)); }
    })();
  }, [bookingId]);

  const pay = async () => {
    if (!widgets.current || !order) return;
    setBusy(true); setErr(null);
    const origin = window.location.origin;
    try {
      await widgets.current.requestPayment({
        orderId: order.order_id, orderName: order.order_name,
        customerName: order.customer_name, customerEmail: order.customer_email,
        successUrl: `${origin}/pay/success?booking=${order.booking_id}`,
        failUrl: `${origin}/pay/fail?booking=${order.booking_id}`,
      });
    } catch (e) { setErr(errMsg(e)); setBusy(false); }
  };

  if (!bookingId) return <div className="px-5 pt-4"><ErrorBox message="결제할 예약이 없어요" /></div>;
  return (
    <div className="px-5 pb-6 pt-4 space-y-3">
      {order && (
        <Card className="flex items-center justify-between gap-3">
          <div className="min-w-0"><div className="text-[12px] text-muted">주문</div><div className="text-[14px] font-semibold text-ink break-keep">{order.order_name}</div></div>
          <div className="shrink-0 text-[20px] font-bold text-navy">{won(order.amount)}</div>
        </Card>
      )}
      {!ready && !err && <Spinner />}
      <div id="payment-method" />
      <div id="agreement" />
      <ErrorBox message={err} />
      {ready && order && <Button onClick={pay} disabled={busy}>{busy ? "결제창 여는 중…" : `${won(order.amount)} 결제하기`}</Button>}
      <p className="text-[12px] leading-relaxed text-muted">테스트 결제는 실제로 돈이 빠져나가지 않아요. 숙박·버디가 거절되면 해당 금액은 환불돼요.</p>
    </div>
  );
}

export default function PayPage() {
  return (
    <>
      <Hero back="/trips" title="Payment" sub="토스페이먼츠로 안전하게 결제해요" />
      <Suspense fallback={<Spinner />}><Pay /></Suspense>
    </>
  );
}
