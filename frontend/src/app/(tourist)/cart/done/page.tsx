"use client";
// T5 예약 완료 화면 — BK-03 GET /bookings/{id}
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button, Card, Hero, Spinner, StatusPill } from "@/components/ui";
import { ErrorBox, TypeBadge } from "@/components/tourist";
import { errMsg, itemStatusLabel, okv } from "@/components/tourist/format";
import { get, won } from "@/lib/api";
import type { Booking } from "@/lib/types";

function Done() {
  const params = useSearchParams();
  const id = params.get("id");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    okv(get<Booking>(`/bookings/${id}`)).then((b) => { if (alive) setBooking(b); }).catch((e: unknown) => { if (alive) setErr(errMsg(e)); });
    return () => { alive = false; };
  }, [id]);

  return (
    <div className="px-5 pb-6 pt-4 space-y-3">
      <Card className="bg-green-bg ring-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[15px] font-bold text-green-dark">✓ 신청이 접수되었어요</div>
            <div className="mt-1.5 text-[12px] text-muted">
              {booking ? <>예약번호 {booking.code} · 상태: <StatusPill status={booking.status} className="px-2 py-0.5 text-[11px]" /></> : id ? "예약 정보를 불러오는 중…" : "예약번호가 없어요"}
              <br />승인되면 알림으로 알려드려요
            </div>
          </div>
          <Link href="/trips" className="shrink-0 text-[13px] text-navy font-semibold">내 여행 보기 →</Link>
        </div>
      </Card>
      <ErrorBox message={err} />
      {!booking && !err && id && <Spinner />}
      {booking && (
        <>
          {booking.items.map((it) => (
            <Card key={it.id} className="flex items-center gap-3 p-3">
              <TypeBadge type={it.type} />
              <div className="min-w-0 flex-1"><div className="text-[14px] font-semibold text-ink break-keep">{it.title}</div><div className="text-[12px] text-muted">{it.meta}</div></div>
              <div className="shrink-0 text-right"><div className="text-[13px] font-semibold text-ink">{won(it.price)}</div><StatusPill status={it.status} label={itemStatusLabel(it)} className="mt-1" /></div>
            </Card>
          ))}
          <div className="flex items-end justify-between"><span className="text-[13px] text-muted">합계 · {booking.paid_at ? "결제됨" : "미결제"}</span><span className="text-[22px] font-bold text-navy">{won(booking.total_price)}</span></div>
          <p className="text-[12px] text-muted">투어는 즉시 확정, 숙박은 대학 승인, 버디는 버디 수락 후 확정돼요. 세 곳이 모두 승인하면 결제가 확정됩니다.</p>
        </>
      )}
      <Link href="/trips" className="block"><Button>내 여행 보기</Button></Link>
      <Link href="/home" className="block"><Button variant="ghost">홈으로</Button></Link>
    </div>
  );
}

export default function CartDonePage() {
  return (
    <>
      <Hero title="Request sent" sub="예약 신청 완료" />
      <Suspense fallback={<Spinner />}><Done /></Suspense>
    </>
  );
}
