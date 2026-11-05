"use client";
// T4b 객실 상세 — DM-03 GET /dorms/{id}, 장바구니 담기
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Card, Hero, DormPhoto, Spinner, TopBar, inputCls } from "@/components/ui";
import { ErrorBox, Notice } from "@/components/tourist";
import { DEFAULT_FROM, DEFAULT_TO, errMsg, md, nightsBetween, okv, ROOM_LABEL, ymd } from "@/components/tourist/format";
import { get, won } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { useLang } from "@/lib/i18n";
import type { DormRoom } from "@/lib/types";

export default function StayDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { lang } = useLang();
  const cart = useCart();
  const [dorm, setDorm] = useState<DormRoom | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [from, setFrom] = useState(DEFAULT_FROM);
  const [to, setTo] = useState(DEFAULT_TO);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    let alive = true;
    okv(get<DormRoom>(`/dorms/${id}`)).then((d) => { if (alive) setDorm(d); }).catch((e: unknown) => { if (alive) setErr(errMsg(e)); });
    return () => { alive = false; };
  }, [id]);

  const nights = nightsBetween(from, to);
  const total = dorm ? dorm.price_per_night * nights : 0;
  const inOpen = dorm ? from >= dorm.open_from && to <= dorm.open_to : true;
  const univ = dorm ? (lang === "en" ? dorm.university.name_en : dorm.university.name) : "";

  const add = (go: boolean) => {
    if (!dorm || nights <= 0) return;
    cart.add({ type: "dorm", ref_id: dorm.id, title: `${univ} ${dorm.building} ${ROOM_LABEL[dorm.room_type]}`, meta: `${md(from)} – ${md(to)} · ${nights}박`, price: total, date_from: from, date_to: to, guests: 1 });
    setAdded(true);
    if (go) router.push("/cart");
  };

  return (
    <>
      <TopBar back="/stay" title="객실 상세" />
      <Hero title={dorm ? `${univ} ${dorm.building}` : "객실 상세"} sub={dorm ? `${ROOM_LABEL[dorm.room_type]} · 1박 ${won(dorm.price_per_night)}` : undefined} />
      <div className="px-5 pb-6 pt-4 space-y-3">
        <ErrorBox message={err} />
        {!dorm && !err && <Spinner />}
        {dorm && (
          <>
            <DormPhoto src={dorm.photos[0]} label={dorm.building} className="h-48" credit />
            <div className="text-[17px] font-semibold text-ink">{ROOM_LABEL[dorm.room_type]} · 1박 {won(dorm.price_per_night)}</div>
            <p className="text-[12px] text-muted">개방 기간 {md(dorm.open_from)} – {md(dorm.open_to)} · 남은 객실 {dorm.available_rooms} · 침구·청소 포함</p>
            <Card accent="navy">
              <div className="text-[14px] font-semibold text-navy">이용 규칙</div>
              <ul className="mt-2 space-y-1 text-[13px] text-ink">{dorm.rules.map((r, i) => <li key={i}>· {r}</li>)}</ul>
            </Card>
            <div>
              <span className="block text-[12px] text-muted mb-1.5">날짜 선택</span>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <input type="date" className={inputCls} value={from} min={dorm.open_from} max={dorm.open_to} onChange={(e) => { setFrom(e.target.value); setAdded(false); }} />
                <span className="text-muted">–</span>
                <input type="date" className={inputCls} value={to} min={dorm.open_from} max={dorm.open_to} onChange={(e) => { setTo(e.target.value); setAdded(false); }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-[14px]">
                <span className="text-ink">{md(from)} – {md(to)} · {nights}박</span>
                <span className="font-bold text-navy">{won(total)}</span>
              </div>
              {nights <= 0 && <Notice className="mt-1">체크아웃은 체크인보다 뒤여야 해요.</Notice>}
              {!inOpen && <Notice className="mt-1">개방 기간({ymd(dorm.open_from)} – {ymd(dorm.open_to)}) 안에서 골라 주세요.</Notice>}
            </div>
            <Notice>대학 담당자 승인 후 확정됩니다.</Notice>
            {added && <Card tint className="text-[13px] text-navy">장바구니에 담았어요.</Card>}
            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" onClick={() => add(false)} disabled={nights <= 0 || !inOpen}>장바구니 담기</Button>
              <Button onClick={() => add(true)} disabled={nights <= 0 || !inOpen}>담고 장바구니로</Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
