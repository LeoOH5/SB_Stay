"use client";
// T02 로그인 — AU-01 이메일 · AU-03 구글, 화면 언어, 심사용 데모 계정
// v3.9 ?next=<경로> 가 있으면 로그인 뒤 그 화면으로 (안전한 같은 사이트 경로 + 역할 영역일 때만, afterLogin)
import { googleBody, googleConfigured, requestGoogleCode } from "@/lib/google";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button, Icon, Spinner, inputCls } from "@/components/ui";
import { ErrorBox } from "@/components/tourist";
import { afterLogin, errMsg, loginHref } from "@/components/tourist/format";
import { FieldLabel, Segmented } from "@/components/tourist/v3";
import { post } from "@/lib/api";
import { session } from "@/lib/auth";
import { tr, useLang } from "@/lib/i18n";
import type { Lang, TokenOut } from "@/lib/types";

const DEMO_PW = "demo1234";
const DEMO: { role: () => string; who: () => string; email: string }[] = [
  { role: () => tr("여행자", "Traveler"), who: () => tr("Emma · 숙박·버디 예약해 둔 여행자", "Emma · stay and buddy booked"), email: "emma@example.com" },
  { role: () => tr("버디", "Buddy"), who: () => tr("지우 · 고려대학교 학생", "Jiwoo · Korea University student"), email: "jiwoo@a-univ.ac.kr" },
];
/** 심사용 관리 화면 — 시민에게는 숨기고 접어 둔다 */
const DEMO_ADMIN: { role: () => string; who: () => string; email: string }[] = [
  { role: () => tr("대학 담당자", "University staff"), who: () => tr("고려대학교 기숙사", "Korea University dorms"), email: "admin@a-univ.ac.kr" },
  { role: () => tr("운영자", "Operator"), who: () => tr("성북스테이 운영팀", "SB Stay operations"), email: "operator@sbstay.app" },
];

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function LoginPage() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const { lang, set: setLang } = useLang();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const finish = (r: TokenOut) => {
    session.set(r.user, r.access_token);
    router.push(r.needs_role_setup ? loginHref(next, "/login/role") : afterLogin(r.user.role, next));
  };
  const loginWith = async (em: string, pw: string, key: string) => {
    setErr(null); setBusy(key);
    try { finish(await post<TokenOut>("/auth/login", { email: em.trim(), password: pw })); }
    catch (e) { setErr(errMsg(e)); }
    finally { setBusy(null); }
  };
  /** 로그인 없이 여행자 화면 둘러보기 (예약·내 여행 등은 그 화면에서 로그인 안내) */
  const guest = () => { session.clear(); router.push("/home"); };
  const loginGoogle = async () => {
    setErr(null); setBusy("google");
    try {
      if (!googleConfigured()) { finish(await post<TokenOut>("/auth/google", { id_token: "mock" })); return; }
      const code = await requestGoogleCode("login");
      if (!code) return;
      finish(await post<TokenOut>("/auth/google", googleBody(code)));
    }
    catch (e) { setErr(errMsg(e)); }
    finally { setBusy(null); }
  };

  return (
    <div className="px-5 pb-10 pt-5">
      <div className="-mt-1 flex h-11 items-center justify-between">
        <Link href="/" aria-label={tr("처음 화면으로", "Back to start")} className="-ml-2 inline-flex h-11 items-center gap-0.5 rounded-full pl-1.5 pr-3 text-[15px] font-semibold text-ink hover:bg-gray-bg">
          <Icon name="chevron-left" className="h-6 w-6" strokeWidth={2.2} />{tr("처음으로", "Back")}
        </Link>
      </div>
      <h1 className="mt-5 text-[26px] font-bold leading-[1.35] text-ink">{tr("다시 오셨네요", "Welcome back")}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">{tr("방학 동안 대학 기숙사에 머물며 성북의 이야기를 걸어요.", "Stay in a university dorm over the break and walk Seongbuk's stories.")}</p>

      <Segmented<Lang> className="mt-6" value={lang} onChange={setLang} options={[{ value: "en", label: "English" }, { value: "ko", label: "한국어" }]} />

      <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); void loginWith(email, password, "email"); }}>
        <label className="block"><FieldLabel>{tr("이메일", "Email")}</FieldLabel>
          <input className={inputCls} type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label className="block"><FieldLabel>{tr("비밀번호", "Password")}</FieldLabel>
          <input className={inputCls} type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        <ErrorBox message={err} />
        <Button type="submit" disabled={busy !== null}>{busy === "email" ? tr("로그인 중…", "Signing in…") : tr("로그인", "Log in")}</Button>
      </form>
      <p className="mt-4 text-center text-[14px] text-muted">{tr("처음이에요?", "New here?")} <Link href={loginHref(next, "/signup")} className="font-semibold text-navy underline underline-offset-2">{tr("이메일로 가입하기", "Sign up with email")}</Link></p>

      <div className="my-6 flex items-center gap-3 text-[13px] text-muted"><span className="h-px flex-1 bg-line" />{tr("또는", "or")}<span className="h-px flex-1 bg-line" /></div>
      <Button variant="secondary" onClick={guest} disabled={busy !== null}>{tr("비회원으로 이용하기", "Continue as guest")}</Button>
      <Button variant="ghost" className="mt-3" onClick={loginGoogle} disabled={busy !== null}>
        <GoogleG />{busy === "google" ? tr("로그인 중…", "Signing in…") : tr("Google로 계속하기", "Continue with Google")}
      </Button>
      <div className="mt-9 flex items-center justify-between">
        <h2 className="text-[16px] font-bold text-ink">{tr("가입 없이 둘러보기", "Look around without signing up")}</h2>
        <span className="text-[12.5px] text-muted">{tr("비밀번호", "Password")} {DEMO_PW}</span>
      </div>
      <div className="mt-1 divide-y divide-line">
        {DEMO.map((d) => <DemoRow key={d.email} d={d} busy={busy} onPick={() => { setLang("ko"); void loginWith(d.email, DEMO_PW, d.email); }} />)}
      </div>
      <details className="group mt-3 rounded-[12px] bg-gray-bg px-4">
        <summary className="flex cursor-pointer list-none items-center justify-between py-3 text-[13.5px] font-semibold text-muted [&::-webkit-details-marker]:hidden">
          {tr("심사용 · 대학 담당자 / 운영자 화면", "For judges · staff / operator views")}
          <Icon name="chevron-down" className="h-4 w-4 transition group-open:rotate-180" />
        </summary>
        <div className="divide-y divide-line pb-1">
          {DEMO_ADMIN.map((d) => <DemoRow key={d.email} d={d} busy={busy} onPick={() => { setLang("ko"); void loginWith(d.email, DEMO_PW, d.email); }} />)}
        </div>
      </details>
      <p className="mt-8 text-center text-[12.5px] text-muted">
        <Link href="/privacy" className="underline">{tr("개인정보처리방침", "Privacy")}</Link><span className="mx-2">·</span><Link href="/terms" className="underline">{tr("이용약관", "Terms")}</Link>
      </p>
    </div>
  );
}

function DemoRow({ d, busy, onPick }: { d: { role: () => string; who: () => string; email: string }; busy: string | null; onPick: () => void }) {
  return (
    <button type="button" disabled={busy !== null} onClick={onPick} className="flex w-full items-center gap-3 py-3.5 text-left disabled:opacity-60">
      <span className="w-[80px] shrink-0 text-[13.5px] text-muted">{d.role()}</span>
      <span className="min-w-0 flex-1 text-[14.5px] text-ink">{busy === d.email ? tr("로그인 중…", "Signing in…") : d.who()}</span>
      <Icon name="chevron-right" className="h-5 w-5 text-ink" />
    </button>
  );
}

export default function Page() {
  return <Suspense fallback={<Spinner />}><LoginPage /></Suspense>;
}
