"use client";
// T1 홈 — HM-01 GET /packages, 패키지 담기용 DM-03·TR-02·BD-02
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AiBlock, Button, Card, CategoryTiles, Hero, LinkButton, ListRow, SectionTitle, Spinner } from "@/components/ui";
import { BottomSheet, ErrorBox, TypeBadge } from "@/components/tourist";
import { addDays, DEFAULT_FROM, DEFAULT_TOUR_DATE, errMsg, md, nightsBetween, okv, ROOM_LABEL } from "@/components/tourist/format";
import { get, won } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { useLang } from "@/lib/i18n";
import type { Buddy, CartItem, DormRoom, ListResponse, Package, Tour } from "@/lib/types";

/** 패키지 구성(dorm/tour/buddy)을 상세 조회해 CartItem 으로 변환 */
async function packageItems(p: Package): Promise<CartItem[]> {
  const items: CartItem[] = [];
  const from = DEFAULT_FROM;
  const to = addDays(from, p.nights);
  if (p.dorm_room_id) {
    const d = await okv(get<DormRoom>(`/dorms/${p.dorm_room_id}`));
    items.push({ type: "dorm", ref_id: d.id, title: `${d.university.name} ${d.building} ${ROOM_LABEL[d.room_type]}`, meta: `${md(from)} – ${md(to)} · ${p.nights}박`, price: d.price_per_night * nightsBetween(from, to), date_from: from, date_to: to, guests: 1 });
  }
  if (p.tour_id) {
    const t = await okv(get<Tour>(`/tours/${p.tour_id}`));
    items.push({ type: "tour", ref_id: t.id, title: t.title, meta: `${md(DEFAULT_TOUR_DATE)} 10:00 · 해설사 ${t.guide.name} · ${t.meeting_point}`, price: t.price, date: DEFAULT_TOUR_DATE, time: "10:00", duration_min: t.duration_min });
  }
  if (p.buddy_profile_id) {
    const b = await okv(get<Buddy>(`/buddies/${p.buddy_profile_id}`));
    const date = b.available_dates[0] ?? DEFAULT_TOUR_DATE;
    items.push({ type: "buddy", ref_id: b.id, title: `${b.name}와 동네 걷기`, meta: `${md(date)} 14:00 · 2시간`, price: (b.hourly_fee ?? 15000) * 2, date, time: "14:00", duration_min: 120 });
  }
  return items;
}

export default function HomePage() {
  const router = useRouter();
  const { lang } = useLang();
  const { user } = useUser();
  const cart = useCart();
  const [pkgs, setPkgs] = useState<Package[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState<Package | null>(null);
  const [selItems, setSelItems] = useState<CartItem[] | null>(null);
  const [sheetErr, setSheetErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    get<ListResponse<Package>>("/packages").then((r) => { if (alive) setPkgs(r.items); }).catch((e: unknown) => { if (alive) setErr(errMsg(e)); });
    return () => { alive = false; };
  }, []);

  const openPackage = (p: Package) => {
    setSel(p); setSelItems(null); setSheetErr(null);
    packageItems(p).then(setSelItems).catch((e: unknown) => setSheetErr(errMsg(e)));
  };
  const addAll = () => {
    if (!selItems) return;
    selItems.forEach((i) => cart.add(i));
    setSel(null);
    router.push("/cart");
  };

  return (
    <>
      <Hero title={user ? `${user.name.split(" ")[0]} 님, 반가워요` : "Seongbuk Stay"} sub="성북 대학 기숙사에 머물며 걷는 역사 여행"
        right={user ? <Link href="/me" className="rounded-lg bg-white/15 px-2.5 py-1 text-[12px] font-semibold text-white">마이페이지</Link> : <Link href="/login" className="rounded-lg bg-green px-2.5 py-1 text-[12px] font-semibold text-navy">로그인</Link>} />
      <div className="px-5 pb-8 pt-4 space-y-3">
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-navy-bg to-green-bg p-5 ring-0">
          <div className="text-[12px] font-semibold text-green-dark">AI 여행 설계</div>
          <div className="mt-1 text-[18px] font-bold leading-snug text-ink">기간과 관심사만 고르면<br />숙박·투어·버디 일정을 짜 드려요</div>
          <LinkButton href="/plan" className="mt-4">일정 만들기 →</LinkButton>
        </Card>

        <SectionTitle>둘러보기</SectionTitle>
        <CategoryTiles />

        <SectionTitle right={cart.items.length > 0 ? <Link href="/cart" className="text-[13px] text-navy font-semibold">장바구니 {cart.items.length}개 →</Link> : undefined}>추천 패키지</SectionTitle>
        <ErrorBox message={err} />
        {!pkgs && !err && <Spinner />}
        {pkgs && (
          <Card className="divide-y divide-line/60 py-0">
            {pkgs.map((p) => (
              <ListRow key={p.id} title={lang === "en" ? p.title_en : p.title} meta={p.description} onClick={() => openPackage(p)}
                right={<div className="text-[14px] font-semibold text-navy">{won(p.total_price)}</div>} />
            ))}
          </Card>
        )}

      </div>

      <BottomSheet open={sel !== null} onClose={() => setSel(null)} title={sel ? (lang === "en" ? sel.title_en : sel.title) : ""}>
        {sel && (
          <div className="space-y-3">
            <p className="text-[13px] text-muted">{sel.description} · {sel.nights}박</p>
            <AiBlock title="패키지 구성">숙박은 대학 승인, 버디는 버디 수락 후 확정돼요. 투어는 즉시 확정.</AiBlock>
            <ErrorBox message={sheetErr} />
            {!selItems && !sheetErr && <Spinner />}
            {selItems && (
              <div className="space-y-2">
                {selItems.map((i) => (
                  <Card key={`${i.type}-${i.ref_id}`} className="flex items-center gap-3 p-3">
                    <TypeBadge type={i.type} />
                    <div className="min-w-0 flex-1"><div className="text-[14px] font-semibold text-ink break-keep">{i.title}</div><div className="text-[12px] text-muted">{i.meta}</div></div>
                    <div className="text-[14px] font-semibold text-ink">{won(i.price)}</div>
                  </Card>
                ))}
                <div className="flex items-end justify-between pt-1"><span className="text-[13px] text-muted">합계</span><span className="text-[22px] font-bold text-navy">{won(selItems.reduce((s, i) => s + i.price, 0))}</span></div>
                <Button onClick={addAll}>모두 장바구니에 담기</Button>
              </div>
            )}
          </div>
        )}
      </BottomSheet>
    </>
  );
}
