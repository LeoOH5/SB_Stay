"use client";
// T00 첫 화면 (위에서 아래로 스크롤) — [남색] 한 문장 + 소개 영상 → [흰색] 왜 만들었나 · 누구에게 좋은지 · 버디란 · 이용 순서 · 성북 장소
// → [남색] 맨 아래 '여행자로 시작하기 / 버디로 시작하기' 데모 버튼. 학교 담당자·운영자 데모는 로그인 화면의 '심사용' 칸에만.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon, LogoMark, cn, type IconName } from "@/components/ui";
import { errMsg, homeFor } from "@/components/tourist/format";
import { post } from "@/lib/api";
import { session } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import type { TokenOut } from "@/lib/types";

const DEMO_PASSWORD = "demo1234";
const DEMOS: { email: string; label: string; sub: string; icon: IconName }[] = [
  { email: "emma@example.com", label: "여행자로 시작하기", sub: "Emma 계정 · 숙소·버디·코스 예약", icon: "suitcase" },
  { email: "jiwoo@a-univ.ac.kr", label: "버디로 시작하기", sub: "지우 계정 · 요청 수락·정산", icon: "users" },
];
const VIDEO = "/promo/sbstay-promo.mp4";
const POSTER = "/promo/sbstay-promo-poster.jpg";

/** 첫 장면 사진 — 코스에 실제로 들어가는 성북 장소 (출처는 아래 한 줄 + 코스 화면) */
const PHOTOS = [
  { src: "/places/107.jpg", name: "한양도성 북악구간" },
  { src: "/places/118.jpg", name: "성북동 별서" },
  { src: "/places/109.jpg", name: "간송미술관" },
];

/** 이용 순서 — 여행자 기준 */
const STEPS = [
  { t: "날짜를 골라요", d: "1월 5일 ~ 2월 20일, 겨울방학 동안 열려요" },
  { t: "빈 기숙사와 버디를 골라요", d: "성북 7개 대학 기숙사 1박 ₩29,000부터 · 같은 학교 대학생 버디 2시간 ₩30,000" },
  { t: "AI 산책 코스를 걸어요", d: "장소를 누르면 AI가 출처 있는 이야기를 모국어로 들려줘요 (무료)" },
  { t: "한 번에 예약하고 확정돼요", d: "대학이 숙박을 승인하고 버디가 수락하면 끝. 여행 뒤엔 사진 기록이 남아요" },
];

const GOOD: { icon: IconName; who: string; what: string; tone: string }[] = [
  { icon: "suitcase", who: "여행자", what: "방학에 비는 대학 기숙사에 묵고, 동네 대학생과 성북을 걸어요", tone: "bg-orange-bg text-orange-ink" },
  { icon: "users", who: "대학생 버디", what: "내가 아는 동네를 안내하고 활동비와 국제교류 경험을 얻어요", tone: "bg-navy-bg text-navy" },
  { icon: "building", who: "대학", what: "방학 빈방으로 수입을 얻고, 신청·정산은 앱이 대신해요", tone: "bg-[#E8F3EC] text-[#2F6B45]" },
];

export default function Splash() {
  const router = useRouter();
  const { set } = useLang();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function demo(email: string) {
    setBusy(email); setErr(null);
    try {
      const r = await post<TokenOut>("/auth/login", { email, password: DEMO_PASSWORD });
      session.set(r.user, r.access_token);
      set("ko"); // 데모는 한국어 화면으로 시작 (오른쪽 위 언어 버튼으로 영어 전환)
      router.push(homeFor(r.user.role));
    } catch (e) { setErr(errMsg(e)); setBusy(null); }
  }

  return (
    <main className="mobile-shell flex flex-col">
      {/* [남색] 첫 장면: 한 문장 + 소개 영상 */}
      <section className="bg-navy px-6 pb-8 pt-[max(env(safe-area-inset-top),24px)] text-white">
        <div className="flex items-center gap-2.5">
          <LogoMark className="h-9 w-9 rounded-[10px] ring-1 ring-white/25" />
          <span className="text-[18px] font-bold">성북스테이</span>
          <span className="ml-1 text-[11px] font-bold tracking-[0.25em] text-white/60">SB STAY</span>
          <Link href="/login" className="ml-auto rounded-full px-2 py-1 text-[13px] font-semibold text-white/70 hover:text-white">로그인</Link>
        </div>
        <h1 className="mt-7 text-[28px] font-bold leading-[1.32] tracking-[-0.02em]">
          방학엔 대학 기숙사에 머물고,<br /><span className="text-[#F3B48A]">동네 대학생</span>과 성북을 걸어요
        </h1>
        <p className="mt-2.5 text-[15px] leading-relaxed text-white/75">숙소 · 동네 친구 · 장소 이야기를<br />한 번에 예약하는 성북 여행</p>

        <figure className="mt-6 overflow-hidden rounded-[16px] bg-black/30 ring-1 ring-white/15">
          <video src={VIDEO} poster={POSTER} controls playsInline preload="none" className="aspect-video w-full bg-black object-cover" aria-label="성북스테이 소개 영상">
            <a href={VIDEO}>소개 영상 보기</a>
          </video>
          <figcaption className="flex items-center gap-2 px-3.5 py-2.5 text-[13px] text-white/80">
            <Icon name="camera" className="h-4 w-4 text-[#F3B48A]" />소개 영상 · 46초
          </figcaption>
        </figure>
      </section>

      {/* [흰색] 자세한 설명 */}
      <div className="flex flex-col bg-white px-6 pb-10">
        <section className="mt-8" aria-label="왜 만들었나요">
          <h2 className="text-[13px] font-bold tracking-[0.04em] text-orange-ink">왜 만들었나요</h2>
          <p className="mt-2 text-[19px] font-bold leading-[1.45] text-ink">성북구 숙박시설은 54곳, 서울 25개 구 중 20위예요.</p>
          <p className="mt-2 text-[14.5px] leading-relaxed text-muted">머물 곳이 적으니 외국인 여행자가 지나쳐 가요. 대신 성북엔 대학이 많아요. 방학마다 비는 기숙사와 동네를 잘 아는 대학생을 여행자와 이어요.</p>
          <p className="mt-1.5 text-[11.5px] text-muted">출처: 한국관광공사 데이터랩(2026.10) 자치구별 숙박시설</p>
        </section>

        <section className="mt-8" aria-label="이런 분께 좋아요">
          <h2 className="text-[13px] font-bold tracking-[0.04em] text-orange-ink">이런 분께 좋아요</h2>
          <ul className="mt-3 space-y-4">
            {GOOD.map((g) => (
              <li key={g.who} className="flex items-start gap-3.5">
                <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", g.tone)}><Icon name={g.icon} className="h-[22px] w-[22px]" /></span>
                <div className="min-w-0 pt-0.5">
                  <div className="text-[16px] font-bold text-ink">{g.who}</div>
                  <p className="mt-0.5 text-[14px] leading-snug text-muted">{g.what}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-7 border-l-[3px] border-orange py-0.5 pl-3.5" aria-label="버디란">
          <div className="text-[14px] font-bold text-ink">버디가 뭐예요?</div>
          <p className="mt-1 text-[14px] leading-relaxed text-muted">성북 대학에 다니는 대학생 동네 친구예요. 길 안내, 식당 주문, 통역, 사진을 도와요. 학교 메일 인증과 교육 퀴즈를 통과한 학생만 활동해요. 장소의 역사 이야기는 AI가 자료를 찾아 들려줘요.</p>
        </section>

        <section className="mt-8" aria-label="이렇게 이용해요">
          <h2 className="text-[13px] font-bold tracking-[0.04em] text-orange-ink">이렇게 이용해요</h2>
          <ol className="mt-3">
            {STEPS.map((st, i) => (
              <li key={st.t} className="relative flex gap-3.5 pb-5 last:pb-0">
                {i < STEPS.length - 1 && <span className="absolute left-[13px] top-8 bottom-0 border-l-2 border-dashed border-line" aria-hidden />}
                <span className="z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-[13px] font-bold text-white">{i + 1}</span>
                <div className="min-w-0 pt-0.5">
                  <div className="text-[15.5px] font-bold text-ink">{st.t}</div>
                  <p className="mt-0.5 text-[13.5px] leading-snug text-muted">{st.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-8" aria-label="함께 걷는 성북 장소">
          <h2 className="text-[13px] font-bold tracking-[0.04em] text-orange-ink">함께 걷는 성북 장소</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {PHOTOS.map((ph) => (
              <figure key={ph.src} className="relative overflow-hidden rounded-[12px] bg-gray-bg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ph.src} alt={ph.name} className="h-[104px] w-full object-cover" />
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-5 text-[11.5px] font-semibold leading-tight text-white">{ph.name}</figcaption>
              </figure>
            ))}
          </div>
          <p className="mt-2 text-[10.5px] text-muted">사진: Wikimedia Commons(Tom Page, CC BY-SA 2.0) · 국가유산청 · 한국학중앙연구원(공공누리 제1유형)</p>
        </section>
      </div>

      {/* [남색] 맨 아래: 데모로 시작하기 */}
      <section className="mt-auto bg-navy px-6 pb-[max(env(safe-area-inset-bottom),28px)] pt-8 text-white" aria-label="가입 없이 바로 둘러보기">
        <h2 className="text-[20px] font-bold leading-snug">가입 없이 바로 둘러보세요</h2>
        <p className="mt-1 text-[13.5px] text-white/65">누르면 데모 계정으로 바로 들어가요. 오른쪽 위 버튼으로 영어로도 볼 수 있어요.</p>
        <div className="mt-4 space-y-2.5">
          {DEMOS.map((d, i) => (
            <button key={d.email} type="button" disabled={busy !== null} onClick={() => demo(d.email)}
              className={cn("flex w-full items-center gap-3.5 rounded-[16px] px-4 py-4 text-left transition disabled:opacity-60",
                "bg-white text-navy hover:bg-navy-bg")}>
              <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white", i === 0 ? "bg-orange" : "bg-navy")}><Icon name={d.icon} className="h-[22px] w-[22px]" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[17.5px] font-bold">{busy === d.email ? "들어가는 중…" : d.label}</span>
                <span className="mt-0.5 block text-[13px] text-muted">{d.sub}</span>
              </span>
              <Icon name="chevron-right" className="h-5 w-5 shrink-0" />
            </button>
          ))}
        </div>
        {err && <p role="alert" className="mt-2 text-[13px] font-semibold text-[#FFB4A8]">{err}</p>}
        <nav className="mt-7 flex justify-center gap-3 text-[12px] text-white/55">
          <Link href="/privacy" className="hover:underline">개인정보처리방침 Privacy</Link>
          <span aria-hidden>·</span>
          <Link href="/terms" className="hover:underline">이용약관 Terms</Link>
        </nav>
      </section>
    </main>
  );
}
