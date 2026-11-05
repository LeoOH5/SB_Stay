"use client";
// T4b 숙박 목록 — DM-02 GET /dorms
import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, Hero, ListRow, Spinner } from "@/components/ui";
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
      <Hero title="Dorm stays" sub={`${ymd(openFrom)} – ${ymd(openTo).slice(5)} 겨울방학 개방 · 성북구 대학 ${univCount || 3}곳`} />
      <div className="px-5 pb-6 pt-4 space-y-3">
        <ErrorBox message={err} />
        {!dorms && !err && <Spinner />}
        {dorms && (
          <Card className="divide-y divide-line/60 py-0">
            {dorms.map((d) => (
              <Link key={d.id} href={`/stay/${d.id}`} className="block">
                <ListRow icon={<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 20V9l9-5 9 5v11" /><path d="M9 20v-6h6v6" /></svg>} title={`${lang === "en" ? d.university.name_en : d.university.name} ${d.building}`}
                  meta={`${ROOM_LABEL[d.room_type]} · 남은 객실 ${d.available_rooms} · 개방 ${ymd(d.open_from).slice(5)} – ${ymd(d.open_to).slice(5)}`}
                  right={<div className="text-[14px] font-semibold text-navy">{won(d.price_per_night)}~</div>} />
              </Link>
            ))}
          </Card>
        )}
        <Card tint><div className="text-[13px] text-navy leading-relaxed">숙박 판매 주체는 각 대학이에요. 신청하면 대학 담당자가 승인한 뒤 확정됩니다.</div></Card>
      </div>
    </>
  );
}
