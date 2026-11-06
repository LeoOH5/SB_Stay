"use client";
// T07 무료 AI 산책 코스 — TR-01 GET /tours (테마 거르기, 지도)
// v3.5 C안: 코스마다 장소 사진·한국어/영어 이름, 장소 사이 걷는 구간(legs), 걸리는 시간은 서버 계산값(duration_min)
import Link from "next/link";
import { useEffect, useState } from "react";
import { KakaoMap } from "@/components/kakao-map";
import { Chip, Hero, Icon, Spinner } from "@/components/ui";
import { ErrorBox } from "@/components/tourist";
import { CartButton } from "@/components/tourist/header-actions";
import { errMsg, THEMES } from "@/components/tourist/format";
import { CourseSection } from "@/components/tourist/v3/course";
import { hasXY, walkNote } from "@/components/tourist/v3/flow";
import { get } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import type { ListResponse, Tour } from "@/lib/types";

export default function ToursPage() {
  const { lang } = useLang();
  const [theme, setTheme] = useState("");
  const [showMap, setShowMap] = useState(false);
  const [tours, setTours] = useState<Tour[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    get<ListResponse<Tour>>("/tours", { theme: theme || undefined })
      .then((r) => { if (alive) setTours(r.items); })
      .catch((e: unknown) => { if (alive) setErr(errMsg(e)); });
    return () => { alive = false; };
  }, [theme]);
  const pick = (t: string) => { setTours(null); setErr(null); setTheme(t); };
  const free = tours?.every((t) => t.price === 0) ?? true;
  const starts = (tours ?? []).flatMap((t) => t.places.filter(hasXY).slice(0, 1).map((p) => ({ lat: p.lat, lng: p.lng, label: lang === "en" ? t.title_en : t.title })));

  return (
    <>
      <Hero title="코스" className="pb-2"
        sub={tours ? `${free ? "무료 " : ""}AI 산책 코스 ${tours.length}개 · 장소에 닿으면 AI가 이야기를 들려줘요` : "장소에 닿으면 AI가 이야기를 들려줘요"}
        right={
          <div className="-mr-1 flex shrink-0 items-center gap-1.5">
            <button type="button" onClick={() => setShowMap((v) => !v)} aria-pressed={showMap} className={`flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[14px] font-semibold ${showMap ? "border-navy bg-navy text-white" : "border-line text-ink"}`}>
              <Icon name="pin" className="h-[18px] w-[18px]" />지도
            </button>
            <CartButton />
          </div>
        } />

      <div className="px-5 pb-8 pt-3">
        <div className="flex flex-wrap gap-2">
          <Chip selected={theme === ""} onClick={() => pick("")}>전체</Chip>
          {THEMES.map((t) => <Chip key={t.key} selected={theme === t.key} onClick={() => pick(t.key)}>{t.label}</Chip>)}
        </div>
        {showMap && tours && <KakaoMap className="mt-4" points={starts} />}

        <ErrorBox message={err} className="mt-4" />
        {!tours && !err && <Spinner />}
        {tours && tours.length === 0 && <p className="py-8 text-center text-[14px] text-muted">이 테마의 코스가 아직 없어요.</p>}
        <div className="mt-6 space-y-7">
          {(tours ?? []).map((t) => (
            <Link key={t.id} href={`/tours/${t.id}`} className="block" aria-label={`${lang === "en" ? t.title_en : t.title} 코스 보기`}>
              <CourseSection tour={t} lang={lang} />
            </Link>
          ))}
        </div>
        {tours && tours.length > 0 && (
          <div className="mt-8 flex items-start gap-2.5 border-t border-line pt-5 text-[14px] leading-relaxed text-muted">
            <Icon name="users" className="mt-0.5 h-[18px] w-[18px] shrink-0 text-navy" />
            <p>버디와 같이 걷고 싶다면 버디 요청에서 코스를 골라요. <Link href="/buddies" className="font-semibold text-navy">버디 보기 →</Link></p>
          </div>
        )}
        {tours && tours.length > 0 && <p className="mt-3 text-[12px] text-muted">{walkNote(tours.every((t) => t.route_source === "route") ? "route" : "estimate", lang)}</p>}
      </div>
    </>
  );
}
