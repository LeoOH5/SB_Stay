"use client";
// T08 무료 산책 코스 상세 — TR-02 GET /tours/{id}, PL GET /places (운영 정보), AI-02 POST /ai/story (장소 이야기 · 질문)
// 코스는 예약 항목이 아니다 (COURSE_NOT_BOOKABLE). 버디와 걸으면 버디 항목의 course_id 로 들어간다.
// v3.5 걸리는 시간은 서버 계산값(duration_min = 머무는 시간 + 걷는 시간), 장소 사이에 걷는 구간(legs) "도보 N분 · Mm"
// v3.4 무료 이용(AU-09 plan=free): 기본 순서 안내 · 이야기 전 광고(T08a) · 질문 하루 3번(T08b, 429 AI_LIMIT) · 도움 안내 · 완료 설문(T08c, TR-05)
import { useParams, useRouter } from "next/navigation";
import { KakaoMap } from "@/components/kakao-map";
import { useEffect, useRef, useState } from "react";
import { Button, Spinner, TopBar, cn } from "@/components/ui";
import { ErrorBox } from "@/components/tourist";
import { AdInterstitial, FixedCourseNote, HelpSheet, QuestionLimit, QuestionsLeft, SurveySheet, useMyPlan } from "@/components/tourist/free-tier";
import { DAY_LABEL, errMsg, okv } from "@/components/tourist/format";
import { ArrowUp, BottomBar, InfoRow, SectionHead } from "@/components/tourist/v3";
import { aboutDuration, hasXY, koDuration, walkText } from "@/components/tourist/v3/flow";
import { ApiError, get, post, won } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import type { AiStory, ListResponse, Place, Tour } from "@/lib/types";

/** 장소 한 줄 정보 — 운영 시간 · 휴관일 · 입장료 (DB 값) */
function placeMeta(p?: Place): string {
  if (!p) return "";
  const closed = p.closed_days?.length ? `${p.closed_days.map((d) => DAY_LABEL[d] ?? d).join("·")} 휴관` : "쉬는 날 없음";
  return [p.hours, closed, p.fee > 0 ? won(p.fee) : "무료 입장", p.need_reservation ? "예약 필요" : ""].filter(Boolean).join(" · ");
}

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { lang } = useLang();
  const { user } = useUser();
  const my = useMyPlan(!!user);
  const [adFor, setAdFor] = useState<number | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [surveyOpen, setSurveyOpen] = useState(false);
  const [tour, setTour] = useState<Tour | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [placeId, setPlaceId] = useState<number | null>(null);
  const [story, setStory] = useState<AiStory | null>(null);
  const [question, setQuestion] = useState("");
  const [qa, setQa] = useState<{ q: string; a: AiStory | null }[]>([]);
  const [askBusy, setAskBusy] = useState(false);
  const stopsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    okv(get<Tour>(`/tours/${id}`)).then((t) => { if (alive) setTour(t); }).catch((e: unknown) => { if (alive) setErr(errMsg(e)); });
    get<ListResponse<Place>>("/places").then((r) => { if (alive) setPlaces(r.items); }).catch(() => { /* 운영 정보는 보조 */ });
    return () => { alive = false; };
  }, [id]);

  // 장소를 누르면 그 장소의 이야기 (질문 없음)
  useEffect(() => {
    if (placeId === null) return;
    let alive = true;
    post<AiStory>("/ai/story", { place_id: placeId, language: lang })
      .then((s) => { if (alive) setStory(s); })
      .catch((e: unknown) => { if (alive) setStory({ answer: errMsg(e), sources: [], grounded: false }); });
    return () => { alive = false; };
  }, [placeId, lang]);

  const orderedPlaces = tour ? [...tour.places].sort((a, b) => a.order - b.order) : [];
  const mapPlaces = orderedPlaces.filter(hasXY); // 좌표 없는 장소는 지도에서만 뺀다
  const legAfter = (i: number) => {
    const a = orderedPlaces[i], b = orderedPlaces[i + 1];
    return b && tour ? tour.legs.find((l) => l.from_place_id === a.id && l.to_place_id === b.id) : undefined;
  };
  const select = (pid: number) => {
    if (pid === placeId) { setPlaceId(null); return; }
    setStory(null); setQa([]); setQuestion(""); setPlaceId(pid);
    if (my.free && user) setAdFor(pid); // 무료: 이야기 전에 '광고' 5초 (이야기는 그동안 불러온다)
  };
  const ask = async () => {
    const q = question.trim();
    if (!q || placeId === null) return;
    setAskBusy(true); setQuestion("");
    setQa((xs) => [...xs, { q, a: null }]);
    let a: AiStory;
    try { a = await post<AiStory>("/ai/story", { place_id: placeId, question: q, language: lang }); }
    catch (e) {
      if (e instanceof ApiError && e.code === "AI_LIMIT") { // 오늘 질문을 다 씀 → 질문은 지우고 한도 안내
        my.setLeft(0); setQa((xs) => xs.slice(0, -1)); setQuestion(q); setAskBusy(false); return;
      }
      a = { answer: errMsg(e), sources: [], grounded: false };
    }
    if (typeof a.questions_left === "number") my.setLeft(a.questions_left);
    setQa((xs) => xs.map((x, i) => (i === xs.length - 1 ? { q, a } : x)));
    setAskBusy(false);
  };
  const walkAlone = () => {
    if (!orderedPlaces[0]) return;
    if (placeId === null) select(orderedPlaces[0].id);
    stopsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const title = tour ? (lang === "en" ? tour.title_en : tour.title) : "";
  const anyFee = tour?.places.some((p) => (places.find((x) => x.id === p.id)?.fee ?? 0) > 0);

  return (
    <>
      <TopBar back="/tours" title="코스" right={tour && my.free ? <button type="button" onClick={() => setHelpOpen(true)} className="font-semibold text-navy">도움이 필요해요</button> : undefined} />
      <div className="px-5">
        <ErrorBox message={err} />
        {!tour && !err && <Spinner />}
      </div>
      {tour && (
        <div className="px-5">
          <h1 className="pt-2 text-[26px] font-bold leading-[1.35] text-ink">{title}</h1>
          {tour.description && <p className="mt-2 text-[15px] leading-relaxed text-muted">{tour.description}</p>}

          <div className="mt-4 divide-y divide-line">
            <InfoRow label="걸리는 시간">
              {aboutDuration(tour.duration_min, lang)} · 장소 {tour.places.length}곳
              <span className="mt-0.5 block text-[13px] font-normal text-muted">
                머무는 {koDuration(tour.stay_min_total)} + 걷는 {tour.walk_min_total}분 · {tour.walk_m_total.toLocaleString("ko-KR")}m
                {!tour.walk_complete && " · 걷는 시간 일부 빠짐"}
              </span>
            </InfoRow>
            <InfoRow label="가격"><span className="text-navy">{tour.price === 0 ? `무료${anyFee ? " (입장료는 장소마다)" : ""}` : won(tour.price)}</span></InfoRow>
            <InfoRow label="시작">{tour.meeting_point}</InfoRow>
            {my.free && my.left !== null && <InfoRow label="AI 질문">오늘 남은 질문 {my.left}/{my.limit}</InfoRow>}
            {my.plan === "buddy" && <InfoRow label="AI 질문">제한 없음 · 광고 없음</InfoRow>}
          </div>
          {my.free && <FixedCourseNote courseId={tour.id} className="mt-4" />}

          <KakaoMap className="mt-5" route numbered
            points={mapPlaces.map((pl) => ({ lat: pl.lat, lng: pl.lng, label: lang === "en" ? pl.name_en : pl.name }))}
            active={placeId === null ? undefined : Math.max(0, mapPlaces.findIndex((pl) => pl.id === placeId))}
            onSelect={(i) => { const pid = mapPlaces[i]?.id; if (pid !== undefined && pid !== placeId) select(pid); }} />

          <div ref={stopsRef} className="scroll-mt-4">
            <SectionHead className="mt-8" title="코스" right="눌러서 AI 이야기 듣기" />
          </div>
          <ol className="mt-4">
            {orderedPlaces.map((p, i) => {
              const open = p.id === placeId;
              const last = i === orderedPlaces.length - 1;
              const leg = legAfter(i);
              const info = places.find((x) => x.id === p.id);
              return (
                <li key={p.id} className="relative flex gap-4 pb-6">
                  {!last && <span className="absolute bottom-0 left-[11px] top-7 border-l-[1.5px] border-dashed border-[#B8BFC8]" aria-hidden />}
                  <button type="button" onClick={() => select(p.id)} aria-expanded={open} aria-label={`${i + 1}번 장소 이야기`}
                    className={cn("relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] text-[12px] font-bold", open ? "border-ink bg-ink text-white" : "border-ink bg-white text-ink")}>{i + 1}</button>
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => select(p.id)} className="block text-left">
                      <span className="block text-[16px] font-semibold text-ink">{lang === "en" ? p.name_en : p.name}</span>
                      {info && <span className="mt-1 block text-[14px] text-muted">{placeMeta(info)}</span>}
                    </button>
                    {open && (
                      <div className="mt-3">
                        {info?.photo_url && (
                          <figure className="mb-3 overflow-hidden rounded-[12px] bg-gray-bg">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={info.photo_url} alt={info.name} className="h-40 w-full object-cover" loading="lazy" />
                            {info.photo_credit && <figcaption className="px-2 py-1 text-[11px] text-muted">사진: {info.photo_credit}</figcaption>}
                          </figure>
                        )}
                        <div className="border-l-[3px] border-navy py-1 pl-4">
                          <div className="text-[13px] font-bold text-navy">AI가 자료에서 찾은 이야기</div>
                          {!story && <p className="mt-1.5 text-[14px] text-muted">이야기를 찾는 중…</p>}
                          {story && (
                            <>
                              <p className="mt-1.5 text-[15.5px] leading-relaxed text-ink">{story.answer}</p>
                              {story.sources.length > 0 && <p className="mt-2 text-[13px] text-muted">출처: {story.sources.map((s) => s.title).join(" · ")}</p>}
                            </>
                          )}
                        </div>
                        {qa.map((x, k) => (
                          <div key={k} className="mt-4">
                            <p className="text-[14px] text-muted">Q. {x.q}</p>
                            {x.a ? (
                              <>
                                <p className="mt-1.5 text-[15.5px] leading-relaxed text-ink">{x.a.answer}</p>
                                {!x.a.grounded && <p className="mt-1 text-[13px] text-orange-ink">자료에 없는 내용이라 확실하지 않아요.</p>}
                              </>
                            ) : <p className="mt-1.5 text-[14px] text-muted">답을 찾는 중…</p>}
                          </div>
                        ))}
                        {my.free && my.left === 0 ? <QuestionLimit limit={my.limit} courseId={tour.id} className="mt-5" /> : (
                          <>
                            <form className="relative mt-4" onSubmit={(e) => { e.preventDefault(); void ask(); }}>
                              <input className="h-12 w-full rounded-full border border-line bg-white pl-4 pr-14 text-[15px] text-ink placeholder:text-muted focus:border-navy focus:outline-none"
                                placeholder="이 장소에 대해 물어보세요" value={question} onChange={(e) => setQuestion(e.target.value)} aria-label="장소 질문" />
                              <button type="submit" disabled={askBusy || !question.trim()} aria-label="보내기"
                                className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-navy text-white disabled:opacity-40"><ArrowUp className="h-[18px] w-[18px]" /></button>
                            </form>
                            {my.free && my.left !== null && <QuestionsLeft left={my.left} limit={my.limit} className="mt-2 pl-4" />}
                          </>
                        )}
                      </div>
                    )}
                    {leg && <p className="mt-2.5 text-[12px] text-muted">{walkText(leg, lang)}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="pb-6 text-[14px] leading-relaxed text-muted">AI는 장소마다 확인한 자료 안에서만 답해요. 자료에 없으면 없다고 말해요.</p>
          {my.free && (
            <div className="grid grid-cols-2 gap-3 pb-8">
              <Button variant="secondary" onClick={() => (user ? setSurveyOpen(true) : router.push("/login"))}>코스 다 걸었어요</Button>
              <Button variant="ghost" onClick={() => setHelpOpen(true)}>도움이 필요해요</Button>
            </div>
          )}

          <BottomBar>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" onClick={walkAlone}>혼자 걷기</Button>
              <Button onClick={() => router.push(`/buddies?course=${tour.id}`)}>버디와 걷기</Button>
            </div>
            <p className="mt-2.5 text-center text-[13px] text-muted">버디와 걸으면 이 코스가 버디 요청에 함께 들어가요</p>
          </BottomBar>
          {adFor !== null && <AdInterstitial seed={adFor} courseId={tour.id} onDone={() => setAdFor(null)} />}
          <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} courseId={tour.id} />
          {surveyOpen && <SurveySheet open onClose={() => setSurveyOpen(false)} courseId={tour.id} />}
        </div>
      )}
    </>
  );
}
