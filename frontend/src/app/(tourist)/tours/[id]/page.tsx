"use client";
// T4 투어 상세 + AI 역사 스토리 — TR-02 GET /tours/{id}, AI-02 POST /ai/story, TR-04 GET /tours/{id}/reviews
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AiBlock, Button, Card, Chip, Hero, ImageBlock, inputCls, SectionTitle, Spinner, TopBar } from "@/components/ui";
import { ErrorBox, Notice, Stars } from "@/components/tourist";
import { daysLabel, DEFAULT_TOUR_DATE, dowKey, errMsg, langsCode, md, okv } from "@/components/tourist/format";
import { get, post, won } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { useLang } from "@/lib/i18n";
import type { AiStory, ListResponse, Review, Tour } from "@/lib/types";

const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥"];

export default function TourDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { lang } = useLang();
  const cart = useCart();
  const [tour, setTour] = useState<Tour | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [placeId, setPlaceId] = useState<number | null>(null);
  const [story, setStory] = useState<AiStory | null>(null);
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const [answer, setAnswer] = useState<AiStory | null>(null);
  const [askBusy, setAskBusy] = useState(false);
  const [date, setDate] = useState(DEFAULT_TOUR_DATE);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    let alive = true;
    okv(get<Tour>(`/tours/${id}`)).then((t) => { if (alive) { setTour(t); setPlaceId(t.places[0]?.id ?? null); } }).catch((e: unknown) => { if (alive) setErr(errMsg(e)); });
    get<ListResponse<Review>>(`/tours/${id}/reviews`).then((r) => { if (alive) setReviews(r.items); }).catch(() => { /* 리뷰는 선택 */ });
    return () => { alive = false; };
  }, [id]);

  // 장소 칩 선택 시 그 장소의 이야기 자동 호출 (AI-02, question 없음)
  useEffect(() => {
    if (placeId === null) return;
    let alive = true;
    post<AiStory>("/ai/story", { place_id: placeId, language: lang })
      .then((s) => { if (alive) setStory(s); })
      .catch((e: unknown) => { if (alive) setStory({ answer: errMsg(e), sources: [], grounded: false }); });
    return () => { alive = false; };
  }, [placeId, lang]);
  const selectPlace = (pid: number) => { setStory(null); setAsked(null); setAnswer(null); setPlaceId(pid); };
  const storyBusy = placeId !== null && story === null;

  const ask = async () => {
    const q = question.trim();
    if (!q || placeId === null) return;
    setAskBusy(true); setAsked(q); setAnswer(null);
    try { setAnswer(await post<AiStory>("/ai/story", { place_id: placeId, question: q, language: lang })); }
    catch (e) { setAnswer({ answer: errMsg(e), sources: [], grounded: false }); }
    finally { setAskBusy(false); setQuestion(""); }
  };

  const place = tour?.places.find((p) => p.id === placeId) ?? null;
  const operates = tour ? tour.operating_days.includes(dowKey(date)) : true;
  const title = tour ? (lang === "en" ? tour.title_en : tour.title) : "";

  const add = (go: boolean) => {
    if (!tour) return;
    cart.add({ type: "tour", ref_id: tour.id, title: tour.title, meta: `${md(date)} 10:00 · 해설사 ${tour.guide.name} · ${tour.meeting_point}`, price: tour.price, date, time: "10:00", duration_min: tour.duration_min });
    setAdded(true);
    if (go) router.push("/cart");
  };

  return (
    <>
      <TopBar back="/tours" title="투어 상세" />
      <Hero title={title || "투어 상세"} sub={tour ? `해설사 ${tour.guide.name} · ${tour.guide.license} · ${tour.duration_min / 60}h · ${won(tour.price)} · ${daysLabel(tour.operating_days)} · ${langsCode(tour.languages)}` : undefined} />
      <div className="px-5 pb-6 pt-4 space-y-3">
        <ErrorBox message={err} />
        {!tour && !err && <Spinner />}
        {tour && (
          <>
            <ImageBlock h="h-[100px]" label={`지도 · 코스 경로 ${tour.places.map((_, i) => CIRCLED[i]).join("→")} · 집결 ${tour.meeting_point}`} />
            {tour.description && <p className="text-[13px] text-muted">{tour.description}</p>}
            <div className="flex flex-wrap gap-2">
              {tour.places.map((p, i) => <Chip key={p.id} selected={placeId === p.id} onClick={() => selectPlace(p.id)}>{CIRCLED[i]} {lang === "en" ? p.name_en : p.name}</Chip>)}
            </div>

            <AiBlock title={place ? `${lang === "en" ? place.name_en : place.name} 이야기` : "장소 이야기"}>
              {storyBusy && <div className="text-[13px] text-muted">이야기를 불러오는 중…</div>}
              {story && !storyBusy && (
                <>
                  <p>{story.answer}</p>
                  {!story.grounded && <Notice className="mt-1">※ 자료에 없는 내용이에요.</Notice>}
                </>
              )}
              {asked && (
                <div className="mt-3 rounded-lg bg-white px-3 py-2 text-[13px] text-navy">Q. {asked}</div>
              )}
              {askBusy && <div className="mt-2 text-[13px] text-muted">답을 찾는 중…</div>}
              {answer && (
                <div className="mt-2">
                  <p className="text-[13px]">{answer.answer}</p>
                  {!answer.grounded && <Notice className="mt-1">※ 자료에 없는 내용이에요. 해설사에게 물어봐 주세요.</Notice>}
                </div>
              )}
              {(answer ?? story) && (answer ?? story)!.sources.length > 0 && (
                <p className="mt-2 text-[12px] text-muted">출처: {(answer ?? story)!.sources.map((s) => s.title).join(" · ")}</p>
              )}
              <p className="mt-1 text-[12px] text-muted">※ 자료에 없는 내용은 &quot;자료에 없다&quot;고 답해요.</p>
            </AiBlock>
            <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); void ask(); }}>
              <input className={inputCls} placeholder={`Ask about this place…  (${lang.toUpperCase()})`} value={question} onChange={(e) => setQuestion(e.target.value)} disabled={placeId === null} />
              <Button type="submit" full={false} className="h-12 min-h-[48px] px-4" disabled={askBusy || !question.trim()}>↑</Button>
            </form>

            <SectionTitle>리뷰 (샘플)</SectionTitle>
            {reviews.length === 0 && <Card tint className="text-[13px] text-muted">아직 리뷰가 없어요.</Card>}
            {reviews.map((r) => (
              <Card key={r.id} className="py-3">
                <div className="flex items-center gap-2 text-[13px] text-ink"><Stars value={r.rating} size="text-[13px]" /><span>&quot;{r.text}&quot; – {r.author}</span></div>
              </Card>
            ))}

            <SectionTitle>참가 날짜</SectionTitle>
            <input type="date" className={inputCls} value={date} min="2027-01-05" max="2027-02-20" onChange={(e) => { setDate(e.target.value); setAdded(false); }} />
            <p className="text-[12px] text-muted">{md(date)} 10:00 · {tour.meeting_point} 집결 · 운영 요일 {daysLabel(tour.operating_days)}</p>
            {!operates && <Notice>이 날짜는 운영하지 않아요. 운영 요일({daysLabel(tour.operating_days)})로 바꿔 주세요.</Notice>}
            {added && <Card tint className="text-[13px] text-navy">장바구니에 담았어요.</Card>}
            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" className="text-[14px]" onClick={() => add(false)} disabled={!operates}>장바구니 담기</Button>
              <Button className="text-[14px]" onClick={() => add(true)} disabled={!operates}>바로 예약 (즉시 확정)</Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
