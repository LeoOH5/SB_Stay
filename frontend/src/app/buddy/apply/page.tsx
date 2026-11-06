"use client";
// B06–B10 버디 지원 5단계 — GET /buddy/apply 로 지금 단계를 정하고 (?step=1~5 로 바로 가기)
// 1 학교 메일·인증번호·생년월일·대한민국 국적: POST /buddy/apply/email · /buddy/apply/verify   2 버디 약속: POST /buddy/apply/agree
// 3 교육 퀴즈 10문제: GET/POST /buddy/apply/quiz (8개 이상 통과)   4 성향·소개: PUT /buddy/profile   5 운영팀 확인 중
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { ProfileFields, draftOf, type ProfileDraft } from "@/components/buddy/profile-fields";
import { BottomBar } from "@/components/buddy/ui";
import { Button, Icon, LinkButton, Spinner, StepDots, TopBar, cn, inputCls } from "@/components/ui";
import { BUDDY_MIN_AGE, BUDDY_PROMISES as PROMISES, KOREAN_NATIONAL_NOTE, QUIZ_PASS, QUIZ_TOTAL } from "@/lib/codes";
import { ApiError, get, post, put } from "@/lib/api";
import { useUser } from "@/lib/auth";
import type { BuddyApplyEmailOut, BuddyApplyStatus, BuddyProfile, QuizQuestion, QuizResult } from "@/lib/types";

const OTP_SECONDS = 5 * 60;
const fieldCls = cn(inputCls, "h-[52px] text-[16px]");
const errText = (e: unknown) => (e instanceof Error ? e.message : "다시 시도해 주세요");

function stepOf(s: BuddyApplyStatus): number {
  if (!s.email_verified || !s.age_ok || !s.korean_national) return 1;
  if (!s.code_agreed) return 2;
  if (!s.quiz_passed) return 3;
  if (!s.profile_done) return 4;
  return 5;
}

function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="px-5 pt-5">
      <h1 className="text-[26px] font-bold leading-[1.3] text-ink">{children}</h1>
      {sub && <p className="mt-2 text-[15px] leading-relaxed text-muted">{sub}</p>}
    </div>
  );
}

function ApplyPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { user } = useUser();
  const [status, setStatus] = useState<BuddyApplyStatus | null>(null);
  const [step, setStep] = useState<number | null>(null);
  const [quizIdx, setQuizIdx] = useState(0);

  const refresh = useCallback(async () => { const s = await get<BuddyApplyStatus>("/buddy/apply"); setStatus(s); return s; }, []);
  useEffect(() => {
    const forced = Number(sp.get("step"));
    get<BuddyApplyStatus>("/buddy/apply")
      .then((s) => { setStatus(s); setStep(forced >= 1 && forced <= 5 ? forced : stepOf(s)); })
      .catch(() => setStep(forced >= 1 && forced <= 5 ? forced : 1));
  }, [sp]);

  const go = (n: number) => { setStep(n); window.scrollTo(0, 0); };
  const back = () => {
    if (step === 3 && quizIdx > 0) { setQuizIdx((i) => i - 1); return; }
    if (step && step > 1 && step < 5) go(step - 1);
    else router.push("/buddy/login");
  };

  return (
    <>
      <TopBar onBack={back} right={step ? <span className="text-muted">{step} / 5</span> : undefined} />
      <div className="px-5 pt-1"><StepDots step={step ?? 0} /></div>
      {step === null && <Spinner />}
      {step === 1 && <EmailStep status={status} userEmail={user?.email} onDone={async () => { await refresh().catch(() => null); go(2); }} />}
      {step === 2 && <PromiseStep onDone={async () => { await refresh().catch(() => null); go(3); }} />}
      {step === 3 && <QuizStep idx={quizIdx} setIdx={setQuizIdx} onDone={async () => { await refresh().catch(() => null); go(4); }} />}
      {step === 4 && <ProfileStep onDone={async () => { await refresh().catch(() => null); go(5); }} />}
      {step === 5 && <ReviewStep status={status} />}
    </>
  );
}

/* ------------------------------------------------------------------ 1 학교 메일 */
function EmailStep({ status, userEmail, onDone }: { status: BuddyApplyStatus | null; userEmail?: string; onDone: () => void }) {
  const [email, setEmail] = useState(status?.school_email ?? (userEmail?.endsWith(".ac.kr") ? userEmail : ""));
  const [univ, setUniv] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [birth, setBirth] = useState("");
  const [korean, setKorean] = useState(!!status?.korean_national);
  const [expires, setExpires] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ field: "email" | "code" | "birth" | "national" | "all"; msg: string } | null>(null);

  useEffect(() => {
    if (!expires) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [expires]);
  const left = expires ? Math.max(0, Math.round((expires - now) / 1000)) : 0;

  const send = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await post<BuddyApplyEmailOut>("/buddy/apply/email", { email: email.trim() });
      setUniv(r.university); setDevCode(r.dev_code ?? null); setExpires(Date.now() + OTP_SECONDS * 1000); setNow(Date.now()); setCode("");
    } catch (e) { setErr({ field: "email", msg: errText(e) }); setUniv(null); }
    finally { setBusy(false); }
  };
  const verify = async () => {
    setBusy(true); setErr(null);
    try { await post<BuddyApplyStatus>("/buddy/apply/verify", { email: email.trim(), code, birth_date: birth, korean_national: korean }); onDone(); }
    catch (e) {
      const c = e instanceof ApiError ? e.code : "";
      setErr({ field: c === "BAD_CODE" ? "code" : c === "TOO_YOUNG" || c === "VALIDATION" ? "birth" : c === "NOT_SEONGBUK_SCHOOL" ? "email" : c === "NOT_KOREAN_NATIONAL" ? "national" : "all", msg: errText(e) });
    } finally { setBusy(false); }
  };

  const sent = !!univ;
  return (
    <>
      <Title sub="성북구 대학 메일만 받아요. 소속 대학이 자동으로 정해져요.">학교 메일로<br />재학생 인증</Title>
      <div className="px-5 pb-6 pt-6">
        <label className="block">
          <span className="mb-2 block text-[14px] font-semibold text-ink">학교 이메일</span>
          <span className="relative block">
            <input className={cn(fieldCls, sent && "pr-32")} type="email" autoComplete="email" value={email} placeholder="you@univ.ac.kr"
              onChange={(e) => { setEmail(e.target.value); setUniv(null); setExpires(null); }} />
            {sent && <span className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-1.5 text-[14px] font-semibold text-navy"><span className="h-1.5 w-1.5 rounded-full bg-navy" />{univ}</span>}
          </span>
        </label>
        {err?.field === "email" && <p className="mt-2 text-[14px] font-semibold text-red">{err.msg}</p>}

        <div className="mt-4 flex gap-2.5">
          <input className={cn(fieldCls, "flex-1 tracking-[0.12em]")} inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="인증번호 6자리" aria-label="인증번호"
            value={code.length > 3 ? `${code.slice(0, 3)} ${code.slice(3)}` : code} disabled={!sent} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
          <Button variant="secondary" full={false} className="min-h-[52px] shrink-0 px-4 text-[15px]" onClick={send} disabled={busy || !/@[\w.-]+\.[a-z]{2,}$/i.test(email.trim())}>{sent ? "다시 받기" : "인증번호 받기"}</Button>
        </div>
        <p className={cn("mt-2 text-[14px]", err?.field === "code" ? "font-semibold text-red" : "text-muted")}>
          {err?.field === "code" ? err.msg : sent ? `메일로 받은 6자리를 넣어 주세요 · ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")} 남음` : "학교 메일을 넣고 인증번호를 받아 주세요"}
        </p>
        {sent && devCode && <p className="mt-1 text-[13px] text-muted">데모 인증번호 {devCode}</p>}

        <label className="mt-6 block">
          <span className="mb-2 block text-[14px] font-semibold text-ink">생년월일</span>
          <input className={fieldCls} type="date" value={birth} max="2015-12-31" min="1950-01-01" onChange={(e) => setBirth(e.target.value)} />
        </label>
        <p className={cn("mt-2 text-[14px]", err?.field === "birth" ? "font-semibold text-red" : "text-muted")}>{err?.field === "birth" ? err.msg : `만 ${BUDDY_MIN_AGE}세 이상만 버디로 활동할 수 있어요`}</p>

        <button type="button" role="checkbox" aria-checked={korean} onClick={() => setKorean((v) => !v)} className="mt-6 flex w-full items-start gap-3 text-left">
          <span className={cn("mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] border-[1.5px] transition", korean ? "border-navy bg-navy text-white" : "border-[#C9CED3] bg-white")}>
            {korean && <Icon name="check" className="h-4 w-4" strokeWidth={2.8} />}
          </span>
          <span className="text-[16px] font-semibold text-ink">대한민국 국적이에요 <span className="text-[14px] font-normal text-muted">(필수)</span></span>
        </button>
        <p className={cn("mt-1.5 pl-[34px] text-[14px]", err?.field === "national" ? "font-semibold text-red" : "text-muted")}>{err?.field === "national" ? err.msg : KOREAN_NATIONAL_NOTE}</p>
        {err?.field === "all" && <p className="mt-3 text-[14px] font-semibold text-red">{err.msg}</p>}
      </div>
      <BottomBar>
        <Button onClick={verify} disabled={busy || !sent || code.length !== 6 || !birth || !korean || left === 0}>{busy ? "확인하는 중…" : "인증하고 다음"}</Button>
      </BottomBar>
    </>
  );
}

/* ------------------------------------------------------------------ 2 버디 약속 */
function PromiseStep({ onDone }: { onDone: () => void }) {
  const [checked, setChecked] = useState<boolean[]>(PROMISES.map(() => false));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const all = checked.every(Boolean);
  const agree = async () => {
    setBusy(true); setErr(null);
    try { await post("/buddy/apply/agree"); onDone(); } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };
  return (
    <>
      <Title sub="여행자와 나를 지키는 약속이에요. 모두 확인해 주세요.">버디 약속</Title>
      <div className="px-5 pb-6 pt-4">
        <div className="divide-y divide-line">
          {PROMISES.map((p, i) => (
            <button key={i} type="button" role="checkbox" aria-checked={checked[i]} onClick={() => setChecked((c) => c.map((v, k) => (k === i ? !v : v)))}
              className="flex w-full items-start gap-3.5 py-4 text-left">
              <span className={cn("mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] border-[1.5px] transition", checked[i] ? "border-navy bg-navy text-white" : "border-[#C9CED3] bg-white")}>
                {checked[i] && <Icon name="check" className="h-4 w-4" strokeWidth={2.8} />}
              </span>
              <span className="text-[16px] leading-relaxed text-ink">{p}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-[14px] text-muted">신고가 2번 들어오면 확인할 때까지 활동이 자동으로 멈춰요.</p>
        {err && <p className="mt-3 text-[14px] font-semibold text-red">{err}</p>}
      </div>
      <BottomBar>
        <Button onClick={agree} disabled={busy || !all}>{all ? "약속하고 다음" : "모두 확인하면 다음"}</Button>
      </BottomBar>
    </>
  );
}

/* ------------------------------------------------------------------ 3 교육 퀴즈 */
function QuizStep({ idx, setIdx, onDone }: { idx: number; setIdx: (n: number) => void; onDone: () => void }) {
  const [qs, setQs] = useState<QuizQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    get<{ questions: QuizQuestion[] }>("/buddy/apply/quiz").then((r) => setQs(r.questions)).catch((e: unknown) => setErr(errText(e)));
  }, []);

  const q = qs?.[idx];
  const total = qs?.length ?? QUIZ_TOTAL;
  const answered = Object.keys(answers).length;
  const last = idx === total - 1;
  const submit = async () => {
    setBusy(true); setErr(null);
    try { setResult(await post<QuizResult>("/buddy/apply/quiz", { answers })); } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };
  const retry = () => { setAnswers({}); setResult(null); setIdx(0); };

  return (
    <>
      <Title sub={`${total}문제 중 ${QUIZ_PASS}문제를 맞히면 통과예요.`}>짧은 교육 퀴즈</Title>
      <div className="px-5 pb-6 pt-6">
        {!qs && !err && <Spinner />}
        {err && <p className="text-[14px] font-semibold text-red">{err}</p>}
        {result ? (
          <div className="rounded-[18px] border border-line px-5 py-6 text-center">
            <div className={cn("mx-auto flex h-14 w-14 items-center justify-center rounded-full", result.passed ? "bg-navy-bg text-navy" : "bg-orange-bg text-orange")}>
              <Icon name={result.passed ? "check" : "info"} className="h-7 w-7" strokeWidth={2.2} />
            </div>
            <div className="mt-4 text-[22px] font-bold text-ink">{result.score} / {result.total}</div>
            <p className="mt-1.5 text-[15px] text-muted">{result.passed ? "통과했어요! 이제 나를 소개해 주세요." : `${QUIZ_PASS}문제 이상 맞혀야 해요. 버디 약속을 다시 읽고 풀어 봐요.`}</p>
          </div>
        ) : q && (
          <div className="rounded-[18px] border border-line px-5 pb-5 pt-4">
            <div className="flex items-center justify-between text-[14px] text-muted">
              <span>{idx + 1} / {total}</span><span>답한 문제 {answered}</span>
            </div>
            <h2 className="mt-3 text-[17px] font-bold leading-relaxed text-ink">{q.text}</h2>
            <div role="radiogroup" className="mt-4 space-y-2.5">
              {q.options.map((o, k) => {
                const on = answers[q.id] === k;
                return (
                  <button key={k} type="button" role="radio" aria-checked={on} onClick={() => setAnswers((a) => ({ ...a, [q.id]: k }))}
                    className={cn("flex w-full items-center gap-3.5 rounded-[14px] border px-4 py-3.5 text-left transition", on ? "border-navy bg-navy-bg" : "border-line bg-white hover:border-navy/40")}>
                    <span className={cn("flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2", on ? "border-navy bg-navy" : "border-[#C9CED3] bg-white")}>{on && <span className="h-2 w-2 rounded-full bg-white" />}</span>
                    <span className="text-[16px] leading-relaxed text-ink">{o}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <BottomBar>
        {result ? (
          result.passed ? <Button onClick={onDone}>다음</Button> : <Button onClick={retry}>다시 풀기</Button>
        ) : (
          <Button onClick={last ? submit : () => setIdx(idx + 1)} disabled={busy || !q || answers[q.id] === undefined || (last && answered < total)}>
            {last ? (busy ? "채점하는 중…" : "채점하기") : "다음 문제"}
          </Button>
        )}
      </BottomBar>
    </>
  );
}

/* ------------------------------------------------------------------ 4 어떤 버디인가요 */
function ProfileStep({ onDone }: { onDone: () => void }) {
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    get<BuddyProfile>("/buddy/profile").then((p) => setDraft(draftOf(p))).catch(() => setDraft(draftOf(null)));
  }, []);
  const ok = !!draft && draft.personality.length > 0 && draft.style.length > 0 && draft.intro.trim().length > 0;
  const save = async () => {
    if (!draft) return;
    setBusy(true); setErr(null);
    try { await put<BuddyProfile>("/buddy/profile", { ...draft, intro: draft.intro.trim() }); onDone(); } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };
  return (
    <>
      <Title sub="여행자가 버디를 고를 때 보고, AI 추천에도 쓰여요.">어떤 버디인가요?</Title>
      <div className="px-5 pb-6 pt-6">
        {!draft ? <Spinner /> : <ProfileFields value={draft} onChange={setDraft} />}
        {err && <p className="mt-3 text-[14px] font-semibold text-red">{err}</p>}
      </div>
      <BottomBar note={draft && !ok ? "성격·스타일을 하나 이상 고르고 소개를 적어 주세요" : undefined}>
        <Button onClick={save} disabled={busy || !ok}>{busy ? "보내는 중…" : "지원서 내기"}</Button>
      </BottomBar>
    </>
  );
}

/* ------------------------------------------------------------------ 5 확인 중 */
function Check({ done, wait, title, sub, last }: { done: boolean; wait?: boolean; title: string; sub: string; last?: boolean }) {
  return (
    <div className="flex gap-3.5">
      <div className="flex flex-col items-center">
        {done ? <span className="flex h-6 w-6 items-center justify-center rounded-full bg-navy text-white"><Icon name="check" className="h-4 w-4" strokeWidth={2.6} /></span>
          : <span className={cn("h-6 w-6 rounded-full border-2 bg-white", wait ? "border-orange" : "border-[#C9CED3]")} />}
        {!last && <span className="mt-1.5 w-0 flex-1 border-l-2 border-dashed border-line" />}
      </div>
      <div className={cn("min-w-0", !last && "pb-6")}>
        <div className="text-[16px] font-semibold leading-6 text-ink">{title}</div>
        <div className="mt-0.5 text-[14px] text-muted">{sub}</div>
      </div>
    </div>
  );
}

function ReviewStep({ status: s }: { status: BuddyApplyStatus | null }) {
  if (!s) return <Spinner />;
  const approved = s.status === "approved", suspended = s.status === "suspended";
  return (
    <>
      <div className="px-5 pt-7">
        <span className={cn("flex h-14 w-14 items-center justify-center rounded-full", approved ? "bg-navy-bg text-navy" : "bg-orange-bg text-orange")}>
          <Icon name={approved ? "check" : "clock"} className="h-6 w-6" strokeWidth={2} />
        </span>
      </div>
      <Title sub={approved ? "요청함이 열렸어요. 가능한 날짜를 열어 두면 여행자의 요청이 들어와요." : suspended ? "신고를 확인하는 동안 활동이 멈춰 있어요. 운영팀이 연락드릴게요." : "보통 2일 안에 알려 드려요. 승인되면 요청함이 열려요."}>
        {approved ? <>승인됐어요.<br />환영해요!</> : suspended ? <>활동이<br />잠시 멈췄어요</> : <>운영팀이<br />살펴보고 있어요</>}
      </Title>
      <div className="px-5 pb-6 pt-7">
        <Check done={s.email_verified && s.age_ok} title="학교 메일 인증" sub={s.email_verified ? `${s.university ?? "학교"} · 만 ${BUDDY_MIN_AGE}세 이상` : "아직 안 했어요"} />
        <Check done={s.korean_national} title="대한민국 국적 확인" sub={s.korean_national ? "확인했어요" : "아직 안 했어요"} />
        <Check done={s.code_agreed} title="버디 약속 동의" sub={s.code_agreed ? `${PROMISES.length}개 모두 확인` : "아직 안 했어요"} />
        <Check done={s.quiz_passed} title="교육 퀴즈 통과" sub={s.quiz_score != null ? `${s.quiz_score} / ${QUIZ_TOTAL}` : "아직 안 풀었어요"} />
        <Check done={approved} wait={!approved} last title="운영팀 승인" sub={approved ? "승인됐어요" : suspended ? "활동 멈춤" : "기다리는 중"} />
      </div>
      <BottomBar>
        {approved ? <LinkButton href="/buddy">버디 홈으로</LinkButton> : <LinkButton href="/" variant="ghost" className="border-[#C9CED3]">홈으로</LinkButton>}
      </BottomBar>
    </>
  );
}

export default function Page() {
  return <Suspense fallback={<Spinner />}><ApplyPage /></Suspense>;
}
