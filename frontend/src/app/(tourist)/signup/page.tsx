"use client";
// T04 회원가입 (이메일) — AU-02 POST /auth/signup. v3.9 ?next= 를 로그인·역할 선택으로 넘기고, 가입 뒤 그 화면으로
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button, Chip, Spinner, TopBar, inputCls } from "@/components/ui";
import { ErrorBox } from "@/components/tourist";
import { afterLogin, errMsg, loginHref } from "@/components/tourist/format";
import { BottomBar, CheckRow, FieldLabel, Headline } from "@/components/tourist/v3";
import { post } from "@/lib/api";
import { session } from "@/lib/auth";
import { tr, useLang } from "@/lib/i18n";
import type { Lang, TokenOut } from "@/lib/types";

function SignupPage() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const { lang, set: setLang } = useLang();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [language, setLanguage] = useState<Lang>(lang);
  const [agree, setAgree] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!name.trim() || !email.trim()) { setErr(tr("이름과 이메일을 입력해 주세요", "Please enter your name and email")); return; }
    if (pw.length < 8) { setErr(tr("비밀번호는 8자 이상이어야 해요", "Password must be at least 8 characters")); return; }
    if (pw !== pw2) { setErr(tr("비밀번호가 서로 달라요", "Passwords don't match")); return; }
    if (!agree) { setErr(tr("이용약관과 개인정보 처리방침에 동의해 주세요", "Please agree to the Terms and Privacy Policy")); return; }
    setBusy(true);
    try {
      const r = await post<TokenOut>("/auth/signup", { name: name.trim(), email: email.trim(), password: pw, language });
      session.set(r.user, r.access_token);
      setLang(language);
      router.push(r.needs_role_setup ? loginHref(next, "/login/role") : afterLogin(r.user.role, next, "/home"));
    } catch (e) { setErr(errMsg(e)); setBusy(false); }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <TopBar back={loginHref(next)} />
      <Headline className="pt-2" title={tr("계정 만들기", "Create account")} sub={tr("여권 정보는 예약할 때만 받아요.", "We only ask for passport details when you book.")} />
      <div className="space-y-5 px-5 pb-4 pt-6">
        <label className="block"><FieldLabel>{tr("이름", "Name")}</FieldLabel><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Emma Clark" autoComplete="name" /></label>
        <label className="block"><FieldLabel>{tr("이메일", "Email")}</FieldLabel><input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="emma@example.com" autoComplete="email" /></label>
        <label className="block"><FieldLabel>{tr("비밀번호", "Password")}</FieldLabel><input className={inputCls} type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={tr("8자 이상", "8+ characters")} autoComplete="new-password" /></label>
        <label className="block"><FieldLabel>{tr("비밀번호 확인", "Confirm password")}</FieldLabel><input className={inputCls} type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder={tr("한 번 더 입력", "Enter it again")} autoComplete="new-password" /></label>
        <div>
          <FieldLabel>{tr("앱 언어", "App language")}</FieldLabel>
          <div className="flex gap-2">
            <Chip selected={language === "en"} onClick={() => setLanguage("en")}>English</Chip>
            <Chip selected={language === "ko"} onClick={() => setLanguage("ko")}>한국어</Chip>
          </div>
        </div>
        <div>
          <CheckRow checked={agree} onChange={setAgree}>{tr("이용약관과 개인정보 처리방침에 동의해요", "I agree to the Terms and Privacy Policy")} <span className="text-[13px] text-muted">{tr("(필수)", "(required)")}</span></CheckRow>
          <CheckRow checked={marketing} onChange={setMarketing}>{tr("이벤트 소식 받기", "Send me event news")} <span className="text-[13px] text-muted">{tr("(선택)", "(optional)")}</span></CheckRow>
        </div>
        <ErrorBox message={err} />
      </div>
      <BottomBar>
        <Button type="submit" disabled={busy}>{busy ? tr("가입 중…", "Signing up…") : tr("가입하기", "Sign up")}</Button>
        <p className="mt-3 text-center text-[14px] text-muted">{tr("이미 계정이 있어요", "Already have an account?")} <Link href={loginHref(next)} className="font-semibold text-navy underline underline-offset-2">{tr("로그인", "Log in")}</Link></p>
      </BottomBar>
    </form>
  );
}

export default function Page() {
  return <Suspense fallback={<Spinner />}><SignupPage /></Suspense>;
}
