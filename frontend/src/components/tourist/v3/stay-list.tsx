"use client";
// T05 숙박 목록 (전체 / 대학별) — DM-02 GET /dorms. 날짜는 sessionStorage 에 두고 객실 상세가 이어 쓴다
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Chip, DormPhoto, Hero, Icon, Spinner } from "@/components/ui";
import { BottomSheet, ErrorBox } from "@/components/tourist";
import { buildingName, errMsg, ROOM_LABEL } from "@/components/tourist/format";
import { HeaderActions } from "@/components/tourist/header-actions";
import { useSS, writeSS } from "@/components/tourist/session";
import { get } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { money, tr, useLang } from "@/lib/i18n";
import type { DormRoom, ListResponse, University } from "@/lib/types";
import { DEFAULT_STAY, SS_STAY_DATES, koMD, stayIn, stayNights, univShort, type StayDates } from "./flow";
import { DateBox, Headline } from ".";

/** 숙박 날짜 — 고른 값 → 장바구니 숙박 → 데모 기본값 */
export function useStayDates(): [StayDates, (v: StayDates) => void] {
  const cart = useCart();
  const saved = useSS<StayDates | null>(SS_STAY_DATES, null);
  const stay = stayIn(cart.items);
  const v = saved ?? (stay ? { from: stay.date_from!, to: stay.date_to! } : DEFAULT_STAY);
  return [v, (n) => writeSS(SS_STAY_DATES, n)];
}

/** 날짜 고르기 시트 */
export function StayDatesSheet({ open, onClose, value, onSave, min = "2027-01-05", max = "2027-02-20" }: { open: boolean; onClose: () => void; value: StayDates; onSave: (v: StayDates) => void; min?: string; max?: string }) {
  const [v, setV] = useState(value);
  const n = stayNights(v);
  return (
    <BottomSheet open={open} onClose={onClose} title={tr("숙박 날짜", "Stay dates")}>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <DateBox label={tr("체크인", "Check-in")} value={v.from} min={min} max={max} onChange={(from) => setV((s) => ({ ...s, from }))} />
        <span className="text-muted">–</span>
        <DateBox label={tr("체크아웃", "Check-out")} value={v.to} min={min} max={max} onChange={(to) => setV((s) => ({ ...s, to }))} />
      </div>
      <p className="mt-2 text-[13px] text-muted">{n > 0 ? tr(`${n}박`, `${n} night${n === 1 ? "" : "s"}`) : tr("체크아웃은 체크인보다 뒤여야 해요", "Check-out must be after check-in")} · {tr("개방 기간", "Open")} {koMD(min)} – {koMD(max)}</p>
      <Button className="mt-4" disabled={n <= 0 || v.from < min || v.to > max} onClick={() => { onSave(v); onClose(); }}>{tr("이 날짜로 보기", "Show these dates")}</Button>
    </BottomSheet>
  );
}

export function StayList({ universityId }: { universityId?: number }) {
  const router = useRouter();
  const { lang } = useLang();
  const [dates, setDates] = useStayDates();
  const [sheet, setSheet] = useState(false);
  const [all, setAll] = useState<DormRoom[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    get<ListResponse<DormRoom>>("/dorms").then((r) => { if (alive) setAll(r.items); }).catch((e: unknown) => { if (alive) setErr(errMsg(e)); });
    return () => { alive = false; };
  }, []);

  const univs: University[] = [];
  for (const d of all ?? []) if (!univs.some((u) => u.id === d.university.id)) univs.push(d.university);
  const rooms = (all ?? []).filter((d) => !universityId || d.university.id === universityId);
  const openFrom = all?.[0]?.open_from ?? "2027-01-05";
  const openTo = all?.[0]?.open_to ?? "2027-02-20";
  const univ = universityId ? univs.find((u) => u.id === universityId) : null;
  const univName = (u: University) => (lang === "en" ? u.name_en : u.name);
  const nights = stayNights(dates);

  return (
    <>
      <Hero title={tr("숙박", "Stay")} right={<HeaderActions />} className="pb-2" />
      <Headline title={univ ? tr(`${univName(univ)}\n기숙사에서 묵기`, `Stay at\n${univName(univ)}`) : tr("비어 있는\n기숙사에서 묵기", "Stay in an\nempty dorm")} sub={tr(`2027년 ${koMD(openFrom)}부터 ${koMD(openTo)}까지, 성북구 대학 ${univs.length || 7}곳이 문을 열어요.`, `From ${koMD(openFrom)} to ${koMD(openTo)}, 2027, ${univs.length || 7} universities in Seongbuk open their dorms.`)} className="pt-3" />

      <div className="px-5 pb-8 pt-6">
        <button type="button" onClick={() => setSheet(true)} className="flex h-[52px] w-full items-center gap-3 rounded-[14px] border border-line px-4 text-left">
          <Icon name="calendar" className="h-5 w-5 text-ink" />
          <span className="flex-1 text-[16px] text-ink">{koMD(dates.from)} – {koMD(dates.to)}</span>
          <span className="text-[14px] text-muted">{tr(`${nights}박`, `${nights} night${nights === 1 ? "" : "s"}`)}</span>
        </button>

        {univs.length > 1 && (
          <div className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1">
            <Chip selected={!universityId} onClick={() => router.push("/stay")}>{tr("전체", "All")}</Chip>
            {univs.map((u) => <Chip key={u.id} selected={universityId === u.id} onClick={() => router.push(`/stay/univ/${u.id}`)}>{lang === "en" ? u.name_en : univShort(u.name)}</Chip>)}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between text-[14px] text-muted">
          <span>{all ? tr(`${rooms.length}곳`, `${rooms.length} rooms`) : ""}</span><span>{tr("1박 가격", "Per night")}</span>
        </div>
        <ErrorBox message={err} className="mt-3" />
        {!all && !err && <Spinner />}
        {all && rooms.length === 0 && <p className="py-8 text-center text-[14px] text-muted">{tr("이 대학은 지금 개방된 방이 없어요.", "No rooms are open at this university right now.")}</p>}
        <div className="mt-1 divide-y divide-line">
          {rooms.map((r) => (
            <Link key={r.id} href={`/stay/${r.id}`} className="flex items-center gap-4 py-4">
              <DormPhoto src={r.photos[0]} label={buildingName(r.building)} className="h-16 w-16 shrink-0 rounded-[12px]" />
              <div className="min-w-0 flex-1">
                <div className="text-[16px] font-semibold text-ink">{univName(r.university)} {buildingName(r.building)}</div>
                <div className="mt-1 text-[14px] text-muted">{ROOM_LABEL[r.room_type]}, {tr(`남은 방 ${r.available_rooms}개`, `${r.available_rooms} left`)}</div>
              </div>
              <div className="shrink-0 text-[17px] font-bold text-ink">{money(r.price_per_night)}</div>
            </Link>
          ))}
        </div>

        {all && <p className="mt-6 border-l-[3px] border-line py-1 pl-4 text-[14.5px] leading-relaxed text-muted">{tr("숙박은 각 대학이 판매해요. 신청하면 대학 담당자가 승인한 뒤 확정돼요.", "Each university offers its own rooms. Your stay is confirmed once university staff approve it.")}</p>}
      </div>

      {sheet && <StayDatesSheet open onClose={() => setSheet(false)} value={dates} onSave={setDates} min={openFrom} max={openTo} />}
    </>
  );
}
