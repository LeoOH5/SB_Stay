"use client";
// T4b 숙박 — 대학 선택 (DM-02 GET /dorms 를 대학별로 묶음)
import { HeaderActions } from "@/components/tourist/header-actions";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, DormPhoto, Hero, Spinner, UNIV_PHOTOS } from "@/components/ui";
import { ErrorBox } from "@/components/tourist";
import { errMsg, ymd } from "@/components/tourist/format";
import { get, won } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import type { DormRoom, ListResponse, University } from "@/lib/types";

interface UnivGroup { university: University; rooms: DormRoom[]; buildings: string[]; minPrice: number }

function groupByUniv(rooms: DormRoom[]): UnivGroup[] {
  const map = new Map<number, UnivGroup>();
  for (const r of rooms) {
    const g = map.get(r.university.id) ?? { university: r.university, rooms: [], buildings: [], minPrice: Infinity };
    g.rooms.push(r);
    if (!g.buildings.includes(r.building)) g.buildings.push(r.building);
    g.minPrice = Math.min(g.minPrice, r.price_per_night);
    map.set(r.university.id, g);
  }
  return [...map.values()];
}

export default function StayPage() {
  const { lang } = useLang();
  const [dorms, setDorms] = useState<DormRoom[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    get<ListResponse<DormRoom>>("/dorms").then((r) => { if (alive) setDorms(r.items); }).catch((e: unknown) => { if (alive) setErr(errMsg(e)); });
    return () => { alive = false; };
  }, []);

  const groups = dorms ? groupByUniv(dorms) : [];
  const openFrom = dorms?.[0]?.open_from ?? "2027-01-05";
  const openTo = dorms?.[0]?.open_to ?? "2027-02-20";

  return (
    <>
      <Hero title="Dorm stays" sub={`${ymd(openFrom)} – ${ymd(openTo).slice(5)} 겨울방학 개방 · 성북구 대학 ${groups.length || 7}곳`} right={<HeaderActions />} />
      <div className="px-5 pb-6 pt-4 space-y-3">
        <ErrorBox message={err} />
        {!dorms && !err && <Spinner />}
        {groups.map((g) => (
          <Link key={g.university.id} href={`/stay/univ/${g.university.id}`} className="block overflow-hidden rounded-[14px] bg-white ring-1 ring-line/60 shadow-[0_1px_3px_rgba(31,42,68,0.08)] active:scale-[0.99] transition">
            <DormPhoto src={UNIV_PHOTOS[g.university.id]} label={g.university.name} className="h-36 rounded-none" credit />
            <div className="flex items-center justify-between gap-3 p-3.5">
              <div className="min-w-0">
                <div className="text-[15px] font-bold text-ink break-keep">{lang === "en" ? g.university.name_en : g.university.name}</div>
                <div className="mt-0.5 text-[13px] text-muted break-keep">{g.buildings.join(" · ")}</div>
              </div>
              <div className="shrink-0 text-right"><div className="text-[15px] font-bold text-navy">{won(g.minPrice)}~</div><div className="text-[11px] text-muted">1박</div></div>
            </div>
          </Link>
        ))}
        {dorms && <Card tint><div className="text-[13px] text-navy leading-relaxed">숙박 판매 주체는 각 대학이에요. 신청하면 대학 담당자가 승인한 뒤 확정됩니다.</div></Card>}
      </div>
    </>
  );
}
