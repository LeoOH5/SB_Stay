"use client";
// T02 로그인 — AU-01 이메일 · AU-03 구글, 화면 언어, 심사용 데모 계정
import { googleBody, googleConfigured, requestGoogleCode } from "@/lib/google";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Brand, Button, Icon, inputCls } from "@/components/ui";
import { ErrorBox } from "@/components/tourist";
import { errMsg, homeFor } from "@/components/tourist/format";
import { FieldLabel, Segmented } from "@/components/tourist/v3";
import { post } from "@/lib/api";
import { session } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import type { Lang, TokenOut } from "@/lib/types";

const DEMO_PW = "demo1234";
const DEMO: { role: string; who: string; email: string }[] = [
  { role: "관광객", who: "Emma, 영어", email: "emma@example.com" },
  { role: "관광객", who: "Yuki, 일본어에서 영어", email: "yuki@example.com" },
  { role: "관광객", who: "Noah, 예약 없음 · 무료 코스만", email: "noah@example.com" },
  { role: "버디", who: "지우, 고려대학교", email: "jiwoo@a-univ.ac.kr" },
  { role: "대학 담당자", who: "고려대학교 기숙사", email: "admin@a-univ.ac.kr" },
  { role: "운영자", who: "성북스테이 운영팀", email: "operator@sbstay.app" },
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

export default function LoginPage() {
  const router = useRouter();
  const { lang, set: setLang } = useLang();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const finish = (r: TokenOut) => {
    session.set(r.user, r.access_token);
    router.push(r.needs_role_setup ? "/login/role" : homeFor(r.user.role));
  };
  const loginWith = async (em: string, pw: string, key: string) => {
    setErr(null); setBusy(key);
    try { finish(await post<TokenOut>("/auth/login", { email: em.trim(), password: pw })); }
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
    <div className="px-5 pb-10 pt-5">
      <Brand href="/home" />
      <h1 className="mt-7 text-[26px] font-bold leading-[1.35] text-ink">다시 오셨네요</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">방학 동안 대학 기숙사에 머물며 성북의 이야기를 걸어요.</p>

      <Segmented<Lang> className="mt-6" value={lang} onChange={setLang} options={[{ value: "en", label: "English" }, { value: "ko", label: "한국어" }]} />

      <Button variant="ghost" className="mt-4" onClick={loginGoogle} disabled={busy !== null}>
        <GoogleG />{busy === "google" ? "로그인 중…" : "Google로 계속하기"}
      </Button>

      <div className="my-5 flex items-center gap-3 text-[13px] text-muted"><span className="h-px flex-1 bg-line" />또는 이메일<span className="h-px flex-1 bg-line" /></div>

      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void loginWith(email, password, "email"); }}>
        <label className="block"><FieldLabel>이메일</FieldLabel>
          <input className={inputCls} type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label className="block"><FieldLabel>비밀번호</FieldLabel>
          <input className={inputCls} type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        <ErrorBox message={err} />
        <Button type="submit" disabled={busy !== null}>{busy === "email" ? "로그인 중…" : "로그인"}</Button>
      </form>
      <p className="mt-4 text-center text-[14px] text-muted">처음이에요? <Link href="/signup" className="font-semibold text-ink">이메일로 가입하기</Link></p>

      <div className="mt-9 flex items-center justify-between">
        <h2 className="text-[18px] font-bold text-ink">심사용 데모 계정</h2>
        <span className="text-[13.5px] text-muted">비밀번호 {DEMO_PW}</span>
      </div>
      <div className="mt-1 divide-y divide-line">
        {DEMO.map((d) => (
          <button key={d.email} type="button" disabled={busy !== null} onClick={() => void loginWith(d.email, DEMO_PW, d.email)} className="flex w-full items-center gap-3 py-4 text-left disabled:opacity-60">
            <span className="w-[88px] shrink-0 text-[14px] text-muted">{d.role}</span>
            <span className="min-w-0 flex-1 text-[15px] text-ink">{busy === d.email ? "로그인 중…" : d.who}</span>
            <Icon name="chevron-right" className="h-5 w-5 text-ink" />
          </button>
        ))}
      </div>
    </div>
  );
}
