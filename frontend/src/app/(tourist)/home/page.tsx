"use client";
// T01 홈 — HM-01 GET /packages (숙박 + 버디 + 추천 코스), 패키지 담기용 DM-03·TR-02·BD-02, TR-01 코스 수
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Banner, Brand, Button, Icon, ImageBlock, LinkButton, ListRow, Spinner, TagChip } from "@/components/ui";
import { BottomSheet, ErrorBox } from "@/components/tourist";
import { DEFAULT_FROM, addDays, errMsg, nightsBetween, okv, ROOM_LABEL } from "@/components/tourist/format";
import { TouristGuide, TouristGuideRow, useTouristGuide } from "@/components/tourist/guide";
import { HeaderActions } from "@/components/tourist/header-actions";
import { koDay, koDuration, koRange, wa } from "@/components/tourist/v3/flow";
import { SectionHead } from "@/components/tourist/v3";
import { get } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { buddyItemPrice } from "@/lib/codes";
import { money, tr, useLang } from "@/lib/i18n";
import type { Buddy, CartItem, DormRoom, ListResponse, Package, Tour } from "@/lib/types";

const SHOWN = 3;
/** 홈 대표 사진 — 길상사 (한국관광공사 TourAPI, 공공누리 제1유형). 코스 장소 사진과 같은 출처 */
const HERO_PHOTO = "https://tong.visitkorea.or.kr/cms/resource/72/3376572_image2_1.jpg";
const ROOM_EN: Record<string, string> = { single: "single room", double: "double room", twin: "twin room" };
/** 패키지 설명은 한국어만 있어서, 영어 화면용 문장을 시드 패키지 id 로 둔다 (없으면 구성으로 만든다) */
const PKG_DESC_EN: Record<number, string> = {
  1: "Double dorm room · Writers' walk with a buddy (free)",
  2: "Double dorm room · Royal tomb & fortress walk with a buddy (free)",
  3: "Single dorm room · Independence Trail with a buddy (free)",
};
const pkgDesc = (p: Package) => tr(p.description, PKG_DESC_EN[p.id] ?? `${p.nights} night${p.nights === 1 ? "" : "s"} in a dorm · walk with a buddy`);

/** 패키지 구성(숙박 + 버디, 추천 코스는 버디 항목의 course_id)을 상세 조회해 CartItem 으로 바꾼다 */
async function packageItems(p: Package): Promise<CartItem[]> {
  const items: CartItem[] = [];
  const from = DEFAULT_FROM;
  const to = addDays(from, p.nights);
  if (p.dorm_room_id) {
    const d = await okv(get<DormRoom>(`/dorms/${p.dorm_room_id}`));
    items.push({ type: "dorm", ref_id: d.id, title: tr(`${d.university.name} ${d.building} ${ROOM_LABEL[d.room_type]}`, `${d.university.name_en} ${d.building} · ${ROOM_EN[d.room_type] ?? d.room_type}`), meta: `${koRange(from, to)}, ${tr(`${p.nights}박`, `${p.nights} night${p.nights === 1 ? "" : "s"}`)}`, price: d.price_per_night * nightsBetween(from, to), date_from: from, date_to: to, guests: 1, request: null });
  }
  const course = p.tour_id ? await okv(get<Tour>(`/tours/${p.tour_id}`)) : null;
  if (p.buddy_profile_id) {
    const b = await okv(get<Buddy>(`/buddies/${p.buddy_profile_id}`));
    // 숙박 기간 안의 버디 가능 날짜 (BUDDY_OUT_OF_STAY 방지)
    const inStay = b.available_dates.filter((d) => d >= from && d <= to);
    const date = inStay.find((d) => d > from) ?? inStay[0] ?? addDays(from, 1);
    const fee = b.hourly_fee ?? 15000;
    items.push({ type: "buddy", ref_id: b.id, title: tr(`${b.name}${wa(b.name)} 동네 걷기`, `Neighborhood walk with ${b.name}`), meta: `${koDay(date)} 14:00, ${tr("2시간", "2 hr")}${course ? ` · ${tr(course.title, course.title_en)}` : ""}`, price: buddyItemPrice(fee, 120), date, time: "14:00", duration_min: 120, course_id: course?.id ?? null, course_title: course ? tr(course.title, course.title_en) : null, meal_count: 0, album: false, hourly_fee: fee, university_id: b.university_id, request: null });
  }
  return items;
}

export default function HomePage() {
  const router = useRouter();
  const { lang } = useLang();
  const { user } = useUser();
  const cart = useCart();
  const [pkgs, setPkgs] = useState<Package[] | null>(null);
  const [courses, setCourses] = useState<Tour[] | null>(null);
  const [all, setAll] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState<Package | null>(null);
  const [selItems, setSelItems] = useState<CartItem[] | null>(null);
  const [sheetErr, setSheetErr] = useState<string | null>(null);
  const guide = useTouristGuide();

  useEffect(() => {
    let alive = true;
    get<ListResponse<Package>>("/packages").then((r) => { if (alive) setPkgs(r.items); }).catch((e: unknown) => { if (alive) setErr(errMsg(e)); });
    get<ListResponse<Tour>>("/tours").then((r) => { if (alive) setCourses(r.items); }).catch(() => { /* 코스 수는 보조 */ });
    return () => { alive = false; };
  }, []);

  const openPackage = (p: Package) => {
    setSel(p); setSelItems(null); setSheetErr(null);
    packageItems(p).then(setSelItems).catch((e: unknown) => setSheetErr(errMsg(e)));
  };
  const addAll = () => {
    if (!selItems) return;
    // 숙박은 한 곳, 버디는 한 명 — 기존 숙박·버디는 바꾼다
    for (const old of cart.items) if (selItems.some((n) => n.type === old.type)) cart.remove(old.type, old.ref_id);
    selItems.forEach((i) => cart.add(i));
    setSel(null);
    router.push("/cart");
  };

  const first = user?.name.trim().split(" ")[0];
  const shown = pkgs ? (all ? pkgs : pkgs.slice(0, SHOWN)) : [];

  return (
    <>
      <header className="flex h-16 items-center justify-between bg-white px-5 pt-1">
        <Brand href="/home" />
        <HeaderActions />
      </header>

      <div className="px-5 pb-10 pt-4">
        <h1 className="text-[26px] font-bold leading-[1.35] tracking-[-0.01em] text-ink">{first ? <>{tr(`${first} 님,`, `Hi ${first},`)}<br /></> : null}{tr("이번 겨울은 성북동에서", "This winter, stay in Seongbuk")}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{tr("성북구와 대학이 함께 여는 방학 스테이예요. 1월 5일부터 2월 20일까지 기숙사에 머물며 같은 학교 버디와 동네를 걸어요.", "A vacation stay run by Seongbuk-gu and local universities. From Jan 5 to Feb 20, stay in a university dorm and walk the neighborhood with a buddy from the same school.")}</p>

        <TouristGuideRow onClick={guide.show} className="mt-4" />

        <ImageBlock src={HERO_PHOTO} label={tr("길상사 · 성북동", "Gilsangsa Temple · Seongbuk-dong")} credit={tr("한국관광공사", "Korea Tourism Organization")} h="h-[196px]" className="mt-6" />

        <LinkButton href="/plan" className="mt-5">{tr("AI에게 일정 맡기기", "Let AI plan my stay")}</LinkButton>
        <p className="mt-2.5 text-center text-[13.5px] text-muted">{tr("날짜와 예산, 관심사만 고르면 숙소·버디·산책 코스를 묶어 드려요", "Pick dates, budget and interests — we bundle a stay, a buddy and a walk")}</p>

        <SectionHead className="mt-9" title={tr("묶어서 고르기", "Bundles")}
          right={pkgs && pkgs.length > SHOWN ? <button type="button" onClick={() => setAll((v) => !v)} className="inline-flex items-center gap-0.5 font-semibold text-navy">{all ? tr("접기", "Show less") : tr("전체 보기", "See all")}<Icon name="chevron-down" className={all ? "h-4 w-4 rotate-180" : "h-4 w-4"} strokeWidth={2.4} /></button> : undefined} />
        <ErrorBox message={err} className="mt-3" />
        {!pkgs && !err && <Spinner />}
        <div className="divide-y divide-line">
          {shown.map((p) => (
            <button key={p.id} type="button" onClick={() => openPackage(p)} className="flex w-full items-center gap-3 py-4 text-left">
              <div className="min-w-0 flex-1">
                <div className="text-[16px] font-semibold text-ink">{lang === "en" ? p.title_en : p.title}</div>
                <div className="mt-1 text-[14px] text-muted">{pkgDesc(p)}</div>
              </div>
              <div className="shrink-0 text-[17px] font-bold text-ink">{money(p.total_price)}</div>
            </button>
          ))}
        </div>
        <Banner icon="users" className="mt-2">{tr("기숙사에 묵으면 같은 학교 버디가 꼭 한 번 함께해요", "Dorm stays include at least one walk with a buddy from the same school")}</Banner>

        <SectionHead className="mt-9" title={tr("따로 고르기", "Pick separately")} />
        <div className="mt-1 divide-y divide-line">
          <ListRow href="/stay" icon="bed" title={tr("기숙사 숙박", "Dorm stay")} meta={tr("버디 1명과 함께 신청해요", "Booked together with one buddy")} />
          <ListRow href="/buddies" icon="users" title={tr("대학생 버디만", "Buddy only")} meta={tr("숙박 없이 동네 걷기만 해도 돼요", "Just a neighborhood walk, no stay needed")} />
          <ListRow href="/tours" icon="route" title={tr("AI 산책 코스", "AI walks")} meta={courses ? tr(`코스 ${courses.length}개, 무료 · 장소마다 AI 이야기`, `${courses.length} walks, free · AI stories at each stop`) : tr("무료 · 장소마다 AI 이야기", "Free · AI stories at each stop")} />
        </div>

        <SectionHead className="mt-9" title={tr("성북동은요", "About Seongbuk-dong")} />
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{tr("서울 도성 바로 바깥, 문화재가 가장 많은 동네예요. 정릉, 심우장, 길상사, 수연산방, 선잠박물관이 모두 걸어서 닿는 거리에 있어요.", "Just outside Seoul's old city wall, it's the neighborhood with the most heritage sites. Jeongneung, Simujang, Gilsangsa, Suyeonsanbang and the Seonjam Museum are all within walking distance.")}</p>
      </div>

      <TouristGuide open={guide.open} onClose={guide.close} />
      <BottomSheet open={sel !== null} onClose={() => setSel(null)} title={sel ? (lang === "en" ? sel.title_en : sel.title) : ""}>
        {sel && (
          <div>
            <p className="text-[14px] text-muted">{tr("숙박은 대학이 승인하고, 버디는 버디가 수락하면 확정돼요. 산책 코스는 무료예요.", "The stay is confirmed when the university approves it, and the buddy when they accept. Walks are free.")}</p>
            <ErrorBox message={sheetErr} className="mt-3" />
            {!selItems && !sheetErr && <Spinner />}
            {selItems && (
              <>
                <div className="mt-2 divide-y divide-line">
                  {selItems.map((i) => (
                    <div key={`${i.type}-${i.ref_id}`} className="flex items-start gap-3 py-3.5">
                      <div className="min-w-0 flex-1">
                        <TagChip variant="outline" className="h-6 px-2 text-[12px]">{i.type === "dorm" ? tr("숙박", "Stay") : tr("버디", "Buddy")}</TagChip>
                        <div className="mt-1.5 text-[15px] font-semibold text-ink">{i.title}</div>
                        <div className="mt-0.5 text-[13.5px] text-muted">{i.type === "dorm" ? i.meta : `${koDay(i.date)} ${i.time}, ${koDuration(i.duration_min)}${i.course_title ? ` · ${i.course_title}` : ""}`}</div>
                      </div>
                      <div className="shrink-0 text-[15px] font-bold text-ink">{money(i.price)}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-1 flex items-center justify-between border-t border-line pt-3"><span className="text-[15px] text-muted">{tr("합계", "Total")}</span><span className="text-[20px] font-bold text-ink">{money(selItems.reduce((s, i) => s + i.price, 0))}</span></div>
                <Button className="mt-4" onClick={addAll}>{tr("모두 장바구니에 담기", "Add all to cart")}</Button>
              </>
            )}
          </div>
        )}
      </BottomSheet>
    </>
  );
}
