"use client";
// v3.4 무료 AI 산책 코스 — 이용 방식(AU-09), 광고 화면(T08a), 질문 한도(T08b), 도움 안내, 코스 완료 설문(T08c)
// 무료 이용은 '정직한 제한'만 둔다: 길 안내를 틀리게 하거나 코스 순서를 섞거나 일부러 느리게 만들지 않는다.
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Chip, ImageBlock, LinkButton, cn } from "@/components/ui";
import { BottomSheet, ErrorBox, Stars } from "@/components/tourist";
import { errMsg } from "@/components/tourist/format";
import { Segmented } from "@/components/tourist/v3";
import { get, post } from "@/lib/api";
import { AD_SECONDS, FREE_AI_QUESTIONS, SAMPLE_ADS, SURVEY_PAIN, keysOf, label } from "@/lib/codes";
import { curLang, tr } from "@/lib/i18n";
import type { CourseSurvey, MyPlan, SurveyPain } from "@/lib/types";

/** 내 이용 방식. 로그인 전에는 무료로 본다. 불러오는 중이면 plan=null (광고를 섣불리 띄우지 않음) */
export function useMyPlan(loggedIn: boolean) {
  const [data, setData] = useState<MyPlan | null>(null);
  useEffect(() => {
    if (!loggedIn) return;
    let alive = true;
    get<MyPlan>("/auth/me/plan").then((p) => { if (alive) setData(p); }).catch(() => { /* 실패하면 제한 표시 없이 */ });
    return () => { alive = false; };
  }, [loggedIn]);
  const cur = loggedIn ? data : null;
  const plan = loggedIn ? (cur?.plan ?? null) : "free";
  return {
    plan,
    free: plan === "free",
    limit: cur?.ai_question_limit ?? FREE_AI_QUESTIONS,
    left: loggedIn ? (cur?.ai_questions_left_today ?? null) : FREE_AI_QUESTIONS,
    setLeft: (n: number) => setData((d) => (d ? { ...d, ai_questions_left_today: n, ai_questions_used_today: (d.ai_question_limit ?? FREE_AI_QUESTIONS) - n } : d)),
  };
}

/** 버디 신청(2번 · 버디만)을 먼저, 숙박 + 버디(1번)는 보조 링크로 */
export function UpsellLinks({ courseId, primary = tr("버디와 걷기", "Walk with a buddy"), className }: { courseId?: number; primary?: string; className?: string }) {
  return (
    <div className={className}>
      <LinkButton href={courseId ? `/buddies?course=${courseId}` : "/buddies"}>{primary}</LinkButton>
      <p className="mt-3 text-center text-[14px] text-muted">
        {tr("숙소도 필요하다면", "Need a place to stay too?")} <Link href="/stay" className="font-semibold text-navy">{tr("기숙사 숙박 + 버디", "Dorm stay + buddy")}</Link>
      </p>
    </div>
  );
}

/** 코스 상세 위쪽 한 줄 — 순서가 정해진 기본 코스 */
export function FixedCourseNote({ courseId, className }: { courseId: number; className?: string }) {
  return (
    <div className={cn("border-l-[3px] border-orange py-1 pl-4", className)}>
      <p className="text-[15px] leading-relaxed text-ink">{tr("순서가 정해진 기본 코스예요. 내 숙소·시간에 맞춘 동선은 버디와 함께 걸을 때 짜 드려요.", "This is a fixed-order walk. With a buddy, you get a route planned around your stay and schedule.")}</p>
      <Link href={`/buddies?course=${courseId}`} className="mt-1.5 inline-block text-[14.5px] font-semibold text-navy">{tr("버디와 걷기 →", "Walk with a buddy →")}</Link>
    </div>
  );
}

/** T08a 광고 — '광고' 표시, 5초 세기, 그 뒤 건너뛰기. 이야기는 뒤에서 이미 불러온다 */
export function AdInterstitial({ seed, courseId, onDone }: { seed: number; courseId: number; onDone: () => void }) {
  const [n, setN] = useState(AD_SECONDS);
  useEffect(() => {
    const t = window.setInterval(() => setN((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => window.clearInterval(t);
  }, []);
  const ad = SAMPLE_ADS[Math.abs(seed) % SAMPLE_ADS.length];
  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-ink/40" role="dialog" aria-modal="true" aria-label={tr("광고", "Ad")}>
      <div className="flex h-full w-full max-w-[430px] flex-col bg-white px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded-[6px] border-[1.5px] border-orange-ink px-2 py-0.5 text-[12px] font-bold text-orange-ink">{tr("광고", "Ad")}</span>
            <span className="text-[13px] text-muted">{tr("예시 광고 · 실제 가게가 아니에요", "Sample ad · not a real shop")}</span>
          </div>
          <span className="text-[14px] font-semibold text-ink" aria-live="polite">{n > 0 ? tr(`${n}초`, `${n}s`) : tr("끝", "Done")}</span>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-line" aria-hidden>
          <div className="h-full bg-navy transition-[width] duration-1000 ease-linear" style={{ width: `${((AD_SECONDS - n) / AD_SECONDS) * 100}%` }} />
        </div>

        <ImageBlock label={ad.place} h="h-[220px]" className="mt-6" />
        <h2 className="mt-5 text-[21px] font-bold leading-snug text-ink">{ad.title}</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{ad.body}</p>

        <div className="mt-auto">
          <p className="mb-3 text-center text-[13px] leading-relaxed text-muted">{tr("무료 코스는 광고와 함께 보여 드려요. 이야기는 그동안 미리 불러와 둬요.", "Free walks come with ads. We load the story while you wait.")}</p>
          <Button onClick={onDone} disabled={n > 0}>{n > 0 ? tr(`${n}초 뒤에 이야기 보기`, `See the story in ${n}s`) : tr("이야기 보기", "See the story")}</Button>
          <LinkButton href={`/buddies?course=${courseId}`} variant="secondary" className="mt-3">{tr("광고 없이 보기 → 버디 신청", "No ads → get a buddy")}</LinkButton>
        </div>
      </div>
    </div>
  );
}

/** "오늘 남은 질문 2/3" */
export function QuestionsLeft({ left, limit, className }: { left: number; limit: number; className?: string }) {
  return <p className={cn("text-[13.5px] text-muted", className)}>{tr("오늘 남은 질문", "Questions left today")} <span className={cn("font-semibold", left === 0 ? "text-orange-ink" : "text-ink")}>{left}/{limit}</span></p>;
}

/** T08b 질문 한도 — 입력칸 대신 보인다 */
export function QuestionLimit({ limit, courseId, className }: { limit: number; courseId: number; className?: string }) {
  return (
    <div className={cn("border-l-[3px] border-orange py-1 pl-4", className)}>
      <p className="text-[16px] font-semibold text-ink">{tr(`오늘 질문 ${limit}번을 다 썼어요`, `You've used all ${limit} questions for today`)}</p>
      <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{tr(`장소 이야기는 계속 볼 수 있어요. 질문은 내일 다시 ${limit}번 할 수 있어요. 버디와 함께 걸으면 버디에게도, AI에게도 제한 없이 물어볼 수 있어요.`, `You can still read the place stories. You get ${limit} more questions tomorrow. Walk with a buddy to ask your buddy and the AI as much as you like.`)}</p>
      <UpsellLinks courseId={courseId} primary={tr("버디에게 바로 물어보기 → 버디 신청", "Ask a buddy now → get a buddy")} className="mt-4" />
    </div>
  );
}

/** "도움이 필요해요" — 무료 코스에는 실시간 도움이 없다는 안내 */
export function HelpSheet({ open, onClose, courseId }: { open: boolean; onClose: () => void; courseId: number }) {
  return (
    <BottomSheet open={open} onClose={onClose} title={tr("도움이 필요해요", "I need help")}>
      <p className="text-[15px] leading-relaxed text-ink">{tr("무료 코스에는 실시간으로 도와드릴 사람이 없어요. 지도와 AI 이야기만 함께해요.", "Free walks have no live help. You have the map and the AI stories.")}</p>
      <div className="mt-4 border-l-[3px] border-red py-1 pl-4">
        <p className="text-[14.5px] font-semibold text-ink">{tr("위급하면 바로 전화하세요", "In an emergency, call right away")}</p>
        <p className="mt-1 text-[14.5px] leading-relaxed text-muted">{tr("경찰 112 · 구급·화재 119 · 관광 통역 안내 1330 (24시간, 영어 가능)", "Police 112 · Ambulance & fire 119 · Tourist helpline 1330 (24 hours, English)")}</p>
      </div>
      <p className="mt-4 text-[14.5px] leading-relaxed text-muted">{tr("버디와 함께 걸으면 같은 동네 대학생이 길 찾기, 식당 주문, 지하철 타기를 옆에서 도와줘요.", "With a buddy, a local student helps you find your way, order food and ride the subway.")}</p>
      <UpsellLinks courseId={courseId} className="mt-5" />
    </BottomSheet>
  );
}

/** T08c 코스 완료 설문 3문항 → 저장(TR-05) → 다음엔 버디와 (가격 약속 없음) */
export function SurveySheet({ open, onClose, courseId }: { open: boolean; onClose: () => void; courseId: number }) {
  const [sat, setSat] = useState(0);
  const [pain, setPain] = useState<SurveyPain | null>(null);
  const [want, setWant] = useState<"yes" | "no" | "">("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<CourseSurvey | null>(null);
  const ready = sat > 0 && pain !== null && want !== "";

  const submit = async () => {
    if (!ready) return;
    setBusy(true); setErr(null);
    try { setDone(await post<CourseSurvey>(`/tours/${courseId}/survey`, { satisfaction: sat, pain, want_buddy: want === "yes" })); }
    catch (e) { setErr(errMsg(e)); }
    setBusy(false);
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={done ? tr("고마워요", "Thank you") : tr("코스를 다 걸었어요", "You finished the walk")}>
      {done ? (
        <div>
          <h3 className="text-[21px] font-bold leading-snug text-ink">{tr("다음엔 버디와 함께 걸어 보세요", "Next time, walk with a buddy")}</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">{tr("같은 동네 대학생 버디가 내 숙소와 시간에 맞춰 동선을 같이 짜요. 광고 없이, 질문도 제한 없이 할 수 있어요.", "A local student buddy plans the route around your stay and schedule. No ads, unlimited questions.")}</p>
          <UpsellLinks courseId={courseId} primary={tr("버디 둘러보기", "Browse buddies")} className="mt-5" />
        </div>
      ) : (
        <div>
          <p className="text-[14.5px] text-muted">{tr("세 가지만 물어볼게요. 더 나은 코스를 만드는 데 써요.", "Just three questions. They help us make better walks.")}</p>

          <div className="mt-5 text-[15px] font-semibold text-ink">{tr("1. 오늘 산책은 어땠나요?", "1. How was today's walk?")}</div>
          <div className="mt-2"><Stars value={sat} onChange={setSat} size="text-[30px]" /></div>

          <div className="mt-6 text-[15px] font-semibold text-ink">{tr("2. 가장 불편했던 점은요?", "2. What was the hardest part?")}</div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {keysOf(SURVEY_PAIN).map((k) => <Chip key={k} selected={pain === k} onClick={() => setPain(k)}>{label(SURVEY_PAIN, k, curLang())}</Chip>)}
          </div>

          <div className="mt-6 text-[15px] font-semibold text-ink">{tr("3. 다음엔 버디와 걸어 볼래요?", "3. Would you walk with a buddy next time?")}</div>
          <Segmented className="mt-2.5" value={want} onChange={setWant} options={[{ value: "yes", label: tr("네, 걸어 볼래요", "Yes, I would") }, { value: "no", label: tr("아니요", "No") }]} />

          <ErrorBox message={err} className="mt-4" />
          <Button className="mt-6" onClick={() => void submit()} disabled={!ready || busy}>{busy ? tr("보내는 중…", "Sending…") : tr("보내기", "Send")}</Button>
        </div>
      )}
    </BottomSheet>
  );
}
