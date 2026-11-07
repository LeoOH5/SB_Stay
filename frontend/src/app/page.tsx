"use client";
// T00 첫 화면 — 로고(세로) + 시작하기(한국어) / English · v3.9 버디로 활동하기(→ /buddy/login)
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, LogoMark } from "@/components/ui";
import { homeFor } from "@/components/tourist/format";
import { useUser } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

export default function Splash() {
  const router = useRouter();
  const { user } = useUser();
  const { set } = useLang();
  const start = (l: Lang) => { set(l); router.push(user ? homeFor(user.role) : "/home"); };

  return (
    <main className="mobile-shell flex flex-col px-6 pb-[max(env(safe-area-inset-bottom),28px)]">
      <div className="flex flex-1 flex-col items-center justify-center pt-16 text-center">
        <LogoMark className="h-[112px] w-[112px]" />
        <div className="mt-6 text-[34px] font-bold leading-none tracking-[-0.02em] text-ink">성북스테이</div>
        <div className="mt-3 text-[14px] font-bold tracking-[0.3em] text-navy">SB STAY</div>
        <p className="mt-6 text-[15px] leading-relaxed text-muted">성북구와 대학이 함께 여는<br />방학 기숙사 스테이</p>
        <p className="mt-5 max-w-[300px] text-[13px] leading-relaxed text-muted">
          방학 동안 비는 성북구 대학 기숙사에 묵고, 동네 대학생 버디와 함께 걷는 여행 서비스입니다.
        </p>
        <p className="mt-2 max-w-[300px] text-[12.5px] leading-relaxed text-muted">
          Stay in Seongbuk university dorms during school breaks, and walk the neighborhood with a local student buddy.
        </p>
      </div>
      <div className="space-y-3">
        <Button onClick={() => start("ko")}>시작하기</Button>
        <Button variant="ghost" onClick={() => start("en")}>English</Button>
      </div>
      <p className="mt-5 text-center text-[13.5px] text-muted">
        성북구 대학생이라면 <Link href="/buddy/login" className="font-semibold text-navy underline-offset-2 hover:underline">버디로 활동하기</Link>
      </p>
      <nav className="mt-4 flex justify-center gap-3 text-[12px] text-muted">
        <Link href="/privacy" className="hover:underline">개인정보처리방침 Privacy</Link>
        <span aria-hidden>·</span>
        <Link href="/terms" className="hover:underline">이용약관 Terms</Link>
      </nav>
    </main>
  );
}
