// 공개 문서(개인정보처리방침·이용약관) 공통 틀 — 로그인 없이 열리고 탭바가 없다
import type { ReactNode } from "react";
import { Hero } from "@/components/ui";

export const CONTACT_EMAIL = "dhwjdqls0409@gmail.com";
export const UPDATED = "2026년 11월 6일";

export function LegalDoc({ title, titleEn, children }: { title: string; titleEn: string; children: ReactNode }) {
  return (
    <div className="mobile-shell min-h-dvh bg-white">
      <Hero back="/" backLabel="성북스테이" title={title} sub={`${titleEn} · 시행일 ${UPDATED}`} />
      <article className="space-y-6 px-5 pb-12 text-[14px] leading-relaxed text-ink">{children}</article>
    </div>
  );
}

export function Sec({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-[16px] font-bold">{n}. {title}</h2>
      <div className="space-y-2 text-ink/90">{children}</div>
    </section>
  );
}
