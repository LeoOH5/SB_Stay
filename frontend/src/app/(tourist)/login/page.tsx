"use client";
// T0 온보딩 · 언어 선택 / 로그인 — AU-01 (구글, 목업), AU-05 (이메일 데모 계정)
import { googleBody, googleConfigured, requestGoogleCode } from "@/lib/google";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, Hero, inputCls, SectionTitle } from "@/components/ui";
import { ErrorBox } from "@/components/tourist";
import { errMsg, homeFor } from "@/components/tourist/format";
import { post } from "@/lib/api";
import { session } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import type { TokenOut } from "@/lib/types";

const DEMO_ACCOUNTS: { label: string; email: string }[] = [
  { label: "관광객 Emma (EN)", email: "emma@example.com" },
  { label: "관광객 Yuki (JP→EN)", email: "yuki@example.com" },
  { label: "버디 지우", email: "jiwoo@a-univ.ac.kr" },
  { label: "해설사 박해설", email: "guide.park@example.com" },
  { label: "대학 담당자 A대학교", email: "admin@a-univ.ac.kr" },
  { label: "운영자", email: "operator@sbstay.app" },
];
const DEMO_PASSWORD = "demo1234";

export default function LoginPage() {
  const router = useRouter();
  const { lang, set: setLang } = useLang();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"email" | "google" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const finish = (r: TokenOut) => {
    session.set(r.user, r.access_token);
    router.push(r.needs_role_setup ? "/login/role" : homeFor(r.user.role));
  };

  const loginEmail = async () => {
    setErr(null); setBusy("email");
    try { finish(await post<TokenOut>("/auth/login", { email: email.trim(), password })); }
    catch (e) { setErr(errMsg(e)); }
    finally { setBusy(null); }
  };
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
    <>
      <Hero title="Seongbuk Stay" sub="Stay in a campus. Walk through history." />
      <div className="px-5 pb-6 space-y-3">
        <SectionTitle>Language / 언어</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <Button variant={lang === "en" ? "primary" : "secondary"} onClick={() => setLang("en")}>English</Button>
          <Button variant={lang === "ko" ? "primary" : "secondary"} onClick={() => setLang("ko")}>한국어</Button>
        </div>

        <Button variant="ghost" className="mt-3" onClick={loginGoogle} disabled={busy !== null}>
          {busy === "google" ? "로그인 중…" : googleConfigured() ? "G  Continue with Google" : "G  Continue with Google (목업)"}
        </Button>

        <form className="space-y-3 pt-2" onSubmit={(e) => { e.preventDefault(); void loginEmail(); }}>
          <Field label="Email">
            <input className={inputCls} type="email" placeholder="emma@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </Field>
          <Field label="Password" hint="데모 계정 비밀번호: demo1234">
            <input className={inputCls} type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </Field>
          <ErrorBox message={err} />
          <Button type="submit" disabled={busy !== null}>{busy === "email" ? "로그인 중…" : "Log in"}</Button>
        </form>
        <p className="text-center text-[14px]"><Link href="/signup" className="text-navy font-semibold">Sign up with email</Link></p>

        <SectionTitle>데모 계정 (심사용)</SectionTitle>
        <div className="space-y-1.5">
          {DEMO_ACCOUNTS.map((a) => (
            <button key={a.email} type="button" onClick={() => { setEmail(a.email); setPassword(DEMO_PASSWORD); setErr(null); }}
              className="w-full flex items-center justify-between rounded-[10px] bg-gray-bg px-3.5 h-10 text-[14px] text-ink text-left">
              <span>{a.label}</span><span className="text-muted">›</span>
            </button>
          ))}
        </div>
        <p className="text-[12px] text-muted">누르면 이메일·비밀번호가 채워져요. 역할에 따라 관광객 홈 / 버디 홈 / 어드민으로 이동합니다.</p>
      </div>
    </>
  );
}
