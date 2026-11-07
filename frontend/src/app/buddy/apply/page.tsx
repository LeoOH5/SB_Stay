"use client";
// B06–B10 버디 지원 6단계 — GET /buddy/apply 로 지금 단계를 정하고 (?step=1~6 로 바로 가기)
// 1 자격 확인 (v3.7 두 경로): 성북구 대학 메일 — POST /buddy/apply/email · /buddy/apply/verify
//   또는 성북구 거주 — 주소 증빙·재학 증명 사진(POST /uploads) + POST /buddy/apply/residence (운영팀이 승인 때 확인). 둘 다 생년월일·대한민국 국적
// 2 버디 약속: POST /buddy/apply/agree   3 사전 교육 영상 5개: GET /buddy/apply/education · POST /buddy/apply/education/{id}
// 4 교육 퀴즈 10문제: GET/POST /buddy/apply/quiz (영상을 다 봐야 열림, 8개 이상 통과)   5 성향·소개: PUT /buddy/profile   6 운영팀 확인 중
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ProfileFields, draftOf, type ProfileDraft } from "@/components/buddy/profile-fields";
import { BottomBar } from "@/components/buddy/ui";
import { UploadThumb, usePhotoUploads } from "@/components/photo-upload";
import { Button, Icon, LinkButton, Spinner, StepDots, TopBar, cn, inputCls } from "@/components/ui";
import { BUDDY_MIN_AGE, BUDDY_PROMISES as PROMISES, KOREAN_NATIONAL_NOTE, QUIZ_PASS, QUIZ_TOTAL } from "@/lib/codes";
import { ApiError, get, patch, post, put } from "@/lib/api";
import { session, useUser } from "@/lib/auth";
import { UPLOAD_ACCEPT } from "@/lib/uploads";
import type { User, BuddyApplyEmailOut, BuddyApplyStatus, BuddyProfile, EducationOut, Eligibility, QuizQuestion, QuizResult } from "@/lib/types";

const STEPS = 6;
const OTP_SECONDS = 5 * 60;
const fieldCls = cn(inputCls, "h-[52px] text-[16px]");
const errText = (e: unknown) => (e instanceof Error ? e.message : "다시 시도해 주세요");

function stepOf(s: BuddyApplyStatus): number {
  if (!s.eligible || !s.age_ok || !s.korean_national) return 1;
  if (!s.code_agreed) return 2;
  if (!s.education_done) return 3;
  if (!s.quiz_passed) return 4;
  if (!s.profile_done) return 5;
  return 6;
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
  // 지원은 버디 역할 계정만 할 수 있다 (서버 403).
  // 로그인 안 했으면 회원가입부터(가입 뒤 이 화면으로), 여행자 계정이면 버디로 바로 바꿔 1단계(학교 메일 인증)부터 시작한다
  const [gateErr, setGateErr] = useState<string | null>(null);
  const needsRole = !!user && user.role === "tourist";
  const isAdmin = !!user && (user.role === "univ_admin" || user.role === "operator");
  // 첫 렌더(하이드레이션 전)에는 저장된 로그인 정보를 아직 못 읽어 user 가 비어 보인다 → 다 읽은 뒤에만 판단
  const hydrated = useSyncExternalStore(() => () => {}, () => true, () => false);
  useEffect(() => {
    if (hydrated && !user) router.replace("/signup?next=/buddy/apply");
  }, [hydrated, user, router]);
  useEffect(() => {
    if (!user || user.role === "tourist") return;
    const forced = Number(sp.get("step"));
    const ok = forced >= 1 && forced <= STEPS;
    get<BuddyApplyStatus>("/buddy/apply")
      .then((s) => { setStatus(s); setStep(ok ? forced : stepOf(s)); })
      .catch(() => setStep(ok ? forced : 1));
  }, [sp, user]);
  const switched = useRef(false);
  useEffect(() => {
    if (!needsRole || switched.current) return;
    switched.current = true; // 한 번만 시도 (실패하면 안내 화면)
    patch<User>("/auth/me/role", { role: "buddy" })
      .then((u) => session.update({ role: u?.role ?? "buddy" }))
      .catch((e: unknown) => setGateErr(errText(e)));
  }, [needsRole]);
  const newAccount = () => { session.clear(); router.push("/signup?next=/buddy/apply"); };

  if (!user) return <Spinner />;
  if (isAdmin || (needsRole && gateErr)) {
    return (
      <div className="px-5 pb-10 pt-10">
        <Title sub={isAdmin ? "관리자 계정으로는 버디 지원을 할 수 없어요. 새 계정을 만들어 지원해 주세요." : gateErr ?? ""}>이 계정으로는 지원할 수 없어요</Title>
        <Button className="mt-8" onClick={newAccount}>새 계정으로 지원하기</Button>
        <LinkButton href="/" variant="ghost" className="mt-3">처음 화면으로</LinkButton>
      </div>
    );
  }
  if (needsRole) return <Spinner />;

  const go = (n: number) => { setStep(n); window.scrollTo(0, 0); };
  const back = () => {
    if (step === 4 && quizIdx > 0) { setQuizIdx((i) => i - 1); return; }
    if (step && step > 1 && step < STEPS) go(step - 1);
    else router.push("/"); // 1단계·지원 완료 화면에서 뒤로 → 첫 화면 (버디 신청하기 버튼이 있는 곳)
  };
  const next = (n: number) => async () => { await refresh().catch(() => null); go(n); };

  return (
    <>
      <TopBar onBack={back} right={step ? <span className="text-muted">{step} / {STEPS}</span> : undefined} />
      <div className="px-5 pt-1"><StepDots step={step ?? 0} total={STEPS} /></div>
      {step === null && <Spinner />}
      {step === 1 && <EligibilityStep status={status} userEmail={user?.email} onDone={next(2)} />}
      {step === 2 && <PromiseStep onDone={next(3)} />}
      {step === 3 && <EducationStep onDone={next(4)} />}
      {step === 4 && <QuizStep idx={quizIdx} setIdx={setQuizIdx} onDone={next(5)} />}
      {step === 5 && <ProfileStep onDone={next(6)} />}
      {step === 6 && <ReviewStep status={status} />}
    </>
  );
}

/* ------------------------------------------------------------------ 1 자격 확인 (두 경로) */
const PATHS: { key: Eligibility; title: string; sub: string }[] = [
  { key: "school_email", title: "성북구 대학에 다녀요", sub: "학교 메일로 바로 인증" },
  { key: "residence", title: "성북구에 살아요", sub: "다른 대학이어도 괜찮아요" },
];

function EligibilityStep({ status, userEmail, onDone }: { status: BuddyApplyStatus | null; userEmail?: string; onDone: () => void }) {
  const [path, setPath] = useState<Eligibility>(status?.eligibility ?? "school_email");
  const [birth, setBirth] = useState("");
  const [korean, setKorean] = useState(!!status?.korean_national);
  const [err, setErr] = useState<{ field: "birth" | "national"; msg: string } | null>(null);
  const person = { birth, korean, setErr };
  return (
    <>
      <Title sub="성북구 대학에 다니거나, 성북구에 사는 대학생이면 지원할 수 있어요.">버디 자격 확인</Title>
      <div className="px-5 pt-6">
        <div role="radiogroup" aria-label="자격 경로" className="grid grid-cols-2 gap-2.5">
          {PATHS.map((p) => {
            const on = path === p.key;
            return (
              <button key={p.key} type="button" role="radio" aria-checked={on} onClick={() => setPath(p.key)}
                className={cn("rounded-[14px] border px-4 py-3.5 text-left transition", on ? "border-navy bg-navy-bg" : "border-line bg-white hover:border-navy/40")}>
                <span className="block text-[15px] font-semibold text-ink">{p.title}</span>
                <span className="mt-0.5 block text-[13px] text-muted">{p.sub}</span>
              </button>
            );
          })}
        </div>
      </div>
      {path === "school_email"
        ? <EmailPath status={status} userEmail={userEmail} person={person} onDone={onDone} personFields={<PersonFields birth={birth} setBirth={setBirth} korean={korean} setKorean={setKorean} err={err} />} />
        : <ResidencePath status={status} person={person} onDone={onDone} personFields={<PersonFields birth={birth} setBirth={setBirth} korean={korean} setKorean={setKorean} err={err} />} />}
    </>
  );
}

type Person = { birth: string; korean: boolean; setErr: (e: { field: "birth" | "national"; msg: string } | null) => void };

/** 생년월일 · 대한민국 국적 (두 경로 공통) */
function PersonFields({ birth, setBirth, korean, setKorean, err }: { birth: string; setBirth: (v: string) => void; korean: boolean; setKorean: (f: (v: boolean) => boolean) => void; err: { field: string; msg: string } | null }) {
  return (
    <>
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
    </>
  );
}

function personErr(e: unknown, set: Person["setErr"]): string | null {
  const c = e instanceof ApiError ? e.code : "";
  if (c === "TOO_YOUNG" || c === "VALIDATION") { set({ field: "birth", msg: errText(e) }); return null; }
  if (c === "NOT_KOREAN_NATIONAL") { set({ field: "national", msg: errText(e) }); return null; }
  return errText(e);
}

function EmailPath({ status, userEmail, person, personFields, onDone }: { status: BuddyApplyStatus | null; userEmail?: string; person: Person; personFields: ReactNode; onDone: () => void }) {
  const [email, setEmail] = useState(status?.school_email ?? (userEmail?.endsWith(".ac.kr") ? userEmail : ""));
  const [univ, setUniv] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [expires, setExpires] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [err, setErr] = useState<{ field: "email" | "code" | "all"; msg: string } | null>(null);

  useEffect(() => {
    if (!expires || verified) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [expires, verified]);
  const left = expires ? Math.max(0, Math.round((expires - now) / 1000)) : 0;

  const send = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await post<BuddyApplyEmailOut>("/buddy/apply/email", { email: email.trim() });
      setUniv(r.university); setDevCode(r.dev_code ?? null); setExpires(Date.now() + OTP_SECONDS * 1000); setNow(Date.now()); setCode(""); setVerified(false);
    } catch (e) {
      // 1분 안에 다시 받기를 누른 경우: 이미 보낸 번호는 그대로 쓸 수 있게 화면을 유지한다
      if (e instanceof ApiError && e.code === "TOO_SOON") setErr({ field: "code", msg: errText(e) });
      else { setErr({ field: "email", msg: errText(e) }); setUniv(null); }
    }
    finally { setBusy(false); }
  };
  /** '인증하기' — 번호만 먼저 확인 (POST /buddy/apply/email/check). 번호는 다음 단계에서 쓴다 */
  const check = async () => {
    setBusy(true); setErr(null);
    try { await post<{ verified: boolean }>("/buddy/apply/email/check", { email: email.trim(), code }); setVerified(true); }
    catch (e) { setErr({ field: "code", msg: errText(e) }); }
    finally { setBusy(false); }
  };
  const verify = async () => {
    setBusy(true); setErr(null); person.setErr(null);
    try { await post<BuddyApplyStatus>("/buddy/apply/verify", { email: email.trim(), code, birth_date: person.birth, korean_national: person.korean }); onDone(); }
    catch (e) {
      const c = e instanceof ApiError ? e.code : "";
      if (c === "BAD_CODE" || c === "CODE_EXPIRED" || c === "TOO_MANY_ATTEMPTS") setErr({ field: "code", msg: errText(e) });
      else if (c === "NOT_SEONGBUK_SCHOOL") setErr({ field: "email", msg: errText(e) });
      else { const rest = personErr(e, person.setErr); if (rest) setErr({ field: "all", msg: rest }); }
    } finally { setBusy(false); }
  };

  const sent = !!univ;
  return (
    <>
      <div className="px-5 pb-6 pt-6">
        <label className="block">
          <span className="mb-2 block text-[14px] font-semibold text-ink">학교 이메일</span>
          <span className="relative block">
            <input className={cn(fieldCls, sent && "pr-32")} type="email" autoComplete="email" value={email} placeholder="you@univ.ac.kr"
              disabled={verified} onChange={(e) => { setEmail(e.target.value); setUniv(null); setExpires(null); setVerified(false); }} />
            {sent && <span className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-1.5 text-[14px] font-semibold text-navy"><span className="h-1.5 w-1.5 rounded-full bg-navy" />{univ}</span>}
          </span>
        </label>
        <p className={cn("mt-2 text-[14px]", err?.field === "email" ? "font-semibold text-red" : "text-muted")}>{err?.field === "email" ? err.msg : "성북구 대학 메일만 받아요. 소속 대학이 자동으로 정해져요."}</p>

        <div className="mt-4 flex gap-2.5">
          <input className={cn(fieldCls, "flex-1 tracking-[0.12em]")} inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="인증번호 6자리" aria-label="인증번호"
            value={code.length > 3 ? `${code.slice(0, 3)} ${code.slice(3)}` : code} disabled={!sent || verified} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
          {sent && (
            <Button variant={verified ? "ghost" : "primary"} full={false} className="min-h-[52px] shrink-0 px-3.5 text-[15px]" onClick={check} disabled={busy || verified || code.length !== 6 || left === 0}>{verified ? "인증됨" : "인증하기"}</Button>
          )}
          {!verified && <Button variant="secondary" full={false} className="min-h-[52px] shrink-0 px-3.5 text-[15px]" onClick={send} disabled={busy || !/@[\w.-]+\.[a-z]{2,}$/i.test(email.trim())}>{sent ? "다시 받기" : "인증번호 받기"}</Button>}
        </div>
        <p className={cn("mt-2 text-[14px]", err?.field === "code" ? "font-semibold text-red" : verified ? "font-semibold text-navy" : "text-muted")}>
          {err?.field === "code" ? err.msg : verified ? "✓ 학교 메일 인증이 끝났어요" : sent ? `메일로 받은 6자리를 넣고 인증하기를 눌러 주세요 · ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")} 남음` : "학교 메일을 넣고 인증번호를 받아 주세요"}
        </p>
        {sent && devCode && <p className="mt-1 text-[13px] text-muted">데모 인증번호 {devCode}</p>}
        {personFields}
        {err?.field === "all" && <p className="mt-3 text-[14px] font-semibold text-red">{err.msg}</p>}
      </div>
      <BottomBar>
        <Button onClick={verify} disabled={busy || !verified || !person.birth || !person.korean}>{busy ? "확인하는 중…" : verified ? "다음" : "메일 인증을 먼저 해 주세요"}</Button>
      </BottomBar>
    </>
  );
}

/** 사진 한 장 칸 (주소 증빙 · 재학 증명) */
function ProofPicker({ title, hint, upload }: { title: string; hint: string; upload: ReturnType<typeof usePhotoUploads> }) {
  const ref = useRef<HTMLInputElement>(null);
  const slot = upload.slots[0];
  return (
    <div className="mt-3">
      <input ref={ref} type="file" accept={UPLOAD_ACCEPT} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { upload.clear(); upload.add([f]); } e.target.value = ""; }} />
      {slot ? (
        <div className="flex items-center gap-4 rounded-[16px] border-[1.5px] border-navy/40 p-3">
          <UploadThumb slot={slot} onRemove={upload.clear} onRetry={() => upload.retry(slot.key)} className="h-[84px] w-[68px] shrink-0 rounded-[10px]" />
          <div className="min-w-0 flex-1">
            <div className={cn("text-[15px] font-semibold", slot.error ? "text-red" : "text-ink")}>{slot.error ? "올리지 못했어요" : slot.url ? `${title} 올렸어요` : "올리는 중…"}</div>
            <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{slot.error ?? hint}</p>
            <button type="button" onClick={() => ref.current?.click()} className="mt-1.5 text-[14px] font-semibold text-navy">다른 사진으로 바꾸기</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()}
          className="flex w-full items-center gap-3.5 rounded-[16px] border-[1.5px] border-dashed border-[#C9CED3] px-4 py-4 text-left transition hover:bg-gray-bg">
          <Icon name="camera" className="h-6 w-6 shrink-0 text-ink" />
          <span className="min-w-0"><span className="block text-[16px] font-semibold text-ink">{title}</span><span className="mt-0.5 block text-[13px] text-muted">{hint}</span></span>
        </button>
      )}
    </div>
  );
}

function ResidencePath({ status, person, personFields, onDone }: { status: BuddyApplyStatus | null; person: Person; personFields: ReactNode; onDone: () => void }) {
  const [school, setSchool] = useState(status?.school_name ?? "");
  const address = usePhotoUploads(1);
  const enroll = usePhotoUploads(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const addressUrl = address.urls[0] ?? status?.residence_proof_url ?? null;
  const enrollUrl = enroll.urls[0] ?? status?.enrollment_proof_url ?? null;
  const submit = async () => {
    setBusy(true); setErr(null); person.setErr(null);
    try {
      await post<BuddyApplyStatus>("/buddy/apply/residence", { school_name: school.trim(), residence_proof_url: addressUrl, enrollment_proof_url: enrollUrl, birth_date: person.birth, korean_national: person.korean });
      onDone();
    } catch (e) { setErr(personErr(e, person.setErr)); } finally { setBusy(false); }
  };
  const uploading = address.uploading || enroll.uploading;
  return (
    <>
      <div className="px-5 pb-6 pt-6">
        <label className="block">
          <span className="mb-2 block text-[14px] font-semibold text-ink">다니는 대학</span>
          <input className={fieldCls} value={school} maxLength={100} placeholder="예: 서울시립대학교" onChange={(e) => setSchool(e.target.value)} />
        </label>
        <p className="mt-2 text-[14px] text-muted">어느 대학이든 괜찮아요. 성북구에 사는 대학생이면 지원할 수 있어요.</p>

        <div className="mt-6 text-[14px] font-semibold text-ink">서류 두 장</div>
        <ProofPicker title="성북구 주소 증빙" hint="주민등록초본·등본 등 성북구 주소가 보이는 서류. 주민번호 뒷자리는 가려 주세요" upload={address} />
        <ProofPicker title="재학 증명" hint="재학증명서 또는 학생증 사진" upload={enroll} />
        <p className="mt-2.5 text-[13px] leading-relaxed text-muted">운영팀이 승인할 때 두 서류를 보고 확인해요. 확인에만 쓰고, 다른 사람에게 보여 주지 않아요.</p>
        {personFields}
        {err && <p className="mt-3 text-[14px] font-semibold text-red">{err}</p>}
      </div>
      <BottomBar note={!addressUrl || !enrollUrl ? "서류 두 장을 올려 주세요" : undefined}>
        <Button onClick={submit} disabled={busy || uploading || school.trim().length < 2 || !addressUrl || !enrollUrl || !person.birth || !person.korean}>{busy ? "보내는 중…" : "서류 내고 다음"}</Button>
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

/* ------------------------------------------------------------------ 3 사전 교육 영상 */
const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

function EducationStep({ onDone }: { onDone: () => void }) {
  const [edu, setEdu] = useState<EducationOut | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { get<EducationOut>("/buddy/apply/education").then(setEdu).catch((e: unknown) => setErr(errText(e))); }, []);
  const watch = async (id: string) => {
    setBusy(id); setErr(null);
    try { setEdu(await post<EducationOut>(`/buddy/apply/education/${id}`)); } catch (e) { setErr(errText(e)); } finally { setBusy(null); }
  };
  return (
    <>
      <Title sub="성북구의 길·교통·안전과 역사 기본 상식을 짧게 봐요. 다 보면 퀴즈가 열려요.">사전 교육 영상</Title>
      <div className="px-5 pb-6 pt-5">
        {!edu && !err && <Spinner />}
        {err && <p className="text-[14px] font-semibold text-red">{err}</p>}
        {edu && (
          <>
            <div className="flex items-center justify-between text-[14px]"><span className="text-muted">영상 {edu.total}개 · 모두 합쳐 약 {Math.round(edu.videos.reduce((t, v) => t + v.duration_sec, 0) / 60)}분</span><span className="font-semibold text-navy">{edu.watched} / {edu.total} 봤어요</span></div>
            <ol className="mt-3 divide-y divide-line border-y border-line">
              {edu.videos.map((v, i) => (
                <li key={v.id} className="flex gap-3.5 py-4">
                  <div className="relative flex h-[64px] w-[96px] shrink-0 items-center justify-center rounded-[10px] bg-[#2B3A4D] text-white" aria-hidden>
                    <svg viewBox="0 0 24 24" className="h-6 w-6 opacity-80" fill="currentColor"><path d="M8 5.5v13l10.5-6.5z" /></svg>
                    <span className="absolute bottom-1 right-1.5 text-[11px] font-semibold">{mmss(v.duration_sec)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[16px] font-semibold leading-snug text-ink">{i + 1}. {v.title}</div>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{v.topics}</p>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <span className="text-[12px] text-muted">{v.video_url ? "" : "영상 준비 중 · 요약 먼저"}</span>
                      {v.watched
                        ? <span className="flex shrink-0 items-center gap-1 text-[14px] font-semibold text-navy"><Icon name="check" className="h-4 w-4" strokeWidth={2.6} />봤어요</span>
                        : <button type="button" onClick={() => watch(v.id)} disabled={busy === v.id} className="shrink-0 rounded-full border border-navy px-3 py-1 text-[14px] font-semibold text-navy disabled:opacity-50">다 봤어요</button>}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[13px] leading-relaxed text-muted">역사 영상은 해설이 아니라 기본 상식이에요. 버디는 돈을 받고 역사 해설을 하지 않고, 장소 이야기는 앱의 AI가 들려줘요.</p>
          </>
        )}
      </div>
      <BottomBar>
        <Button onClick={onDone} disabled={!edu?.done}>{edu?.done ? "퀴즈 풀기" : "영상을 다 보면 퀴즈가 열려요"}</Button>
      </BottomBar>
    </>
  );
}

/* ------------------------------------------------------------------ 4 교육 퀴즈 */
function QuizStep({ idx, setIdx, onDone }: { idx: number; setIdx: (n: number) => void; onDone: () => void }) {
  const [qs, setQs] = useState<QuizQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
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

/* ------------------------------------------------------------------ 5 어떤 버디인가요 */
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

/* ------------------------------------------------------------------ 6 확인 중 */
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
        {s.eligibility === "residence"
          ? <Check done={s.eligible && s.age_ok} wait={s.eligible} title="성북구 거주 확인" sub={s.eligible ? `${s.school_name ?? "대학"} · 서류 두 장 냈어요 · 운영팀이 승인 때 확인해요` : "아직 안 냈어요"} />
          : <Check done={s.email_verified && s.age_ok} title="학교 메일 인증" sub={s.email_verified ? `${s.university ?? "학교"} · 만 ${BUDDY_MIN_AGE}세 이상` : "아직 안 했어요"} />}
        <Check done={s.korean_national} title="대한민국 국적 확인" sub={s.korean_national ? "확인했어요" : "아직 안 했어요"} />
        <Check done={s.code_agreed} title="버디 약속 동의" sub={s.code_agreed ? `${PROMISES.length}개 모두 확인` : "아직 안 했어요"} />
        <Check done={s.education_done} title="사전 교육 영상" sub={`${s.videos_watched.length} / ${s.videos_total} 봤어요`} />
        <Check done={s.quiz_passed} title="교육 퀴즈 통과" sub={s.quiz_score != null ? `${s.quiz_score} / ${QUIZ_TOTAL}` : "아직 안 풀었어요"} />
        <Check done={approved} wait={!approved} last title="운영팀 승인" sub={approved ? "승인됐어요" : suspended ? "활동 멈춤" : "기다리는 중"} />
      </div>
      <BottomBar>
        {approved ? <LinkButton href="/buddy">버디 홈으로</LinkButton> : <LinkButton href="/buddy/login" variant="ghost" className="border-[#C9CED3]">버디 로그인으로</LinkButton>}
      </BottomBar>
    </>
  );
}

export default function Page() {
  return <Suspense fallback={<Spinner />}><ApplyPage /></Suspense>;
}
