"use client";
// v3.5 코스 목록(T07) C안 — 장소마다 사진 + 한국어·영어 이름, 장소 사이 세로선 위에 걷는 구간 (도보 N분 · Mm)
import { useState } from "react";
import { Icon, cn } from "@/components/ui";
import { tr, type L } from "@/lib/i18n";
import type { Tour, TourPlace } from "@/lib/types";
import { courseMeta, walkText } from "./flow";

/** 사진 없는 장소의 따뜻한 색 블록 (장소 id로 늘 같은 색) */
const TINTS = ["#E9DCCB", "#DCE3D6", "#E7D9C9", "#EADBD8", "#E2DDCF", "#D8E0D4"];
export const placeTint = (id: number) => TINTS[id % TINTS.length];

/** 56×56 장소 사진. photo_url 이 없거나 못 불러오면 색 블록 + 작은 그림 아이콘 */
export function PlaceThumb({ place, className }: { place: Pick<TourPlace, "id" | "name" | "photo_url" | "photo_credit">; className?: string }) {
  const [failed, setFailed] = useState(false);
  const box = cn("h-14 w-14 shrink-0 rounded-[10px]", className);
  if (!place.photo_url || failed) {
    return (
      <div className={cn(box, "flex items-center justify-center")} style={{ background: placeTint(place.id) }} aria-hidden>
        <Icon name="image" className="h-[18px] w-[18px] text-[#5C4B3A]" strokeWidth={1.6} />
      </div>
    );
  }
  const credit = place.photo_credit ? tr(`사진: ${place.photo_credit}`, `Photo: ${place.photo_credit}`) : undefined;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={place.photo_url} alt={place.name} title={credit} loading="lazy" onError={() => setFailed(true)} className={cn(box, "object-cover")} />;
}

/** 코스 한 개: 제목 + 다른 언어 제목 · 오른쪽 "약 3시간 · 4곳" · 장소 줄(사진·이름)과 그 사이 걷는 구간 */
export function CourseSection({ tour, lang }: { tour: Tour; lang: L }) {
  const en = lang === "en";
  const stops = [...tour.places].sort((a, b) => a.order - b.order);
  return (
    <section>
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold leading-snug text-ink">{en ? tour.title_en : tour.title}</h2>
          <p className="mt-px text-[12px] text-muted">{en ? tour.title : tour.title_en}</p>
        </div>
        <span className="shrink-0 whitespace-nowrap text-[12px] font-semibold text-orange-ink">{courseMeta(tour.duration_min, stops.length, lang)}</span>
      </div>
      <ol className="mt-2.5">
        {stops.map((p, i) => {
          const leg = i < stops.length - 1 ? tour.legs.find((l) => l.from_place_id === p.id && l.to_place_id === stops[i + 1].id) ?? tour.legs[i] : undefined;
          return (
            <li key={p.id}>
              <div className="flex gap-3">
                <PlaceThumb place={p} />
                <div className="flex h-14 min-w-0 flex-1 flex-col justify-center">
                  <span className="truncate text-[14px] font-semibold text-ink">{i + 1}. {en ? p.name_en : p.name}</span>
                  <span className="truncate text-[12px] text-muted">{en ? p.name : p.name_en}</span>
                </div>
              </div>
              {leg && (
                <div className="flex gap-3" aria-label={walkText(leg, lang)}>
                  <div className="flex w-14 shrink-0 justify-center"><span className="h-6 w-px bg-[#C9D0D8]" aria-hidden /></div>
                  <span className="self-center text-[12px] text-muted">{walkText(leg, lang)}</span>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {!tour.walk_complete && <p className="mt-2 text-[12px] text-muted">{en ? "Some walking time is missing (a stop has no map point)." : "좌표가 없는 장소가 있어 걷는 시간 일부 빠짐"}</p>}
    </section>
  );
}
