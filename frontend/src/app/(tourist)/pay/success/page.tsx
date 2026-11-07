"use client";
// 결제 성공 리다이렉트 — PM-02 POST /payments/confirm (paymentKey · orderId · amount)
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Hero, LinkButton, Spinner } from "@/components/ui";
import { ErrorBox } from "@/components/tourist";
import { errMsg } from "@/components/tourist/format";
import { post } from "@/lib/api";
import { tr, useLang } from "@/lib/i18n";

function Success() {
  useLang();
  const params = useSearchParams();
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const sent = useRef(false);
  const booking = params.get("booking");
  const paymentKey = params.get("paymentKey"), orderId = params.get("orderId"), amount = Number(params.get("amount"));
  const invalid = !paymentKey || !orderId || !amount;

  useEffect(() => {
    if (invalid || sent.current) return;
    sent.current = true; // 개발 모드 이중 실행·새로고침에도 승인 요청은 한 번
    post<{ booking_id: number }>("/payments/confirm", { payment_key: paymentKey, order_id: orderId, amount })
      .then((r) => router.replace(`/cart/done?id=${r.booking_id}`))
      .catch((e: unknown) => setErr(errMsg(e)));
  }, [invalid, paymentKey, orderId, amount, router]);

  return (
    <div className="px-5 pb-6 pt-4 space-y-3">
      {invalid && <ErrorBox message={tr("결제 정보가 올바르지 않아요", "The payment details are invalid")} />}
      {!err && !invalid && <><Spinner /><p className="text-center text-[13px] text-muted">{tr("결제를 승인하는 중이에요…", "Confirming your payment…")}</p></>}
      <ErrorBox message={err} />
      {(err || invalid) && booking && <LinkButton href={`/pay?booking=${booking}`}>{tr("다시 결제하기", "Try paying again")}</LinkButton>}
      {(err || invalid) && <LinkButton href="/trips" variant="ghost">{tr("내 여행으로", "Go to My trips")}</LinkButton>}
    </div>
  );
}

export default function PaySuccessPage() {
  useLang();
  return (<><Hero title={tr("결제", "Payment")} sub={tr("결제 확인", "Confirming payment")} /><Suspense fallback={<Spinner />}><Success /></Suspense></>);
}
