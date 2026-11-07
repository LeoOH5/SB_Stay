"use client";
// 결제 실패·취소 리다이렉트 (code · message)
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Card, Hero, LinkButton, Spinner } from "@/components/ui";
import { tr, useLang } from "@/lib/i18n";

function Fail() {
  useLang();
  const params = useSearchParams();
  const code = params.get("code");
  const message = params.get("message");
  const booking = params.get("booking");
  const canceled = code === "PAY_PROCESS_CANCELED";
  return (
    <div className="px-5 pb-6 pt-4 space-y-3">
      <Card className="bg-orange-bg ring-0">
        <div className="text-[15px] font-bold text-orange">{canceled ? tr("결제를 취소했어요", "Payment was cancelled") : tr("결제하지 못했어요", "Payment failed")}</div>
        {!canceled && message && <div className="mt-1 text-[13px] text-ink">{message}</div>}
        <div className="mt-1 text-[12px] text-muted">{tr("예약은 그대로 남아 있어요. 내 여행에서 다시 결제할 수 있어요.", "Your booking is still saved. You can pay again from My trips.")}</div>
      </Card>
      {booking && <LinkButton href={`/pay?booking=${booking}`}>{tr("다시 결제하기", "Try paying again")}</LinkButton>}
      <LinkButton href="/trips" variant="ghost">{tr("내 여행으로", "Go to My trips")}</LinkButton>
    </div>
  );
}

export default function PayFailPage() {
  useLang();
  return (<><Hero title={tr("결제", "Payment")} sub={tr("결제 결과", "Payment result")} /><Suspense fallback={<Spinner />}><Fail /></Suspense></>);
}
