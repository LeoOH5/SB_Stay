"use client";
// B01 버디 로그인 — AU-01 POST /auth/login, AU-02 POST /auth/google. 버디가 되고 싶으면 /buddy/apply (6단계)
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { GoogleG } from "@/components/buddy/ui";
import { isProvider } from "@/components/buddy/format";
import { Brand, Button, LinkButton, inputCls } from "@/components/ui";
import { BUDDY_ELIGIBILITY } from "@/lib/codes";
import { post } from "@/lib/api";
import { session } from "@/lib/auth";
import { googleBody, googleConfigured, requestGoogleCode } from "@/lib/google";
import type { TokenOut } from "@/lib/types";

export default function Page() {
  const router = useRouter();
  const [email, setEmail] = useState("jiwoo@a-univ.ac.kr");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = (r: TokenOut) => {
    session.set(r.user, r.access_token);
    // 버디가 아닌 계정이면 지원 단계로
    router.push(isProvider(r.user.role) ? "/buddy" : "/buddy/apply");
  };
  const login = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    try { finish(await post<TokenOut>("/auth/login", { email: email.trim(), password })); }
    catch (err) { setError(err instanceof Error ? err.message : "로그인하지 못했어요"); }
    finally { setBusy(false); }
  };
  const google = async () => {
    setBusy(true); setError(null);
    try {
      if (!googleConfigured()) { finish(await post<TokenOut>("/auth/google", { id_token: "mock" })); return; }
      const code = await requestGoogleCode("login");
      if (!code) return;
      finish(await post<TokenOut>("/auth/google", googleBody(code)));
    } catch (err) { setError(err instanceof Error ? err.message : "구글 로그인에 실패했어요"); }
    finally { setBusy(false); }
  };

  return (
    <div className="px-5 pb-10 pt-6">
      <Brand badge="버디" href="/" />
      <h1 className="mt-8 text-[28px] font-bold leading-[1.3] text-ink">버디<br />로그인</h1>
      <p className="mt-2 text-[15px] text-muted">학교 이메일로 들어오면 소속 대학이 자동으로 정해져요.</p>

      <form onSubmit={login} className="mt-7 space-y-5">
        <label className="block">
          <span className="mb-2 block text-[14px] font-semibold text-ink">학교 이메일</span>
          <input className={`${inputCls} h-[52px] text-[16px]`} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@univ.ac.kr" />
        </label>
        <label className="block">
          <span className="mb-2 block text-[14px] font-semibold text-ink">비밀번호</span>
          <input className={`${inputCls} h-[52px] text-[16px]`} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호" />
        </label>
        {error && <p className="text-[14px] font-semibold text-red">{error}</p>}
        <Button type="submit" disabled={busy || !email || !password}>{busy ? "로그인 중…" : "로그인"}</Button>
      </form>
      <div className="my-6 flex items-center gap-3 text-[13px] text-muted"><span className="h-px flex-1 bg-line" />또는<span className="h-px flex-1 bg-line" /></div>
      <Button variant="ghost" className="border-[#C9CED3]" onClick={google} disabled={busy}><GoogleG />Google로 계속하기</Button>
      <p className="mt-4 text-[14px] text-muted">데모: jiwoo@a-univ.ac.kr (비밀번호 demo1234)</p>

      <h2 className="mt-10 text-[18px] font-bold text-ink">버디가 되고 싶어요</h2>
      <p className="mt-1.5 text-[14px] text-muted">{BUDDY_ELIGIBILITY}이면 지원할 수 있어요.</p>
      <LinkButton href="/buddy/apply" variant="secondary" className="mt-4">6단계로 지원하기</LinkButton>
    </div>
  );
}
