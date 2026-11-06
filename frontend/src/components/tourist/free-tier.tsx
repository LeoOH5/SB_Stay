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
export function UpsellLinks({ courseId, primary = "버디와 걷기", className }: { courseId?: number; primary?: string; className?: string }) {
  return (
    <div className={className}>
      <LinkButton href={courseId ? `/buddies?course=${courseId}` : "/buddies"}>{primary}</LinkButton>
      <p className="mt-3 text-center text-[14px] text-muted">
        숙소도 필요하다면 <Link href="/stay" className="font-semibold text-navy">기숙사 숙박 + 버디</Link>
      </p>
    </div>
  );
}

/** 코스 상세 위쪽 한 줄 — 순서가 정해진 기본 코스 */
export function FixedCourseNote({ courseId, className }: { courseId: number; className?: string }) {
  return (
    <div className={cn("border-l-[3px] border-orange py-1 pl-4", className)}>
      <p className="text-[15px] leading-relaxed text-ink">순서가 정해진 기본 코스예요. 내 숙소·시간에 맞춘 동선은 버디와 함께 걸을 때 짜 드려요.</p>
      <Link href={`/buddies?course=${courseId}`} className="mt-1.5 inline-block text-[14.5px] font-semibold text-navy">버디와 걷기 →</Link>
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
    <div className="fixed inset-0 z-50 flex justify-center bg-ink/40" role="dialog" aria-modal="true" aria-label="광고">
      <div className="flex h-full w-full max-w-[430px] flex-col bg-white px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded-[6px] border-[1.5px] border-orange-ink px-2 py-0.5 text-[12px] font-bold text-orange-ink">광고</span>
            <span className="text-[13px] text-muted">예시 광고 · 실제 가게가 아니에요</span>
          </div>
          <span className="text-[14px] font-semibold text-ink" aria-live="polite">{n > 0 ? `${n}초` : "끝"}</span>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-line" aria-hidden>
          <div className="h-full bg-navy transition-[width] duration-1000 ease-linear" style={{ width: `${((AD_SECONDS - n) / AD_SECONDS) * 100}%` }} />
        </div>

        <ImageBlock label={ad.place} h="h-[220px]" className="mt-6" />
        <h2 className="mt-5 text-[21px] font-bold leading-snug text-ink">{ad.title}</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{ad.body}</p>

        <div className="mt-auto">
          <p className="mb-3 text-center text-[13px] leading-relaxed text-muted">무료 코스는 광고와 함께 보여 드려요. 이야기는 그동안 미리 불러와 둬요.</p>
          <Button onClick={onDone} disabled={n > 0}>{n > 0 ? `${n}초 뒤에 이야기 보기` : "이야기 보기"}</Button>
          <LinkButton href={`/buddies?course=${courseId}`} variant="secondary" className="mt-3">광고 없이 보기 → 버디 신청</LinkButton>
        </div>
      </div>
    </div>
  );
}

/** "오늘 남은 질문 2/3" */
export function QuestionsLeft({ left, limit, className }: { left: number; limit: number; className?: string }) {
  return <p className={cn("text-[13.5px] text-muted", className)}>오늘 남은 질문 <span className={cn("font-semibold", left === 0 ? "text-orange-ink" : "text-ink")}>{left}/{limit}</span></p>;
}

/** T08b 질문 한도 — 입력칸 대신 보인다 */
export function QuestionLimit({ limit, courseId, className }: { limit: number; courseId: number; className?: string }) {
  return (
    <div className={cn("border-l-[3px] border-orange py-1 pl-4", className)}>
      <p className="text-[16px] font-semibold text-ink">오늘 질문 {limit}번을 다 썼어요</p>
      <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">장소 이야기는 계속 볼 수 있어요. 질문은 내일 다시 {limit}번 할 수 있어요. 버디와 함께 걸으면 버디에게도, AI에게도 제한 없이 물어볼 수 있어요.</p>
      <UpsellLinks courseId={courseId} primary="버디에게 바로 물어보기 → 버디 신청" className="mt-4" />
    </div>
  );
}

/** "도움이 필요해요" — 무료 코스에는 실시간 도움이 없다는 안내 */
export function HelpSheet({ open, onClose, courseId }: { open: boolean; onClose: () => void; courseId: number }) {
  return (
    <BottomSheet open={open} onClose={onClose} title="도움이 필요해요">
      <p className="text-[15px] leading-relaxed text-ink">무료 코스에는 실시간으로 도와드릴 사람이 없어요. 지도와 AI 이야기만 함께해요.</p>
      <div className="mt-4 border-l-[3px] border-red py-1 pl-4">
        <p className="text-[14.5px] font-semibold text-ink">위급하면 바로 전화하세요</p>
        <p className="mt-1 text-[14.5px] leading-relaxed text-muted">경찰 112 · 구급·화재 119 · 관광 통역 안내 1330 (24시간, 영어 가능)</p>
      </div>
      <p className="mt-4 text-[14.5px] leading-relaxed text-muted">버디와 함께 걸으면 같은 동네 대학생이 길 찾기, 식당 주문, 지하철 타기를 옆에서 도와줘요.</p>
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
    <BottomSheet open={open} onClose={onClose} title={done ? "고마워요" : "코스를 다 걸었어요"}>
      {done ? (
        <div>
          <h3 className="text-[21px] font-bold leading-snug text-ink">다음엔 버디와 함께 걸어 보세요</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">같은 동네 대학생 버디가 내 숙소와 시간에 맞춰 동선을 같이 짜요. 광고 없이, 질문도 제한 없이 할 수 있어요.</p>
          <UpsellLinks courseId={courseId} primary="버디 둘러보기" className="mt-5" />
        </div>
      ) : (
        <div>
          <p className="text-[14.5px] text-muted">세 가지만 물어볼게요. 더 나은 코스를 만드는 데 써요.</p>

          <div className="mt-5 text-[15px] font-semibold text-ink">1. 오늘 산책은 어땠나요?</div>
          <div className="mt-2"><Stars value={sat} onChange={setSat} size="text-[30px]" /></div>

          <div className="mt-6 text-[15px] font-semibold text-ink">2. 가장 불편했던 점은요?</div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {keysOf(SURVEY_PAIN).map((k) => <Chip key={k} selected={pain === k} onClick={() => setPain(k)}>{label(SURVEY_PAIN, k)}</Chip>)}
          </div>

          <div className="mt-6 text-[15px] font-semibold text-ink">3. 다음엔 버디와 걸어 볼래요?</div>
          <Segmented className="mt-2.5" value={want} onChange={setWant} options={[{ value: "yes", label: "네, 걸어 볼래요" }, { value: "no", label: "아니요" }]} />

          <ErrorBox message={err} className="mt-4" />
          <Button className="mt-6" onClick={() => void submit()} disabled={!ready || busy}>{busy ? "보내는 중…" : "보내기"}</Button>
        </div>
      )}
    </BottomSheet>
  );
}
