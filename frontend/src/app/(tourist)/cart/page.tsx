"use client";
// T5 장바구니 — BK-01 POST /bookings, BK-06 POST /bookings/{id}/pay (여행자 정보 있을 때), 없으면 /checkout(T10)
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Hero, SectionTitle } from "@/components/ui";
import { ErrorBox, Notice, selectCls, TypeBadge } from "@/components/tourist";
import { submitBooking } from "@/components/tourist/booking";
import { cartMeta, errMsg, SS_TRAVELER } from "@/components/tourist/format";
import { useSS } from "@/components/tourist/session";
import { won } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import type { Traveler } from "@/lib/types";

const PAYMENTS = ["VISA •••• 4242 (해외 카드)", "Mastercard •••• 1881", "Apple Pay", "카카오페이"];

export default function CartPage() {
  const router = useRouter();
  const cart = useCart();
  const { user } = useUser();
  const traveler = useSS<Traveler | null>(SS_TRAVELER, null);
  const [payment, setPayment] = useState(PAYMENTS[0]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (cart.items.length === 0) return;
    if (!user) { router.push("/login"); return; }
    if (!traveler) { router.push("/checkout"); return; }
    setBusy(true); setErr(null);
    try {
      const b = await submitBooking(traveler, cart.items);
      router.push(`/cart/done?id=${b.id}`);
    } catch (e) { setErr(errMsg(e)); setBusy(false); }
  };

  return (
    <>
      <Hero title="Cart" sub="숙박·투어·버디를 한 번에 신청해요" right={<span className="rounded-lg bg-green px-2.5 py-1 text-[12px] font-semibold text-navy">{cart.items.length}개</span>} />
      <div className="px-5 pb-6 pt-4 space-y-3">
        {cart.items.length === 0 && (
          <Card tint className="text-center py-8">
            <div className="text-[14px] text-ink">장바구니가 비어 있어요.</div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Link href="/stay"><Button variant="ghost" className="px-2 text-[13px]">숙박</Button></Link>
              <Link href="/tours"><Button variant="ghost" className="px-2 text-[13px]">투어</Button></Link>
              <Link href="/buddies"><Button variant="ghost" className="px-2 text-[13px]">버디</Button></Link>
            </div>
            <Link href="/plan" className="block mt-2"><Button>AI로 여행 설계하기 →</Button></Link>
          </Card>
        )}
        {cart.items.map((i) => (
          <Card key={`${i.type}-${i.ref_id}`} className="flex items-start gap-3 p-3">
            <TypeBadge type={i.type} />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold text-ink truncate">{i.title}</div>
              <div className="text-[12px] text-muted">{cartMeta(i)}</div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[14px] font-semibold text-ink">{won(i.price)}</div>
              <button type="button" onClick={() => cart.remove(i.type, i.ref_id)} className="text-[12px] text-muted mt-1">삭제</button>
            </div>
          </Card>
        ))}

        {cart.items.length > 0 && (
          <>
            <SectionTitle right={<Link href="/checkout" className="text-[13px] text-navy font-semibold">{traveler ? "수정" : "입력"}</Link>}>여행자 정보</SectionTitle>
            <Card>
              {traveler ? (
                <>
                  <div className="text-[14px] text-ink">{traveler.name} · {traveler.nationality} · {traveler.email}</div>
                  <div className="mt-1 text-[12px] text-muted">여권번호: {traveler.passport_no ? "입력됨 (대학 담당자에게만 전달)" : "예약 시점에만 입력"} · 긴급연락처 {traveler.emergency_contact || "-"} · 동행 {traveler.guests ?? 1}명</div>
                </>
              ) : (
                <div className="text-[13px] text-muted">아직 입력하지 않았어요. 예약 신청 시 한 번만 입력해요.</div>
              )}
            </Card>

            <SectionTitle>결제 수단 (목업)</SectionTitle>
            <select className={selectCls} value={payment} onChange={(e) => setPayment(e.target.value)}>
              {PAYMENTS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <p className="text-[12px] text-muted">환불 규정: 체크인 7일 전 100% · 3일 전 50% · 이후 0% <Link href="/me" className="text-navy">(보기)</Link></p>
            <div className="flex items-end justify-between"><span className="text-[13px] text-muted">합계</span><span className="text-[22px] font-bold text-navy">{won(cart.total)}</span></div>
            <Notice>세 곳이 모두 승인하면 결제가 확정됩니다.</Notice>
            <ErrorBox message={err} />
            <Button onClick={submit} disabled={busy}>{busy ? "신청 중…" : traveler ? "예약 신청하기" : "예약 신청하기 (여행자 정보 입력)"}</Button>
            {!user && <p className="text-[12px] text-muted text-center">예약 신청에는 로그인이 필요해요. <Link href="/login" className="text-navy font-semibold">로그인</Link></p>}
          </>
        )}
      </div>
    </>
  );
}
