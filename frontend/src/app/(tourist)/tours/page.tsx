"use client";
// T07 무료 AI 산책 코스 — TR-01 GET /tours (테마 거르기, 지도)
import Link from "next/link";
import { useEffect, useState } from "react";
import { KakaoMap } from "@/components/kakao-map";
import { Banner, Chip, Hero, Icon, Spinner } from "@/components/ui";
import { ErrorBox } from "@/components/tourist";
import { errMsg, THEME_LABEL, THEMES } from "@/components/tourist/format";
import { CourseDots, Headline } from "@/components/tourist/v3";
import { koDuration } from "@/components/tourist/v3/flow";
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

  return (
    <>
      <Hero title="코스" className="pb-2" right={
        <button type="button" onClick={() => setShowMap((v) => !v)} aria-pressed={showMap} className={`flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[14px] font-semibold ${showMap ? "border-navy bg-navy text-white" : "border-line text-ink"}`}>
          <Icon name="pin" className="h-[18px] w-[18px]" />지도
        </button>
      } />
      <Headline className="pt-3" title={"AI가 들려주는\n성북 산책 코스"} sub="혼자 걸어도, 버디와 같이 걸어도 돼요. 장소에 닿으면 AI가 이야기를 들려주고 질문에 답해요." />

      <div className="px-5 pb-8 pt-5">
        <div className="flex flex-wrap gap-2">
          <Chip selected={theme === ""} onClick={() => pick("")}>전체</Chip>
          {THEMES.map((t) => <Chip key={t.key} selected={theme === t.key} onClick={() => pick(t.key)}>{t.label}</Chip>)}
        </div>
        {showMap && tours && <KakaoMap className="mt-4" points={tours.flatMap((t) => t.places.slice(0, 1).map((p) => ({ lat: p.lat, lng: p.lng, label: lang === "en" ? t.title_en : t.title })))} />}

        <ErrorBox message={err} className="mt-4" />
        {!tours && !err && <Spinner />}
        {tours && <div className="mt-6 text-[14px] text-muted">코스 {tours.length}개{free ? " · 모두 무료" : ""}</div>}
        {tours && tours.length === 0 && <p className="py-8 text-center text-[14px] text-muted">이 테마의 코스가 아직 없어요.</p>}
        <div className="divide-y divide-line">
          {(tours ?? []).map((t) => (
            <Link key={t.id} href={`/tours/${t.id}`} className="block py-5">
              <div className="flex items-start justify-between gap-3">
                <div className="text-[16px] font-semibold text-ink">{lang === "en" ? t.title_en : t.title}</div>
                <div className="shrink-0 text-[16px] font-bold text-navy">{t.price === 0 ? "무료" : `₩${t.price.toLocaleString("ko-KR")}`}</div>
              </div>
              <div className="mt-1.5 text-[14.5px] text-muted">{THEME_LABEL[t.theme] ?? t.theme} · 걸어서 {koDuration(t.duration_min)}</div>
              <div className="mt-3"><CourseDots n={t.places.length} /></div>
            </Link>
          ))}
        </div>
        {tours && <Banner icon="users" className="mt-2">버디와 같이 걷고 싶다면 버디 요청에서 코스를 골라요</Banner>}
      </div>
    </>
  );
}
