"use client";
// T4b 숙박 — 대학 안에서 건물(관)·객실 선택 (DM-02 GET /dorms?university_id=)
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { DormPhoto, Hero, Spinner } from "@/components/ui";
import { ErrorBox } from "@/components/tourist";
import { errMsg, md, ROOM_LABEL } from "@/components/tourist/format";
import { get, won } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import type { DormRoom, ListResponse } from "@/lib/types";

export default function UnivDormsPage() {
  const { uid } = useParams<{ uid: string }>();
  const { lang } = useLang();
  const [rooms, setRooms] = useState<DormRoom[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    get<ListResponse<DormRoom>>("/dorms", { university_id: uid }).then((r) => { if (alive) setRooms(r.items); }).catch((e: unknown) => { if (alive) setErr(errMsg(e)); });
    return () => { alive = false; };
  }, [uid]);

  const univ = rooms?.[0]?.university;
  const buildings = rooms ? [...new Set(rooms.map((r) => r.building))].map((b) => ({ name: b, rooms: rooms.filter((r) => r.building === b) })) : [];

  return (
    <>
      <Hero back="/stay" title={univ ? (lang === "en" ? univ.name_en : univ.name) : "숙박"} sub={rooms?.[0] ? `개방 ${md(rooms[0].open_from)} – ${md(rooms[0].open_to)} · 건물 ${buildings.length}곳` : undefined} />
      <div className="px-5 pb-6 pt-4 space-y-4">
        <ErrorBox message={err} />
        {!rooms && !err && <Spinner />}
        {rooms && rooms.length === 0 && <p className="text-[14px] text-muted">이 대학은 지금 개방된 객실이 없어요.</p>}
        {buildings.map((b) => (
          <section key={b.name} className="overflow-hidden rounded-[14px] bg-white ring-1 ring-line/60 shadow-[0_1px_3px_rgba(31,42,68,0.08)]">
            <DormPhoto src={b.rooms[0].photos[0]} label={b.name} className="h-40 rounded-none" credit />
            <div className="px-3.5 pt-3 text-[16px] font-bold text-ink">{b.name}</div>
            <div className="divide-y divide-line/60 px-3.5 pb-1">
              {b.rooms.map((r) => (
                <Link key={r.id} href={`/stay/${r.id}`} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-ink">{ROOM_LABEL[r.room_type]}</div>
                    <div className="text-[12px] text-muted">남은 객실 {r.available_rooms}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[15px] font-bold text-navy">{won(r.price_per_night)}</span>
                    <span className="text-[18px] text-muted">›</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
