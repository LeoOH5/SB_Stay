"use client";
// T9 회원가입 (이메일) — AU-02 POST /auth/signup
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Chip, Field, Hero, inputCls } from "@/components/ui";
import { ErrorBox } from "@/components/tourist";
import { errMsg } from "@/components/tourist/format";
import { post } from "@/lib/api";
import { session } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import type { Lang, TokenOut } from "@/lib/types";

export default function SignupPage() {
  const router = useRouter();
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
    if (pw.length < 8) { setErr("비밀번호는 8자 이상이어야 해요"); return; }
    if (pw !== pw2) { setErr("비밀번호가 서로 달라요"); return; }
    if (!agree) { setErr("이용약관·개인정보 처리방침 동의가 필요해요"); return; }
    setBusy(true);
    try {
      const r = await post<TokenOut>("/auth/signup", { name: name.trim(), email: email.trim(), password: pw, language });
      session.set(r.user, r.access_token);
      setLang(language);
      router.push("/home");
    } catch (e) { setErr(errMsg(e)); }
    finally { setBusy(false); }
  };

  return (
    <>
      <Hero title="Seongbuk Stay" sub="Create your account" />
      <form className="px-5 pb-6 space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Field label="Name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Emma Clark" required /></Field>
        <Field label="Email"><input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="emma@example.com" required /></Field>
        <Field label="Password  (8자 이상)"><input className={inputCls} type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" required minLength={8} /></Field>
        <Field label="Password (again)"><input className={inputCls} type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="••••••••" required /></Field>
        <div>
          <span className="block text-[12px] text-muted mb-1.5">Language / 언어</span>
          <div className="flex gap-2">
            <Chip selected={language === "en"} onClick={() => setLanguage("en")}>English</Chip>
            <Chip selected={language === "ko"} onClick={() => setLanguage("ko")}>한국어</Chip>
          </div>
        </div>
        <label className="flex items-center gap-2 text-[13px] text-ink"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> 이용약관 · 개인정보 처리방침 동의 (필수)</label>
        <label className="flex items-center gap-2 text-[13px] text-muted"><input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} /> 마케팅 수신 (선택)</label>
        <ErrorBox message={err} />
        <Button type="submit" disabled={busy}>{busy ? "가입 중…" : "Sign up"}</Button>
        <p className="text-center text-[14px] text-ink">Already have an account?  <Link href="/login" className="text-navy font-semibold">Log in</Link></p>
        <Card tint>
          <div className="text-[14px] font-semibold text-ink">해커톤 단순화 (AU-02)</div>
          <div className="mt-1.5 text-[12px] text-muted leading-relaxed">· 이메일 중복 검사 + 비밀번호 해시만, 이메일 인증 없음<br />· 가입 역할은 항상 관광객(tourist)<br />· 버디·해설사·대학 담당자·운영자는 시드 계정</div>
        </Card>
      </form>
    </>
  );
}
