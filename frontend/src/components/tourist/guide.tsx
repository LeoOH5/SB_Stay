"use client";
// 여행자 첫 방문 안내 — 처음 홈에 들어오면 한 번 아래에서 올라오고, 홈의 '이용 방법' 줄로 다시 볼 수 있다. (버디 안내와 같은 방식)
import { useState, useSyncExternalStore } from "react";
import { BottomSheet } from "@/components/tourist";
import { Button, Icon, cn, type IconName } from "@/components/ui";
import { tr } from "@/lib/i18n";

const KEY = "sbstay.touristGuide.v1";
const steps = (): { icon: IconName; title: string; body: string; where: string }[] => [
  { icon: "bed", title: tr("방학에 빈 기숙사를 골라요", "Pick an empty dorm"), body: tr("1월 5일부터 2월 20일까지 성북 7개 대학 기숙사가 문을 열어요. 1박 ₩29,000부터예요.", "From Jan 5 to Feb 20, dorms at 7 Seongbuk universities open up — from ₩29,000 a night."), where: tr("아래 '숙박' 탭", "'Stay' tab below") },
  { icon: "users", title: tr("동네 대학생 버디를 골라요", "Choose a local student buddy"), body: tr("같은 학교 대학생이 2시간 동안 길 안내, 식당 주문, 통역, 사진을 도와요.", "A student from the same school helps for 2 hours — directions, ordering food, translating and photos."), where: tr("홈 '따로 고르기 › 대학생 버디만'", "Home › 'Buddy only'") },
  { icon: "route", title: tr("AI 산책 코스를 걸어요", "Walk an AI route"), body: tr("장소를 누르면 AI가 출처 있는 이야기를 모국어로 들려줘요. 코스는 무료예요.", "Tap a place and AI tells its story in your language, with sources. Walks are free."), where: tr("아래 '코스' 탭", "'Walks' tab below") },
  { icon: "sparkle", title: tr("한 번에 예약해요", "Book it all at once"), body: tr("'AI에게 일정 맡기기'를 누르면 날짜·예산·관심사로 숙소·버디·코스를 묶어 줘요. 대학이 승인하고 버디가 수락하면 확정돼요.", "Tap 'Let AI plan my stay' to bundle a stay, buddy and walk by date, budget and interests. It's confirmed once the university approves and the buddy accepts."), where: tr("홈 'AI에게 일정 맡기기'", "Home › 'Let AI plan my stay'") },
];

const seen = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return true; } };
const noop = () => () => {};

export function useTouristGuide() {
  const wasSeen = useSyncExternalStore(noop, seen, () => true); // 서버 렌더에선 띄우지 않음
  const [state, setState] = useState<"auto" | "open" | "closed">("auto");
  const open = state === "open" || (state === "auto" && !wasSeen);
  const close = () => { setState("closed"); try { localStorage.setItem(KEY, "1"); } catch { /* 무시 */ } };
  return { open, show: () => setState("open"), close };
}

export function TouristGuideRow({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex w-full items-center gap-3 rounded-[14px] bg-orange-bg px-4 py-3 text-left", className)}>
      <Icon name="info" className="h-5 w-5 shrink-0 text-orange-ink" />
      <span className="flex-1 text-[14.5px] font-semibold text-orange-ink">{tr("처음이라면? 성북스테이 이용 방법 4단계", "New here? How SB Stay works in 4 steps")}</span>
      <Icon name="chevron-right" className="h-5 w-5 shrink-0 text-orange-ink" />
    </button>
  );
}

export function TouristGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <BottomSheet open={open} onClose={onClose} title={tr("성북스테이는 이렇게 써요", "How SB Stay works")}>{open && <Steps onClose={onClose} />}</BottomSheet>;
}

function Steps({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const list = steps();
  const s = list[i];
  const last = i === list.length - 1;
  return (
    <>
      <div className="flex gap-1.5" aria-hidden>
        {list.map((_, k) => <span key={k} className={cn("h-1 flex-1 rounded-full", k <= i ? "bg-orange" : "bg-line")} />)}
      </div>
      <div className="mt-6 flex flex-col items-center text-center" aria-live="polite">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-navy-bg text-navy"><Icon name={s.icon} className="h-8 w-8" /></span>
        <div className="mt-4 text-[13px] font-bold text-orange-ink">{i + 1} / {list.length}</div>
        <h4 className="mt-1 text-[21px] font-bold text-ink">{s.title}</h4>
        <p className="mt-2 min-h-[66px] text-[15px] leading-relaxed text-muted">{s.body}</p>
        <span className="mt-3 rounded-full bg-gray-bg px-3 py-1.5 text-[13px] font-semibold text-ink">{tr("어디서?", "Where?")} {s.where}</span>
      </div>
      <div className="mt-7 flex gap-2">
        {i > 0 && <Button variant="secondary" full={false} className="px-5" onClick={() => setI(i - 1)}>{tr("이전", "Back")}</Button>}
        <Button onClick={() => (last ? onClose() : setI(i + 1))}>{last ? tr("시작할게요", "Let's go") : tr("다음", "Next")}</Button>
      </div>
    </>
  );
}
