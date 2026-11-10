"use client";
// T06 방 상세 — DM-03 GET /dorms/{id}. 숙박 요청(늦은 체크인·조용한 방·낮은 층)을 장바구니 숙박 항목 request 로 담고 버디 고르기로
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Banner, Button, Chip, DormPhoto, ScoreBar, Spinner, TopBar } from "@/components/ui";
import { ErrorBox } from "@/components/tourist";
import { errMsg, okv, ROOM_LABEL, buildingName, ruleText } from "@/components/tourist/format";
import { BottomBar, InfoRow, SectionHead, TotalLine } from "@/components/tourist/v3";
import { isDormRequest, koMD, koRange, stayNights } from "@/components/tourist/v3/flow";
import { StayDatesSheet, useStayDates } from "@/components/tourist/v3/stay-list";
import { get } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { DORM_REQUEST, keysOf, label } from "@/lib/codes";
import { money, tr, useLang } from "@/lib/i18n";
import type { DormRequest, DormRequestKey, DormRoom } from "@/lib/types";

/** 묵은 여행자 후기 점수 — API 에 있으면 보여 주고 없으면 숨긴다 */
interface DormScores { clean?: number; quiet?: number; checkin?: number; count?: number }
const SCORE_LABEL: [keyof DormScores, () => string][] = [["clean", () => tr("청결", "Cleanliness")], ["quiet", () => tr("조용함", "Quiet")], ["checkin", () => tr("체크인", "Check-in")]];
const ROOM_EN: Record<string, string> = { single: "Single room", double: "Double room", twin: "Twin room" };
const roomLabel = (t: string) => tr(ROOM_LABEL[t] ?? t, ROOM_EN[t] ?? t);
const nightsTxt = (n: number) => tr(`${n}박`, `${n} night${n === 1 ? "" : "s"}`);
const NO_REQUEST: DormRequest = { late_checkin: false, quiet_room: false, low_floor: false };

export default function StayDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { lang } = useLang();
  const cart = useCart();
  const [dates, setDates] = useStayDates();
  const [sheet, setSheet] = useState(false);
  const [dorm, setDorm] = useState<DormRoom | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const inCart = cart.items.find((i) => i.type === "dorm" && i.ref_id === Number(id));
  const [req, setReq] = useState<DormRequest | null>(null);
  const request = req ?? (inCart && isDormRequest(inCart.request) ? inCart.request : NO_REQUEST);

  useEffect(() => {
    let alive = true;
    okv(get<DormRoom>(`/dorms/${id}`)).then((d) => { if (alive) setDorm(d); }).catch((e: unknown) => { if (alive) setErr(errMsg(e)); });
    return () => { alive = false; };
  }, [id]);

  const nights = stayNights(dates);
  const total = dorm ? dorm.price_per_night * nights : 0;
  const inOpen = dorm ? dates.from >= dorm.open_from && dates.to <= dorm.open_to : true;
  const univ = dorm ? (lang === "en" ? dorm.university.name_en : dorm.university.name) : "";
  const scores = (dorm as (DormRoom & { scores?: DormScores | null }) | null)?.scores ?? null;
  const shownScores = scores ? SCORE_LABEL.filter(([k]) => typeof scores[k] === "number") : [];

  const toggle = (k: DormRequestKey) => setReq({ ...request, [k]: !request[k] });

  const goBuddies = () => {
    if (!dorm || nights <= 0 || !inOpen) return;
    // 숙박은 한 곳만 (ONE_STAY) — 다른 숙박은 빼고 담는다
    cart.items.filter((i) => i.type === "dorm" && i.ref_id !== dorm.id).forEach((i) => cart.remove("dorm", i.ref_id));
    cart.add({
      type: "dorm", ref_id: dorm.id, title: `${univ} ${buildingName(dorm.building)} ${roomLabel(dorm.room_type)}`, meta: `${koRange(dates.from, dates.to)}, ${nightsTxt(nights)}`,
      price: total, date_from: dates.from, date_to: dates.to, guests: 1,
      request: Object.values(request).some(Boolean) ? request : null,
    });
    router.push(`/buddies?stay=${dorm.id}&from=${dates.from}&to=${dates.to}`);
  };

  return (
    <>
      <TopBar back="/stay" title={tr("숙박", "Stay")} />
      <div className="px-5 pt-1">
        <ErrorBox message={err} />
        {!dorm && !err && <Spinner />}
      </div>
      {dorm && (
        <>
          <div className="px-5">
            <DormPhoto src={dorm.photos[0]} label={`${buildingName(dorm.building)} ${roomLabel(dorm.room_type)}`} className="h-[200px] w-full" credit />
            <h1 className="mt-6 text-[26px] font-bold leading-[1.35] text-ink">{univ} {buildingName(dorm.building)}<br />{roomLabel(dorm.room_type)}</h1>
            <div className="mt-2 flex items-baseline gap-1.5"><span className="text-[20px] font-bold text-ink">{money(dorm.price_per_night)}</span><span className="text-[14px] text-muted">{tr("1박", "per night")}</span></div>

            {shownScores.length > 0 && (
              <div className="mt-5 space-y-3">
                {shownScores.map(([k, l]) => <ScoreBar key={k} label={l()} value={scores![k] as number} className="[&>span:first-child]:text-muted" />)}
                {scores?.count ? <p className="text-[13px] text-muted">{tr(`묵은 여행자 후기 ${scores.count}개`, `${scores.count} guest reviews`)}</p> : null}
              </div>
            )}

            <div className="mt-4 divide-y divide-line">
              <InfoRow label={tr("개방 기간", "Open")}>{koMD(dorm.open_from)} – {koMD(dorm.open_to)}</InfoRow>
              <InfoRow label={tr("남은 방", "Rooms left")}>{tr(`${dorm.available_rooms}개`, String(dorm.available_rooms))}</InfoRow>
              <InfoRow label={tr("포함", "Included")}>{tr("침구, 수건, 퇴실 청소", "Bedding, towels, checkout cleaning")}</InfoRow>
              <div className="flex items-center justify-between gap-4 py-3.5 text-[15px]">
                <span className="text-muted">{tr("묵는 날", "Dates")}</span>
                <button type="button" onClick={() => setSheet(true)} className="font-semibold text-navy underline underline-offset-2">{koRange(dates.from, dates.to)}, {nightsTxt(nights)} · {tr("바꾸기", "Change")}</button>
              </div>
            </div>
            {!inOpen && <p className="text-[13px] text-orange-ink">{tr(`개방 기간(${koMD(dorm.open_from)} – ${koMD(dorm.open_to)}) 안에서 골라 주세요.`, `Please pick dates within the open period (${koMD(dorm.open_from)} – ${koMD(dorm.open_to)}).`)}</p>}

            <SectionHead className="mt-8" title={tr("숙박 요청", "Stay requests")} right={tr("선택", "Optional")} />
            <div className="mt-3 flex flex-wrap gap-2">
              {keysOf(DORM_REQUEST).map((k) => <Chip key={k} selected={request[k]} onClick={() => toggle(k)}>{label(DORM_REQUEST, k, lang)}</Chip>)}
            </div>
            <p className="mt-3 text-[14px] text-muted">{tr("요청은 대학 담당자만 봐요. 꼭 들어준다는 약속은 아니에요.", "Only the university staff see these. They aren't guaranteed.")}</p>

            {dorm.rules.length > 0 && (
              <>
                <SectionHead className="mt-8" title={tr("지켜 주세요", "House rules")} />
                <ul className="mt-3 space-y-2.5">
                  {dorm.rules.map((r, i) => (
                    <li key={i} className="flex gap-3 text-[15px] text-ink"><span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-muted" />{ruleText(r).replace(" / ", ", ")}</li>
                  ))}
                </ul>
              </>
            )}

            <Banner icon="users" className="mb-6 mt-7">{tr("숙박에는 같은 학교 버디 1명이 꼭 함께해요. 다음 단계에서 골라요", "Every stay includes a buddy from the same school. You'll pick one next.")}</Banner>
          </div>

          <BottomBar>
            <TotalLine label={`${koRange(dates.from, dates.to)}, ${nightsTxt(nights)}`} amount={money(total)} />
            <Button className="mt-3" onClick={goBuddies} disabled={nights <= 0 || !inOpen}>{tr("버디 고르러 가기", "Choose a buddy")}</Button>
          </BottomBar>
          {sheet && <StayDatesSheet open onClose={() => setSheet(false)} value={dates} onSave={setDates} min={dorm.open_from} max={dorm.open_to} />}
        </>
      )}
    </>
  );
}
