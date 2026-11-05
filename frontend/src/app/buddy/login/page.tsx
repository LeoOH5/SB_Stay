"use client";
// 버디 로그인 · 학교 이메일 인증
import { googleBody, googleConfigured, requestGoogleCode } from "@/lib/google";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Card, Chip, Field, Hero, SectionTitle, inputCls } from "@/components/ui";
import { post } from "@/lib/api";
import { session } from "@/lib/auth";
import type { TokenOut } from "@/lib/types";
import { isProvider } from "@/components/buddy/format";
import { useToast } from "@/components/buddy/toast";

export default function Page() {
  const router = useRouter();
  const { show, toast } = useToast();
  const [email, setEmail] = useState("jiwoo@a-univ.ac.kr");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 버디 신청 · 학교 이메일 인증
  const [applyRole, setApplyRole] = useState<"buddy" | "guide">("buddy");
  const [schoolEmail, setSchoolEmail] = useState("jiwoo@a-univ.ac.kr");
  const [code, setCode] = useState("");
  const [license, setLicense] = useState("");
  const [sent, setSent] = useState(false);
  const [verified, setVerified] = useState(false);
  const isAcKr = /@[\w.-]+\.ac\.kr$/i.test(schoolEmail.trim());

  const finish = (r: TokenOut) => {
    if (!isProvider(r.user.role)) { setError(`${r.user.name} 계정은 ${r.user.role} 역할이에요. 버디·해설사 계정으로 로그인해 주세요.`); return; }
    session.set(r.user, r.access_token);
    show(`${r.user.name} 님, 환영해요`);
    router.push("/buddy");
  };
  const login = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    try { finish(await post<TokenOut>("/auth/login", { email: email.trim(), password })); }
    catch (err) { setError(err instanceof Error ? err.message : "로그인에 실패했어요"); }
    finally { setBusy(false); }
  };
  const google = async () => {
    setBusy(true); setError(null);
    try {
      if (!googleConfigured()) { finish(await post<TokenOut>("/auth/google", { id_token: "mock" })); return; }
      const code = await requestGoogleCode("login");
      if (!code) return;
      finish(await post<TokenOut>("/auth/google", googleBody(code)));
    }
    catch (err) { setError(err instanceof Error ? err.message : "구글 로그인에 실패했어요"); }
    finally { setBusy(false); }
  };

  return (
    <div className="pb-6">
      <Hero title="Seongbuk Stay for Buddies" sub="대학생 버디 · 해설사 로그인" />

      <div className="px-5">
        <form onSubmit={login} className="space-y-3 pt-5">
          <Field label="학교 이메일"><input className={inputCls} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@univ.ac.kr" /></Field>
          <Field label="비밀번호"><input className={inputCls} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></Field>
          {error && <p className="text-[12px] text-orange">{error}</p>}
          <Button type="submit" disabled={busy || !email || !password}>{busy ? "로그인 중…" : "로그인"}</Button>
        </form>
        <div className="my-4 flex items-center gap-3 text-[12px] text-muted"><span className="h-px flex-1 bg-line" />또는<span className="h-px flex-1 bg-line" /></div>
        <Button variant="ghost" onClick={google} disabled={busy}>G  구글로 로그인</Button>

        <SectionTitle>버디 신청 · 학교 이메일 인증</SectionTitle>
        <Card className="space-y-3 bg-gray-bg ring-0">
          <div className="flex gap-2">
            <Chip selected={applyRole === "buddy"} onClick={() => setApplyRole("buddy")}>대학생 버디</Chip>
            <Chip selected={applyRole === "guide"} onClick={() => setApplyRole("guide")}>해설사</Chip>
          </div>
          <div className="relative">
            <input className={`${inputCls} h-11! pr-20`} type="email" value={schoolEmail} onChange={(e) => { setSchoolEmail(e.target.value); setSent(false); setVerified(false); }} placeholder="학교 이메일 (ac.kr)" disabled={verified} />
            <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-semibold ${isAcKr ? "text-green-dark" : "text-muted"}`}>{isAcKr ? "ac.kr ✓" : "ac.kr"}</span>
          </div>
          {applyRole === "guide" && (
            <input className={`${inputCls} h-11!`} value={license} onChange={(e) => setLicense(e.target.value)} placeholder="문화관광해설사 자격증 번호" />
          )}
          <div className="flex gap-2">
            <input className={`${inputCls} h-11! flex-1`} inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="인증번호 6자리" disabled={!sent || verified} />
            {!sent ? (
              <Button variant="secondary" full={false} className="h-11! min-h-11! shrink-0 px-4 text-[14px]" disabled={!isAcKr} onClick={() => { setSent(true); show(`${schoolEmail}로 인증번호를 보냈어요`); }}>코드 발송</Button>
            ) : (
              <Button variant="secondary" full={false} className="h-11! min-h-11! shrink-0 px-4 text-[14px]" disabled={verified || code.length < 6} onClick={() => { setVerified(true); show("학교 이메일 인증됨 ✓"); }}>{verified ? "인증됨 ✓" : "확인"}</Button>
            )}
          </div>
          {verified && <p className="text-[12px] font-semibold text-green-dark">학교 이메일 인증됨 ✓</p>}
          <p className="text-[12px] leading-relaxed text-muted">인증 후 프로필을 등록하면 대학 담당자 승인을 거쳐 요청함이 열려요.</p>
        </Card>
      </div>
      {toast}
    </div>
  );
}
