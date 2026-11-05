"use client";
// T4b 숙박 목록 — DM-02 GET /dorms
import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, DormPhoto, Hero, Spinner } from "@/components/ui";
import { ErrorBox } from "@/components/tourist";
import { errMsg, ROOM_LABEL, ymd } from "@/components/tourist/format";
import { get, won } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import type { DormRoom, ListResponse } from "@/lib/types";

export default function StayPage() {
  const { lang } = useLang();
  const [dorms, setDorms] = useState<DormRoom[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    get<ListResponse<DormRoom>>("/dorms").then((r) => { if (alive) setDorms(r.items); }).catch((e: unknown) => { if (alive) setErr(errMsg(e)); });
    return () => { alive = false; };
  }, []);

  const univCount = dorms ? new Set(dorms.map((d) => d.university.id)).size : 0;
  const openFrom = dorms?.[0]?.open_from ?? "2027-01-05";
  const openTo = dorms?.[0]?.open_to ?? "2027-02-20";

  return (
    <>
      <Hero title="Dorm stays" sub={`${ymd(openFrom)} – ${ymd(openTo).slice(5)} 겨울방학 개방 · 성북구 대학 ${univCount || 7}곳`} />
      <div className="px-5 pb-6 pt-4 space-y-3">
        <ErrorBox message={err} />
        {!dorms && !err && <Spinner />}
        {dorms && (
          <div className="space-y-3">
            {dorms.map((d) => (
              <Link key={d.id} href={`/stay/${d.id}`} className="block overflow-hidden rounded-[14px] bg-white ring-1 ring-line/60 shadow-[0_1px_3px_rgba(31,42,68,0.08)] active:scale-[0.99] transition">
                <DormPhoto src={d.photos[0]} label={d.university.name} className="h-36 rounded-none" />
                <div className="flex items-start justify-between gap-3 p-3.5">
                  <div className="min-w-0">
                    <div className="text-[15px] font-bold text-ink break-keep">{lang === "en" ? d.university.name_en : d.university.name}</div>
                    <div className="mt-0.5 text-[13px] text-muted">{d.building} · {ROOM_LABEL[d.room_type]} · 남은 객실 {d.available_rooms}</div>
                  </div>
                  <div className="shrink-0 text-right"><div className="text-[15px] font-bold text-navy">{won(d.price_per_night)}</div><div className="text-[11px] text-muted">1박</div></div>
                </div>
              </Link>
            ))}
          </div>
        )}
        <Card tint><div className="text-[13px] text-navy leading-relaxed">숙박 판매 주체는 각 대학이에요. 신청하면 대학 담당자가 승인한 뒤 확정됩니다.</div></Card>
      </div>
    </>
  );
}
