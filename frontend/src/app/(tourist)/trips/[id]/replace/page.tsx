"use client";
// T23 다른 버디로 바꾸기 — GET /bookings/{id}, GET /dorms/{id}(같은 대학), GET /buddies?date=… (숙박 기간 날짜마다),
// POST /bookings/{id}/items/{item_id}/replace-buddy {buddy_id, date, time}. 요청 사항·코스·식사·앨범은 서버가 그대로 옮긴다.
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ErrorBox } from "@/components/tourist";
import { DEMO_TODAY, addDays, errMsg, okv } from "@/components/tourist/format";
import { ActionBar, Avatar, LANG_KO, SwapIcon, buddyNameOf, euro, iga, krDate, krRange, useBooking } from "@/components/tourist/trips/util";
import { Button, Icon, Hero, LinkButton, Spinner, TagChip } from "@/components/ui";
import { CAN_HELP, DIET_TO_HELP, PERSONALITY, buddyItemPrice, label, requestChips } from "@/lib/codes";
import { get, post } from "@/lib/api";
import { curLang, money, tr, useLang } from "@/lib/i18n";
import { personName, majorText } from "@/lib/i18n-data";
import type { Booking, BookingItem, Buddy, BuddyRequestBody, CanHelp, DormRoom, ListResponse } from "@/lib/types";

interface Cand { b: Buddy; dates: string[] }
const canReplace = (it: BookingItem) => it.status === "requested" || it.status === "rejected" || (it.status === "confirmed" && (it.date_from ?? "") > DEMO_TODAY);
const shortUniv = (u: string) => u.replace(/학교$/, "");
const LANG_EN: Record<string, string> = { en: "English", ja: "Japanese", zh: "Chinese", fr: "French", de: "German", es: "Spanish", ru: "Russian", vi: "Vietnamese", th: "Thai", id: "Indonesian" };

/** "요청 사항(비건, 버섯 알레르기)과 식사·앨범 옵션은" / "…, 문인의 성북동 산책 코스는" */
function keepText(req: BuddyRequestBody | null, it: BookingItem): string {
  const chips = requestChips(req, curLang());
  if (curLang() === "en") {
    const optsEn = [it.meal_count ? "meal" : "", it.album ? "photo record" : ""].filter(Boolean).join(" and ");
    const partsEn = [chips.length ? `Your requests (${chips.join(", ")})` : "Your requests", optsEn ? `${optsEn} options` : ""].filter(Boolean).join(" and ");
    return it.course_title ? `${partsEn}, plus the walk (${it.course_title}), will carry over` : `${partsEn} will carry over`;
  }
  const opts = [it.meal_count ? "식사" : "", it.album ? "앨범" : ""].filter(Boolean).join("·");
  const parts = [chips.length ? `요청 사항(${chips.join(", ")})` : "요청 사항", opts ? `${opts} 옵션` : ""].filter(Boolean);
  let s = parts.join("과 ");
  if (it.course_title) return `${s}, 같이 걸을 코스(${it.course_title})는`;
  s += "은";
  return s;
}

function ReplacePage() {
  const { lang } = useLang();
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const { booking, err: loadErr } = useBooking(id);
  const [univ, setUniv] = useState<{ id: number; name: string } | null>(null);
  const [cands, setCands] = useState<Cand[] | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<Booking | null>(null);

  const itemParam = Number(sp.get("item"));
  const item = booking?.items.find((i) => i.id === itemParam && i.type === "buddy") ?? booking?.items.find((i) => i.type === "buddy" && canReplace(i));
  const dorm = booking?.items.find((i) => i.type === "dorm" && i.status !== "cancelled" && i.status !== "rejected");
  const orig = item?.date_from ?? "";
  const from = dorm?.date_from ?? orig, to = dorm?.date_to ?? orig;
  const req = (item?.request ?? null) as BuddyRequestBody | null;
  const needs = useMemo(() => [...new Set((req?.diet ?? []).map((d) => DIET_TO_HELP[d]).filter((v): v is CanHelp => !!v))], [req]);

  // 같은 대학: 숙소 대학 → 없으면 지금 버디의 대학
  useEffect(() => {
    if (!booking || !item) return;
    let alive = true;
    if (dorm) okv(get<DormRoom>(`/dorms/${dorm.ref_id}`)).then((d) => { if (alive) setUniv({ id: d.university.id, name: d.university.name }); }).catch(() => { /* 정렬만 영향 */ });
    else okv(get<Buddy>(`/buddies/${item.ref_id}`)).then((b) => { if (alive && b.university_id) setUniv({ id: b.university_id, name: b.university }); }).catch(() => { /* 정렬만 영향 */ });
    return () => { alive = false; };
  }, [booking, item, dorm]);

  // 숙박 기간(오늘 이후) 날짜마다 가능한 버디
  useEffect(() => {
    if (!item || !from) return;
    let alive = true;
    const dates: string[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) if (d >= DEMO_TODAY || d === orig) dates.push(d);
    Promise.all(dates.map((d) => get<ListResponse<Buddy>>("/buddies", { date: d }).then((r) => ({ d, items: r.items })).catch(() => ({ d, items: [] as Buddy[] }))))
      .then((rs) => {
        if (!alive) return;
        const m = new Map<number, Cand>();
        for (const { d, items } of rs) for (const b of items) {
          if (b.id === item.ref_id) continue;
          const c = m.get(b.id) ?? { b, dates: [] };
          c.dates.push(d); m.set(b.id, c);
        }
        setCands([...m.values()]);
      });
    return () => { alive = false; };
  }, [item, from, to, orig]);

  const sorted = useMemo(() => {
    if (!cands) return null;
    const score = (c: Cand) => (univ && c.b.university_id === univ.id ? 4 : 0) + (c.dates.includes(orig) ? 2 : 0) + (needs.length && needs.every((n) => c.b.can_help.includes(n)) ? 1 : 0);
    return [...cands].sort((a, b) => score(b) - score(a) || b.b.rating - a.b.rating);
  }, [cands, univ, orig, needs]);
  const chosen = sorted?.find((c) => c.b.id === sel) ?? sorted?.[0];
  const chosenDate = chosen ? (chosen.dates.includes(orig) ? orig : chosen.dates.find((d) => d >= DEMO_TODAY) ?? chosen.dates[0]) : "";

  const submit = async () => {
    if (!booking || !item || !chosen) return;
    setBusy(true); setErr(null);
    try { setDone(await post<Booking>(`/bookings/${booking.id}/items/${item.id}/replace-buddy`, { buddy_id: chosen.b.id, date: chosenDate, time: item.time })); }
    catch (e) { setErr(errMsg(e)); }
    finally { setBusy(false); }
  };

  const oldName = item ? buddyNameOf(item) : "";
  const keep = [...requestChips(req, curLang()), ...(item?.meal_count ? [tr(`식사 ${item.meal_count}회`, `${item.meal_count} meal${item.meal_count === 1 ? "" : "s"}`)] : []), ...(item?.album ? [tr("앨범", "Photo record")] : [])];
  const newPrice = chosen && item ? buddyItemPrice(chosen.b.hourly_fee ?? 15000, item.duration_min ?? 120, item.meal_count ?? 0, !!item.album) : 0;

  if (done && chosen) {
    return (
      <>
        <Hero back="/trips" backLabel={tr("내 여행", "My trips")} title={lang === "en" ? <>Request sent<br />to {personName(chosen.b.name)}</> : <>{personName(chosen.b.name)}에게<br />요청했어요</>} sub={tr(`${krDate(chosenDate)} ${item?.time ?? ""} · ${personName(chosen.b.name)}${iga(chosen.b.name)} 수락하면 내 여행에 확정으로 보여요.`, `${krDate(chosenDate)} ${item?.time ?? ""} · Once ${personName(chosen.b.name)} accepts, it shows as confirmed in My trips.`)} />
        <ActionBar><LinkButton href="/trips">{tr("내 여행으로", "Go to My trips")}</LinkButton></ActionBar>
      </>
    );
  }

  return (
    <>
      <Hero back="/trips" backLabel={tr("내 여행", "My trips")} title={lang === "en" ? <>Switch to<br />another buddy?</> : <>다른 버디로<br />바꿀까요?</>}
        sub={item ? `${item.status === "rejected" ? tr(`${oldName}${iga(oldName)} ${krDate(orig)}에 갈 수 없게 됐어요.`, `${oldName} can't make it on ${krDate(orig)}.`) : tr(`${oldName} 대신 다른 버디와 걸어요.`, `Walk with another buddy instead of ${oldName}.`)}${dorm ? tr(" 숙박에는 버디가 꼭 있어야 해서, 숙박 기간 안에서 다시 골라요.", " A stay needs a buddy, so pick one within your stay dates.") : ""}` : undefined} />

      <div className="px-5">
        <ErrorBox message={loadErr} />
        {!booking && !loadErr && <Spinner />}
        {booking && !item && <p className="py-8 text-center text-[15px] text-muted">{tr("바꿀 버디 동행이 없어요.", "No buddy walk to change.")}</p>}

        {item && (
          <>
            {(keep.length > 0 || item.course_title) && (
              <div className="flex items-start gap-3 rounded-[14px] bg-gray-bg px-4 py-3.5 text-[14px] leading-relaxed text-ink">
                <SwapIcon className="mt-0.5 h-[18px] w-[18px] text-muted" />
                <p>{keepText(req, item)}{tr(" 그대로 옮겨요", ".")}</p>
              </div>
            )}
            {!canReplace(item) && (
              <p className="mt-4 rounded-[14px] bg-orange-bg px-4 py-3 text-[14px] font-semibold text-orange-ink">{tr("이미 지난 동행이라 바꿀 수 없어요. 문제가 있었다면 신고로 알려 주세요.", "This walk has already passed, so it can't be changed. If something went wrong, please send a report.")}</p>
            )}

            <h2 className="mt-8 text-[18px] font-bold text-ink">{tr(`${krRange(from, to)}에 가능한 ${univ ? `${shortUniv(univ.name)} ` : ""}버디`, `${univ ? `${shortUniv(univ.name)} b` : "B"}uddies free ${krRange(from, to)}`)}</h2>
            {univ && <p className="mt-1 text-[13px] text-muted">{tr("같은 학교 버디를 먼저 보여 드려요", "Buddies from the same school come first")}</p>}

            {!sorted && <Spinner />}
            {sorted?.length === 0 && <p className="py-8 text-[15px] text-muted">{tr("이 기간에 가능한 버디가 없어요. 운영팀에 문의해 주세요.", "No buddies are free in this period. Please contact our team.")}</p>}
            <div className="mt-2 divide-y divide-line">
              {sorted?.map((c) => {
                const on = chosen?.b.id === c.b.id;
                const help = needs.find((n) => c.b.can_help.includes(n));
                const tags = [label(PERSONALITY, c.b.personality[0] ?? "", curLang()), label(CAN_HELP, help ?? c.b.can_help[0] ?? "", curLang()), c.b.can_drive ? tr("운전 가능", "Can drive") : ""].filter(Boolean);
                const same = c.dates.includes(orig);
                const first = same ? orig : c.dates[0];
                const langs = c.b.languages.filter((l) => l !== "ko").map((l) => (lang === "en" ? LANG_EN[l] : LANG_KO[l]) ?? l).join("·");
                return (
                  <div key={c.b.id} role="radio" aria-checked={on} tabIndex={0} onClick={() => setSel(c.b.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(c.b.id); } }}
                    className="flex cursor-pointer gap-4 py-5 outline-none focus-visible:bg-navy-bg/50">
                    <Avatar name={personName(c.b.name)} active={on} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 text-[16px]"><span className="font-bold text-ink">{personName(c.b.name)}</span> <span className="text-[14px] text-muted">{shortUniv(c.b.university)} {majorText(c.b.major)} {tr(`${c.b.year}학년`, `Year ${c.b.year}`)}</span></div>
                        <Link href={`/buddies/${c.b.id}`} onClick={(e) => e.stopPropagation()} aria-label={tr(`${personName(c.b.name)} 프로필`, `${personName(c.b.name)} profile`)} className="-mr-1 -mt-0.5 p-1 text-ink"><Icon name="chevron-right" className="h-5 w-5" /></Link>
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-[14px] text-muted">
                        {langs && <>{langs} · </>}
                        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden><path d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9L12 2.8Z" fill="#E2722F" /></svg>
                        {c.b.review_count ? c.b.rating.toFixed(1) : tr("새 버디", "New buddy")}
                      </div>
                      {tags.length > 0 && <div className="mt-2.5 flex flex-wrap gap-1.5">{tags.map((t) => <TagChip key={t}>{t}</TagChip>)}</div>}
                      <div className="mt-2.5 border-l-2 border-navy pl-3 text-[14px] font-semibold text-navy">
                        {same ? tr(`${krDate(orig)} ${item.time ?? ""} 그대로 가능`, `Free ${krDate(orig)} ${item.time ?? ""}, same time`) : tr(`${krDate(first)} 가능`, `Free ${krDate(first)}`)}{help ? tr(`, ${label(CAN_HELP, help, curLang())} 가능`, `, can help: ${label(CAN_HELP, help, curLang())}`) : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <ErrorBox message={err} className="mt-3" />
          </>
        )}
      </div>

      {item && chosen && (
        <ActionBar note={`${tr("새 버디가 수락하면 확정돼요.", "Confirmed once the new buddy accepts.")} ${newPrice === item.price ? tr("금액은 같아요.", "The price stays the same.") : tr(`금액이 ${money(newPrice)}로 바뀌어요.`, `The price changes to ${money(newPrice)}.`)}`}>
          <Button onClick={submit} disabled={busy || !canReplace(item)}>{busy ? tr("요청하는 중…", "Sending…") : tr(`${personName(chosen.b.name)}${euro(chosen.b.name)} 바꾸기`, `Switch to ${personName(chosen.b.name)}`)}</Button>
        </ActionBar>
      )}
    </>
  );
}

export default function Page() {
  return <Suspense fallback={<Spinner />}><ReplacePage /></Suspense>;
}
