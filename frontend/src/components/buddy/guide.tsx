"use client";
// 버디 첫 방문 안내 — 처음 들어오면 한 번 자동으로 뜨고, 홈의 '버디 활동 안내'로 다시 볼 수 있다.
import { useState, useSyncExternalStore } from "react";
import { BottomSheet } from "@/components/tourist";
import { Button, Icon, cn, type IconName } from "@/components/ui";

const KEY = "sbstay.buddyGuide.v1";
const STEPS: { icon: IconName; title: string; body: string; where: string }[] = [
  { icon: "calendar", title: "가능한 날짜를 열어요", body: "시간 되는 날만 열어 두면, 그날 성북을 걷고 싶은 여행자가 나를 찾을 수 있어요.", where: "아래 '일정' 탭" },
  { icon: "inbox", title: "요청을 보고 수락해요", body: "여행자가 고른 날짜·코스·하고 싶은 것을 보고 수락하거나 거절해요.", where: "홈 '새 요청' · '요청함' 탭" },
  { icon: "users", title: "2시간 함께 걸어요", body: "길 안내, 식당 주문, 사진을 도와요. 장소 역사는 AI가 자료를 찾아 요약해 줘서 외우지 않아도 돼요.", where: "요청 카드의 'AI 동행 준비 자료'" },
  { icon: "receipt", title: "기록 남기고 정산받아요", body: "다녀온 곳·사진과 식비 영수증을 올리면, 활동비와 식비가 한 번에 정산돼요.", where: "홈 '할 일' · '내 활동' 탭" },
];

const seen = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return true; } };
const noop = () => () => {};

export function useBuddyGuide() {
  const wasSeen = useSyncExternalStore(noop, seen, () => true); // 서버 렌더에선 띄우지 않음
  const [state, setState] = useState<"auto" | "open" | "closed">("auto");
  const open = state === "open" || (state === "auto" && !wasSeen);
  const close = () => { setState("closed"); try { localStorage.setItem(KEY, "1"); } catch { /* 무시 */ } };
  return { open, show: () => setState("open"), close };
}

export function BuddyGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <BottomSheet open={open} onClose={onClose} title="버디는 이렇게 활동해요">{open && <Steps onClose={onClose} />}</BottomSheet>;
}

function Steps({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const s = STEPS[i];
  const last = i === STEPS.length - 1;
  return (
    <>
      <div className="flex gap-1.5" aria-hidden>
        {STEPS.map((_, k) => <span key={k} className={cn("h-1 flex-1 rounded-full", k <= i ? "bg-orange" : "bg-line")} />)}
      </div>
      <div className="mt-6 flex flex-col items-center text-center" aria-live="polite">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-navy-bg text-navy"><Icon name={s.icon} className="h-8 w-8" /></span>
        <div className="mt-4 text-[13px] font-bold text-orange-ink">{i + 1} / {STEPS.length}</div>
        <h4 className="mt-1 text-[21px] font-bold text-ink">{s.title}</h4>
        <p className="mt-2 min-h-[66px] text-[15px] leading-relaxed text-muted">{s.body}</p>
        <span className="mt-3 rounded-full bg-gray-bg px-3 py-1.5 text-[13px] font-semibold text-ink">어디서? {s.where}</span>
      </div>
      <div className="mt-7 flex gap-2">
        {i > 0 && <Button variant="secondary" full={false} className="px-5" onClick={() => setI(i - 1)}>이전</Button>}
        <Button onClick={() => (last ? onClose() : setI(i + 1))}>{last ? "시작할게요" : "다음"}</Button>
      </div>
    </>
  );
}
