"use client";
// B3 월 캘린더 — 가능(녹색 틴트) · 불가 · 선택(청색) · 확정 일정(점)
import { Card } from "@/components/ui";
import { DOW, toISO } from "./format";

export function MonthCalendar({ year, month, available, confirmed, selected, onPrev, onNext, onTap }: {
  year: number; month: number; // month: 1~12
  available: Set<string>; confirmed: Set<string>; selected: string | null;
  onPrev: () => void; onNext: () => void; onTap: (iso: string) => void;
}) {
  const first = new Date(year, month - 1, 1);
  const firstDow = first.getDay();
  const days = new Date(year, month, 0).getDate();
  const cells: (string | null)[] = [...Array<null>(firstDow).fill(null)];
  for (let d = 1; d <= days; d++) cells.push(toISO(new Date(year, month - 1, d)));
  while (cells.length % 7 !== 0) cells.push(null);
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const availCount = [...available].filter((d) => d.startsWith(prefix)).length;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-[15px] font-semibold text-navy">
          <button type="button" aria-label="이전 달" onClick={onPrev} className="h-8 w-8 rounded-full hover:bg-navy-bg">‹</button>
          <span>{year}년 {month}월</span>
          <button type="button" aria-label="다음 달" onClick={onNext} className="h-8 w-8 rounded-full hover:bg-navy-bg">›</button>
        </div>
        <span className="text-[12px] text-muted">가능 {availCount}일</span>
      </div>
      <div className="mt-3 grid grid-cols-7 text-center text-[12px] text-muted">
        {DOW.map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((iso, i) => {
          if (!iso) return <div key={`e${i}`} className="h-10" />;
          const day = Number(iso.slice(-2));
          const isSel = iso === selected, isAvail = available.has(iso), isConf = confirmed.has(iso);
          const cls = isSel ? "bg-navy text-white" : isAvail ? "bg-green-bg text-green-dark" : "text-muted";
          return (
            <button key={iso} type="button" onClick={() => onTap(iso)} aria-pressed={isAvail} aria-label={`${month}월 ${day}일 ${isAvail ? "가능" : "불가"}${isConf ? " · 확정 일정" : ""}`}
              className="relative mx-auto flex h-10 w-10 flex-col items-center justify-center rounded-[10px] text-[14px] transition active:scale-95">
              <span className={`flex h-9 w-9 items-center justify-center rounded-[10px] ${cls}`}>{day}</span>
              {isConf && <span className={`absolute bottom-0.5 h-1.5 w-1.5 rounded-full ${isSel ? "bg-green" : "bg-navy"}`} />}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
