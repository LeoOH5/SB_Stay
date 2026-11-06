"use client";
// T15 신청 완료 — BK-03 GET /bookings/{id}. 신청 완료 → 숙박 승인·버디 수락 기다림 → 결제 확정
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { Icon, LinkButton, Spinner, cn } from "@/components/ui";
import { ErrorBox } from "@/components/tourist";
import { errMsg, okv } from "@/components/tourist/format";
import { BottomBar } from "@/components/tourist/v3";
import { iga, wa } from "@/components/tourist/v3/flow";
import { get } from "@/lib/api";
import type { Booking } from "@/lib/types";

type StepState = "done" | "now" | "todo";
function Step({ state, title, sub, last }: { state: StepState; title: string; sub: ReactNode; last?: boolean }) {
  return (
    <li className="relative flex gap-4 pb-7">
      {!last && <span className="absolute bottom-1 left-[11px] top-8 border-l-[1.5px] border-dashed border-[#B8BFC8]" aria-hidden />}
      <span className={cn("relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
        state === "done" ? "border-navy bg-navy text-white" : state === "now" ? "border-orange bg-white" : "border-ink bg-white")}>
        {state === "done" && <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} />}
      </span>
      <div className="min-w-0">
        <div className="text-[16px] font-semibold text-ink">{title}</div>
        <div className="mt-1 text-[14.5px] text-muted">{sub}</div>
      </div>
    </li>
  );
}

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

  const items = booking?.items.filter((i) => i.status !== "cancelled") ?? [];
  const dorms = items.filter((i) => i.type === "dorm");
  const buddies = items.filter((i) => i.type === "buddy");
  const waiting = items.filter((i) => i.status === "requested");
  const confirmed = booking?.status === "confirmed";
  const name = (t: string) => t.replace(/(와|과) 동네 걷기$/, "");
  const who = [
    ...dorms.map((d) => `${d.title.split(" ").slice(0, -1).join(" ")} 담당자`),
    ...buddies.map((b) => name(b.title)),
  ];
  const whoText = who.length === 2 ? `${who[0]}${wa(who[0])} ${who[1]}${iga(who[1])}` : who.length === 1 ? `${who[0]}${iga(who[0])}` : who.join(", ") + "이";
  const waitTitle = dorms.length && buddies.length ? "숙박 승인 · 버디 수락 기다리는 중" : dorms.length ? "숙박 승인 기다리는 중" : "버디 수락 기다리는 중";

  return (
    <div className="px-5 pt-16">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-navy text-white"><Icon name="check" className="h-6 w-6" strokeWidth={2.6} /></span>
      <h1 className="mt-7 text-[26px] font-bold leading-[1.35] text-ink">신청을 보냈어요</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        {booking ? `예약번호 ${booking.code}. ` : ""}{dorms.length ? "대학과 버디가" : "버디가"} 답하면 알림으로 알려 드려요.
      </p>
      <ErrorBox message={err} className="mt-4" />
      {id && !booking && !err && <Spinner />}
      {booking && (
        <ol className="mt-8">
          <Step state="done" title="신청 완료" sub={[dorms.length && `숙박 ${dorms.length}개`, buddies.length && `버디 ${buddies.length}개`].filter(Boolean).join(", ")} />
          <Step state={waiting.length ? "now" : "done"} title={waiting.length ? waitTitle : dorms.length ? "숙박 승인 · 버디 수락 완료" : "버디 수락 완료"} sub={waiting.length ? `${whoText} 확인하고 있어요` : "모두 답했어요"} />
          <Step state={confirmed ? "done" : "todo"} title="결제 확정" sub={confirmed ? "결제가 확정됐어요" : "모두 승인되면 자동으로 결제돼요"} last />
        </ol>
      )}
      <BottomBar>
        <LinkButton href="/trips">내 여행 보기</LinkButton>
        <LinkButton href="/home" variant="ghost" className="mt-3">홈으로</LinkButton>
      </BottomBar>
    </div>
  );
}

export default function CartDonePage() {
  return <Suspense fallback={<Spinner />}><Done /></Suspense>;
}
