"use client";
// T7 투어 코스 목록 (필터) — TR-01 GET /tours
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Card, Chip, Hero, ImageBlock, inputCls, Spinner, StatusPill } from "@/components/ui";
import { ErrorBox, Notice } from "@/components/tourist";
import { daysLabel, DEFAULT_TOUR_DATE, dowKey, errMsg, langsCode, md, THEME_LABEL, THEMES } from "@/components/tourist/format";
import { get, won } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import type { ListResponse, Tour } from "@/lib/types";

const PRICES: { key: string; label: string; max: number }[] = [
  { key: "all", label: "가격 전체", max: Infinity },
  { key: "20000", label: "₩20,000 이하", max: 20000 },
  { key: "25000", label: "₩25,000 이하", max: 25000 },
];

export default function ToursPage() {
  const { lang } = useLang();
  const [theme, setTheme] = useState<string>("");
  const [date, setDate] = useState<string>(DEFAULT_TOUR_DATE);
  const [useDate, setUseDate] = useState(false);
  const [language, setLanguage] = useState<string>("");
  const [price, setPrice] = useState("all");
  const [showMap, setShowMap] = useState(false);
  const [tours, setTours] = useState<Tour[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    get<ListResponse<Tour>>("/tours", { theme: theme || undefined, language: language || undefined, date: useDate ? date : undefined })
      .then((r) => { if (alive) setTours(r.items); })
      .catch((e: unknown) => { if (alive) setErr(errMsg(e)); });
    return () => { alive = false; };
  }, [theme, language, date, useDate]);
  /** 필터 변경 시 목록·오류를 비우고(로딩 표시) 조건을 바꾼다 */
  const pick = (fn: () => void) => { setTours(null); setErr(null); fn(); };

  const maxPrice = PRICES.find((p) => p.key === price)?.max ?? Infinity;
  const dow = useDate ? dowKey(date) : null;
  const shown = (tours ?? []).filter((t) => t.price <= maxPrice && (!dow || t.operating_days.includes(dow)));

  return (
    <>
      <Hero title="Tours" sub="해설사와 걷는 성북 역사 코스 · 예약 즉시 확정"
        right={<button type="button" onClick={() => setShowMap((v) => !v)} className="rounded-lg bg-green px-2.5 py-1 text-[12px] font-semibold text-navy">지도 보기</button>} />
      <div className="px-5 pb-6 pt-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Chip selected={useDate} onClick={() => pick(() => setUseDate((v) => !v))}>{useDate ? `날짜 ${md(date)}` : "날짜 전체"}</Chip>
          <Chip selected={language === "en"} onClick={() => pick(() => setLanguage((v) => (v === "en" ? "" : "en")))}>EN</Chip>
          <Chip selected={language === "ko"} onClick={() => pick(() => setLanguage((v) => (v === "ko" ? "" : "ko")))}>KO</Chip>
          {PRICES.map((p) => <Chip key={p.key} selected={price === p.key} onClick={() => setPrice(p.key)}>{p.label}</Chip>)}
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip selected={theme === ""} onClick={() => pick(() => setTheme(""))}>테마 전체</Chip>
          {THEMES.map((t) => <Chip key={t.key} selected={theme === t.key} onClick={() => pick(() => setTheme(t.key))}>{t.label}</Chip>)}
        </div>
        {useDate && (
          <div className="flex items-center gap-2">
            <input type="date" className={inputCls} value={date} min="2027-01-05" max="2027-02-20" onChange={(e) => pick(() => setDate(e.target.value))} />
          </div>
        )}
        {showMap && <ImageBlock h="h-32" label={`지도 · 코스 시작점\n${shown.map((t) => `${t.title}: ${t.meeting_point}`).join("\n")}`} className="whitespace-pre-line text-[12px]" />}

        <ErrorBox message={err} />
        {!tours && !err && <Spinner />}
        {tours && shown.length === 0 && <Card tint className="text-center text-[13px] text-muted py-6">이 조건에 맞는 코스가 없어요. 날짜·테마를 바꿔 보세요.</Card>}
        {shown.map((t) => (
          <Link key={t.id} href={`/tours/${t.id}`} className="block">
            <Card accent="navy">
              <div className="flex items-start justify-between gap-3">
                <div className="text-[14px] font-semibold text-ink">{lang === "en" ? t.title_en : t.title}</div>
                <div className="shrink-0 text-[14px] font-semibold text-ink">{won(t.price)}</div>
              </div>
              <div className="mt-1.5 text-[12px] text-muted">해설사 {t.guide.name} · {t.duration_min / 60}h · {daysLabel(t.operating_days)} · {langsCode(t.languages)}</div>
              <div className="mt-1 flex items-end justify-between gap-3">
                <div className="text-[12px] text-muted">{t.places.map((p) => (lang === "en" ? p.name_en : p.name)).join(" → ")}</div>
                <span className="shrink-0 text-[12px] text-navy font-semibold">상세 →</span>
              </div>
              <div className="mt-2"><StatusPill status="info" label={THEME_LABEL[t.theme] ?? t.theme} /></div>
            </Card>
          </Link>
        ))}
        <Notice>날짜를 고르면 그 요일에 운영하는 코스만 보여요.</Notice>
        <Card tint><div className="text-[13px] text-navy leading-relaxed">코스 경로 지도 · 해설사 정보 · 장소별 AI 이야기는 상세에서. 예약은 즉시 확정(승인 없음).</div></Card>
        <Button variant="secondary" onClick={() => setShowMap((v) => !v)} className="text-[14px]">{showMap ? "지도 닫기" : "지도로 코스 시작점 보기"}</Button>
      </div>
    </>
  );
}
