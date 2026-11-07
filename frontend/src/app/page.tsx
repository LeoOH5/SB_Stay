"use client";
// T00 첫 화면 — 로고 + 시작하기 + 버디 신청하기(→ /buddy/apply) + 데모 계정 바로 로그인 (발표·심사용: 여행자·버디·학교 담당자·운영자를 한 번에 오간다)
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, LinkButton, LogoMark, cn } from "@/components/ui";
import { errMsg, homeFor } from "@/components/tourist/format";
import { post } from "@/lib/api";
import { session, useUser } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import type { TokenOut } from "@/lib/types";

const DEMO_PASSWORD = "demo1234";
const DEMOS = [
  { email: "emma@example.com", role: "여행자", who: "Emma · 미국" },
  { email: "jiwoo@a-univ.ac.kr", role: "버디", who: "지우 · 고려대" },
  { email: "admin@a-univ.ac.kr", role: "학교 담당자", who: "고려대학교" },
  { email: "operator@sbstay.app", role: "운영자", who: "성북스테이 운영팀" },
] as const;

export default function Splash() {
  const router = useRouter();
  const { user } = useUser();
  const { set } = useLang();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const start = () => { set("ko"); router.push(user ? homeFor(user.role) : "/home"); };

  async function demo(email: string) {
    setBusy(email); setErr(null);
    try {
      const r = await post<TokenOut>("/auth/login", { email, password: DEMO_PASSWORD });
      session.set(r.user, r.access_token);
      set("ko");
      router.push(homeFor(r.user.role));
    } catch (e) { setErr(errMsg(e)); setBusy(null); }
  }

  return (
    <main className="mobile-shell flex flex-col px-6 pb-[max(env(safe-area-inset-bottom),28px)]">
      <div className="flex flex-1 flex-col items-center justify-center pt-14 text-center">
        <LogoMark className="h-[104px] w-[104px]" />
        <div className="mt-6 text-[34px] font-bold leading-none tracking-[-0.02em] text-ink">성북스테이</div>
        <div className="mt-3 text-[14px] font-bold tracking-[0.3em] text-navy">SB STAY</div>
      </div>
      <Button onClick={start}>시작하기</Button>
      <LinkButton href="/buddy/apply" variant="secondary" className="mt-3">버디 신청하기</LinkButton>

      <section className="mt-7" aria-label="데모 계정">
        <h2 className="text-[14px] font-bold text-ink">데모 계정으로 둘러보기</h2>
        <p className="mt-1 text-[12.5px] text-muted">누르면 바로 로그인돼요. 로그아웃하면 이 화면으로 돌아와요.</p>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {DEMOS.map((d) => (
            <button key={d.email} type="button" disabled={busy !== null} onClick={() => demo(d.email)}
              className={cn("rounded-[14px] border border-line px-3.5 py-3 text-left transition hover:border-navy disabled:opacity-60", busy === d.email && "border-navy bg-navy-bg")}>
              <div className="text-[15px] font-bold text-ink">{d.role}</div>
              <div className="mt-0.5 truncate text-[12.5px] text-muted">{busy === d.email ? "로그인 중…" : d.who}</div>
            </button>
          ))}
        </div>
        {err && <p role="alert" className="mt-2 text-[13px] font-semibold text-red">{err}</p>}
      </section>

      <nav className="mt-6 flex justify-center gap-3 text-[12px] text-muted">
        <Link href="/privacy" className="hover:underline">개인정보처리방침 Privacy</Link>
        <span aria-hidden>·</span>
        <Link href="/terms" className="hover:underline">이용약관 Terms</Link>
      </nav>
    </main>
  );
}
