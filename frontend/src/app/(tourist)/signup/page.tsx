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
import { useLang } from "@/lib/i18n";
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
    if (!name.trim() || !email.trim()) { setErr("이름과 이메일을 입력해 주세요"); return; }
    if (pw.length < 8) { setErr("비밀번호는 8자 이상이어야 해요"); return; }
    if (pw !== pw2) { setErr("비밀번호가 서로 달라요"); return; }
    if (!agree) { setErr("이용약관과 개인정보 처리방침에 동의해 주세요"); return; }
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
      <Headline className="pt-2" title="계정 만들기" sub="여권 정보는 예약할 때만 받아요." />
      <div className="space-y-5 px-5 pb-4 pt-6">
        <label className="block"><FieldLabel>이름</FieldLabel><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Emma Clark" autoComplete="name" /></label>
        <label className="block"><FieldLabel>이메일</FieldLabel><input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="emma@example.com" autoComplete="email" /></label>
        <label className="block"><FieldLabel>비밀번호</FieldLabel><input className={inputCls} type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="8자 이상" autoComplete="new-password" /></label>
        <label className="block"><FieldLabel>비밀번호 확인</FieldLabel><input className={inputCls} type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="한 번 더 입력" autoComplete="new-password" /></label>
        <div>
          <FieldLabel>앱 언어</FieldLabel>
          <div className="flex gap-2">
            <Chip selected={language === "en"} onClick={() => setLanguage("en")}>English</Chip>
            <Chip selected={language === "ko"} onClick={() => setLanguage("ko")}>한국어</Chip>
          </div>
        </div>
        <div>
          <CheckRow checked={agree} onChange={setAgree}>이용약관과 개인정보 처리방침에 동의해요 <span className="text-[13px] text-muted">(필수)</span></CheckRow>
          <CheckRow checked={marketing} onChange={setMarketing}>이벤트 소식 받기 <span className="text-[13px] text-muted">(선택)</span></CheckRow>
        </div>
        <ErrorBox message={err} />
      </div>
      <BottomBar>
        <Button type="submit" disabled={busy}>{busy ? "가입 중…" : "가입하기"}</Button>
        <p className="mt-3 text-center text-[14px] text-muted">이미 계정이 있어요 <Link href={loginHref(next)} className="font-semibold text-ink">로그인</Link></p>
      </BottomBar>
    </form>
  );
}

export default function Page() {
  return <Suspense fallback={<Spinner />}><SignupPage /></Suspense>;
}
