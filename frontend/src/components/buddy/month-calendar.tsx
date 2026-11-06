"use client";
// B04 월 캘린더 — 가능한 날(쪽빛 굵은 숫자 + 쪽빛 점) · 확정 동행(진한 점) · 고른 날(쪽빛 동그라미)
import { Icon, cn } from "@/components/ui";
import { DOW, toISO } from "./format";

export function MonthCalendar({ year, month, available, confirmed, selected, onPrev, onNext, onTap }: {
  year: number; month: number; // month: 1~12
  available: Set<string>; confirmed: Set<string>; selected: string | null;
  onPrev: () => void; onNext: () => void; onTap: (iso: string) => void;
}) {
  const firstDow = new Date(year, month - 1, 1).getDay();
  const days = new Date(year, month, 0).getDate();
  const cells: (string | null)[] = [...Array<null>(firstDow).fill(null)];
  for (let d = 1; d <= days; d++) cells.push(toISO(new Date(year, month - 1, d)));
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      <div className="flex items-center justify-between">
        <button type="button" aria-label="이전 달" onClick={onPrev} className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-gray-bg"><Icon name="chevron-left" className="h-5 w-5" strokeWidth={2.2} /></button>
        <span className="text-[17px] font-bold text-ink">{year}년 {month}월</span>
        <button type="button" aria-label="다음 달" onClick={onNext} className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-gray-bg"><Icon name="chevron-right" className="h-5 w-5" strokeWidth={2.2} /></button>
      </div>
      <div className="mt-3 grid grid-cols-7 text-center text-[13px] text-muted">
        {DOW.map((d) => <div key={d} className="py-1.5">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((iso, i) => {
          if (!iso) return <div key={`e${i}`} className="h-[46px]" />;
          const day = Number(iso.slice(-2));
          const isSel = iso === selected, isAvail = available.has(iso), isConf = confirmed.has(iso);
          return (
            <button key={iso} type="button" onClick={() => onTap(iso)} aria-pressed={isAvail} aria-label={`${month}월 ${day}일 ${isAvail ? "가능" : "불가"}${isConf ? " · 확정 동행" : ""}`}
              className="relative mx-auto flex h-[46px] w-[46px] items-center justify-center rounded-full transition active:scale-95">
              <span className={cn("flex h-10 w-10 items-center justify-center rounded-full text-[16px]", isSel ? "bg-navy font-bold text-white" : isAvail ? "font-bold text-navy" : "text-ink")}>{day}</span>
              {(isAvail || isConf) && !isSel && <span className={cn("absolute bottom-0 h-1.5 w-1.5 rounded-full", isConf ? "bg-ink" : "bg-navy")} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
