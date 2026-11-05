"use client";
// 로그인 (이메일 · 구글). 언어 설정은 마이페이지에서
import { googleBody, googleConfigured, requestGoogleCode } from "@/lib/google";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, Hero, inputCls } from "@/components/ui";
import { ErrorBox } from "@/components/tourist";
import { errMsg, homeFor } from "@/components/tourist/format";
import { post } from "@/lib/api";
import { session } from "@/lib/auth";
import type { TokenOut } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
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
      <div className="px-5 pb-6 pt-5 space-y-3">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void loginEmail(); }}>
          <Field label="Email">
            <input className={inputCls} type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </Field>
          <Field label="Password">
            <input className={inputCls} type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </Field>
          <ErrorBox message={err} />
          <Button type="submit" disabled={busy !== null}>{busy === "email" ? "로그인 중…" : "Log in"}</Button>
        </form>

        <div className="flex items-center gap-3 py-1 text-[12px] text-muted">
          <span className="h-px flex-1 bg-line" />또는<span className="h-px flex-1 bg-line" />
        </div>
        <Button variant="ghost" onClick={loginGoogle} disabled={busy !== null}>
          {busy === "google" ? "로그인 중…" : "G  Continue with Google"}
        </Button>

        <p className="pt-2 text-center text-[14px]"><Link href="/signup" className="text-navy font-semibold">Sign up with email</Link></p>
      </div>
    </>
  );
}
