"use client";
// T09 버디 고르기 — BD-01 GET /buddies (언어·날짜·성향 거르기), AI-03 POST /ai/buddy-match (요청 needs · 같은 대학)
// ?stay=객실&from=&to= (숙박 상세에서) · ?course=코스 (코스 상세에서) · ?date= (T12 일정의 버디 날짜). 장바구니 숙박이 있으면 그 기간·대학을 쓴다.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Banner, Button, Chip, GradeBadge, Hero, Icon, Spinner, TagChip } from "@/components/ui";
import { BottomSheet, ErrorBox } from "@/components/tourist";
import { CartButton } from "@/components/tourist/header-actions";
import { addDays, errMsg, INTEREST_LABEL, okv, univLabel } from "@/components/tourist/format";
import { Avatar, Headline } from "@/components/tourist/v3";
import { SS_BUDDY_DRAFT, datesBetween, defaultBuddyDate, foreignLangs, koDay, koRange, lastRequest, stayIn, univShort, type BuddyDraft } from "@/components/tourist/v3/flow";
import { useSS } from "@/components/tourist/session";
import { get, post } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { CAN_HELP, DIET_TO_HELP, PERSONALITY, label, requestChips } from "@/lib/codes";
import { curLang, tr, useLang } from "@/lib/i18n";
import type { Buddy, BuddyMatch, CanHelp, DormRoom, ListResponse, Personality, WalkStyle } from "@/lib/types";

const LANGS: { key: string; label: string }[] = [{ key: "en", label: "English" }, { key: "ja", label: "日本語" }, { key: "zh", label: "中文" }];
/** 성향 칩 — BD-01 personality · style · can_help 쿼리 */
type Trait = { key: string; label: [string, string]; personality?: Personality; style?: WalkStyle; can_help?: CanHelp };
const TRAITS: Trait[] = [
  { key: "calm", label: ["차분해요", "Calm"], personality: "calm" },
  { key: "lively", label: ["활발해요", "Lively"], personality: "lively" },
  { key: "photo", label: ["사진 잘 찍어요", "Good at photos"], can_help: "photo" },
  { key: "slow_walk", label: ["천천히 걸어요", "Walks slowly"], style: "slow_walk" },
  { key: "cafe_break", label: ["카페에서 쉬어 가요", "Likes café breaks"], style: "cafe_break" },
];
const OPEN_FROM = "2027-01-05", OPEN_TO = "2027-02-20";

function BuddyRow({ b, reason, href, needs }: { b: Buddy; reason?: string; href: string; needs: CanHelp[] }) {
  const help = b.can_help.find((h) => needs.includes(h)) ?? b.can_help[0];
  const tags = [b.personality[0] && label(PERSONALITY, b.personality[0], curLang()), b.interests[0] && (INTEREST_LABEL[b.interests[0]] ?? b.interests[0]), help && label(CAN_HELP, help, curLang())].concat(b.can_drive ? [tr("운전 가능", "Can drive")] : []).filter(Boolean) as string[];
  return (
    <Link href={href} className="flex gap-4 py-5">
      <Avatar name={b.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 text-[15px] text-muted"><span className="text-[17px] font-bold text-ink">{b.name}</span> {univLabel(univShort(b.university))} {b.major} {tr(`${b.year}학년`, `Year ${b.year}`)}<GradeBadge en={curLang() === "en"} grade={b.grade} className="ml-1.5 align-[2px]" /></div>
          <Icon name="chevron-right" className="h-5 w-5 text-ink" />
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[14.5px] text-muted">
          <span>{foreignLangs(b.languages) || tr("한국어", "Korean")} ·</span>
          {b.review_count > 0 ? <><Icon name="star" className="h-[17px] w-[17px] fill-orange text-orange" /><span>{b.rating.toFixed(1)}</span></> : <span>{tr("새 버디", "New buddy")}</span>}
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">{tags.map((t) => <TagChip key={t}>{t}</TagChip>)}</div>
        {reason && <p className="mt-2.5 border-l-2 border-navy pl-3 text-[15px] leading-relaxed text-navy">{reason}</p>}
      </div>
    </Link>
  );
}

function Buddies() {
  useLang();
  const params = useSearchParams();
  const cart = useCart();
  const cartStay = stayIn(cart.items);
  const stayId = Number(params.get("stay") ?? cartStay?.ref_id ?? 0) || null;
  const from = params.get("from") ?? cartStay?.date_from ?? undefined;
  const to = params.get("to") ?? cartStay?.date_to ?? undefined;
  const course = params.get("course");
  const draft = useSS<BuddyDraft | null>(SS_BUDDY_DRAFT, null);
  const req = lastRequest(cart.items, draft);
  const needs = [...new Set((req?.diet ?? []).map((d) => DIET_TO_HELP[d]).filter((v): v is CanHelp => !!v))];

  const [univId, setUnivId] = useState<number | null>(null);
  const [language, setLanguage] = useState("en");
  const [date, setDate] = useState<string | null>(() => {
    const wanted = params.get("date");  // 숙박 기간 안이면 그 날짜 (T12 '버디 목록에서 더 보기')
    return wanted && (!from || !to || (from <= wanted && wanted <= to)) ? wanted : defaultBuddyDate(from, to);
  });
  const [traits, setTraits] = useState<string[]>([]);
  const [dateSheet, setDateSheet] = useState(false);
  const [buddies, setBuddies] = useState<Buddy[] | null>(null);
  const [match, setMatch] = useState<BuddyMatch | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // 숙박 대학 (같은 학교 버디 먼저)
  useEffect(() => {
    if (!stayId) return;
    let alive = true;
    okv(get<DormRoom>(`/dorms/${stayId}`)).then((d) => { if (alive) setUnivId(d.university.id); }).catch(() => { /* 대학 우선은 보조 */ });
    return () => { alive = false; };
  }, [stayId]);

  const sel = TRAITS.filter((t) => traits.includes(t.key));
  const personality = sel.flatMap((t) => (t.personality ? [t.personality] : []));
  const style = sel.flatMap((t) => (t.style ? [t.style] : []));
  const canHelp = sel.flatMap((t) => (t.can_help ? [t.can_help] : []));
  const qKey = JSON.stringify([language, date, personality, style, canHelp, univId, needs]);

  useEffect(() => {
    let alive = true;
    const [lg, d, ps, st, ch, uid, nd] = JSON.parse(qKey) as [string, string | null, string[], string[], string[], number | null, string[]];
    get<ListResponse<Buddy>>("/buddies", { language: lg || undefined, date: d ?? undefined, personality: ps.join(",") || undefined, style: st.join(",") || undefined, can_help: ch.join(",") || undefined })
      .then((r) => { if (alive) setBuddies(r.items); })
      .catch((e: unknown) => { if (alive) setErr(errMsg(e)); });
    post<BuddyMatch>("/ai/buddy-match", { language: lg || undefined, date: d ?? undefined, interests: [], personality: ps, style: st, needs: nd, university_id: uid ?? undefined })
      .then((m) => { if (alive) setMatch(m); })
      .catch(() => { /* 추천은 보조 */ });
    return () => { alive = false; };
  }, [qKey]);
  const reset = (fn: () => void) => { setErr(null); setBuddies(null); setMatch(null); fn(); };

  const list = buddies ?? [];
  const reasons = new Map((match?.matches ?? []).map((m) => [m.buddy_id, m]));
  const top = (match?.matches ?? []).map((m) => list.find((b) => b.id === m.buddy_id)).filter((b): b is Buddy => !!b).slice(0, 3);
  const topIds = new Set(top.map((b) => b.id));
  const rest = list.filter((b) => !topIds.has(b.id)).sort((a, c) => Number(c.university_id === univId) - Number(a.university_id === univId) || c.rating - a.rating);

  const qs = new URLSearchParams();
  if (stayId) qs.set("stay", String(stayId));
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  if (course) qs.set("course", course);
  if (date) qs.set("date", date);
  const hrefOf = (id: number) => `/buddies/${id}${qs.toString() ? `?${qs}` : ""}`;

  const dateChoices = from && to ? datesBetween(from, to) : datesBetween(addDays(OPEN_FROM, 7), addDays(OPEN_FROM, 20)).filter((d) => d <= OPEN_TO);
  const reqChips = requestChips(req, curLang());
  const loading = !buddies && !err;

  return (
    <>
      <Hero title={tr("버디", "Buddies")} className="pb-2" right={<CartButton className="-mr-1" />} />
      <Headline className="pt-3" title={tr("동네를 같이 걸을\n대학생 친구", "A local student\nto walk with")} sub={tr("숙소와 같은 학교 학생이에요. 역사 이야기는 앱의 AI가, 버디는 캠퍼스와 골목, 밥집을 맡아요.", "Students from the same school as your dorm. The app's AI tells the history; your buddy knows the campus, alleys and places to eat.")} />

      <div className="px-5 pb-8 pt-5">
        <div className="flex flex-wrap gap-2">
          {LANGS.map((l) => <Chip key={l.key} selected={language === l.key} onClick={() => reset(() => setLanguage((v) => (v === l.key ? "" : l.key)))}>{l.label}</Chip>)}
          <Chip selected={!!date} onClick={() => setDateSheet(true)}>{date ? koDay(date) : tr("날짜 상관없이", "Any date")}</Chip>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {TRAITS.map((t) => <Chip key={t.key} selected={traits.includes(t.key)} onClick={() => reset(() => setTraits((s) => (s.includes(t.key) ? s.filter((x) => x !== t.key) : [...s, t.key])))}>{tr(t.label[0], t.label[1])}</Chip>)}
        </div>

        {!(from && to) && (
          <p className="mt-4 text-[14.5px] leading-relaxed text-muted">
            {tr("숙소가 이미 있어도 괜찮아요. 숙박 없이 버디만 신청할 수 있어요.", "Already have a place to stay? You can book just a buddy.")} <Link href="/stay" className="font-semibold text-navy">{tr("숙박도 같이 보기", "See stays too")}</Link>
          </p>
        )}
        {(reqChips.length > 0 || (from && to)) && (
          <Banner variant="soft" icon={reqChips.length ? "fork" : "bed"} className="mt-5">
            <span className="font-normal text-muted">{reqChips.length > 0 ? <>{tr("내 요청", "My requests")}: {reqChips.join(", ")} · {tr("이걸 도와줄 수 있는 버디가 위에 와요", "buddies who can help come first")}</> : <>{tr(`숙박 ${koRange(from, to)} 안에 만날 수 있는 버디예요. 같은 학교 버디가 위에 와요`, `Buddies free during your stay (${koRange(from, to)}). Buddies from the same school come first`)}</>}</span>
          </Banner>
        )}

        <ErrorBox message={err} className="mt-4" />
        {loading && <Spinner />}

        {top.length > 0 && (
          <>
            <h2 className="mt-8 text-[18px] font-bold text-ink">{tr(`AI가 고른 ${top.length}명`, `${top.length} picked by AI`)}</h2>
            <div className="divide-y divide-line">
              {top.map((b) => <BuddyRow key={b.id} b={b} reason={reasons.get(b.id)?.reason} href={hrefOf(b.id)} needs={needs} />)}
            </div>
          </>
        )}
        {rest.length > 0 && (
          <>
            <h2 className="mt-8 text-[18px] font-bold text-ink">{top.length ? tr(`다른 버디 ${rest.length}명`, `${rest.length} more buddies`) : tr(`버디 ${rest.length}명`, `${rest.length} buddies`)}</h2>
            <div className="divide-y divide-line">
              {rest.map((b) => <BuddyRow key={b.id} b={b} href={hrefOf(b.id)} needs={needs} />)}
            </div>
          </>
        )}
        {buddies && list.length === 0 && <p className="py-10 text-center text-[14px] text-muted">{tr("이 조건에 만날 수 있는 버디가 없어요. 날짜나 언어를 바꿔 보세요.", "No buddies match. Try another date or language.")}</p>}
      </div>

      <BottomSheet open={dateSheet} onClose={() => setDateSheet(false)} title={from && to ? tr(`숙박 ${koRange(from, to)} 안에서`, `During your stay (${koRange(from, to)})`) : tr("언제 만날까요", "When do you want to meet?")}>
        <div className="flex flex-wrap gap-2">
          {dateChoices.map((d) => <Chip key={d} selected={date === d} onClick={() => { reset(() => setDate(d)); setDateSheet(false); }}>{koDay(d)}</Chip>)}
        </div>
        <Button variant="ghost" className="mt-4" onClick={() => { reset(() => setDate(null)); setDateSheet(false); }}>{tr("날짜 상관없이 보기", "Show any date")}</Button>
      </BottomSheet>
    </>
  );
}

export default function BuddiesPage() {
  return <Suspense fallback={<Spinner />}><Buddies /></Suspense>;
}
