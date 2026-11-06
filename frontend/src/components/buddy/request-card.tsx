"use client";
// 동행 요청 카드 (B02 홈 · B03 요청함) — 여행자·날짜·숙박·언어, 요청 사항(감 주황 태그), 코스·더 보고 싶은 곳, 메모,
// 식사·앨범 옵션, AI 동행 준비 자료(POST /ai/buddy-brief), 수락/거절(거절 사유 고르기)
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Button, Icon, StatusPill, TagChip, cn, inputCls, type IconName } from "@/components/ui";
import { MEAL_LIMIT, requestChips } from "@/lib/codes";
import { post, won } from "@/lib/api";
import type { BuddyRequest } from "@/lib/types";
import { DEMO_TODAY, krDateDow, krRange, timeSpan, type BuddyBrief } from "./format";

export type DecideAction = "approve" | "reject";
const REASONS = ["일정이 겹쳐요", "언어가 맞지 않아요", "개인 사정"];

function Line({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-[15px] leading-snug text-ink">
      <Icon name={icon} className="mt-px h-5 w-5 text-ink/80" strokeWidth={1.6} />
      <span className="min-w-0">{children}</span>
    </div>
  );
}

export function RequestCard({ req, placeNames = {}, compact, onDecide, busy }: {
  req: BuddyRequest; placeNames?: Record<number, string>; compact?: boolean;
  onDecide?: (action: DecideAction, reason?: string) => void; busy?: boolean;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [brief, setBrief] = useState<string | null>(null);
  const r = req.request;
  const chips = requestChips(r);
  const places = (r?.places ?? []).map((id) => placeNames[id] ?? `장소 ${id}`);
  const pending = req.status === "requested";
  const showBrief = !compact && req.status !== "rejected" && req.status !== "cancelled";

  useEffect(() => {
    if (!showBrief) return;
    let alive = true;
    post<BuddyBrief>("/ai/buddy-brief", { item_id: req.item_id, booking_code: req.booking_code })
      .then((b) => { if (alive) setBrief(b.brief); })
      .catch(() => { /* 실패하면 목록에 온 ai_brief 를 쓴다 */ });
    return () => { alive = false; };
  }, [showBrief, req.item_id, req.booking_code]);

  const briefText = brief ?? req.ai_brief;
  const claimsLeft = (req.meal_count ?? 0) - (req.meal_claims ?? 0);
  const pill = pending ? <StatusPill status="requested" label="새 요청" /> : req.status === "confirmed" ? <StatusPill status="confirmed" label="수락함" /> : <StatusPill status={req.status} label={req.status === "rejected" ? "거절함" : undefined} />;

  return (
    <article className={cn("rounded-[18px] border border-line bg-white px-5 pb-5 pt-[18px]", req.status === "rejected" && "opacity-80")}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="truncate text-[17px] font-bold text-ink">{req.tourist.name}</h3>
        {pill}
      </div>

      <div className="mt-3.5 space-y-2.5">
        <Line icon="calendar">{krDateDow(req.date)}, {timeSpan(req.time, req.duration_min)}</Line>
        {!compact && req.stay && <Line icon="bed">{req.stay.title.replace(/\s+\S+실$/, "")} 숙박 {krRange(req.stay.date_from, req.stay.date_to)}</Line>}
        {!compact && <Line icon="globe">{req.tourist.nationality}, {req.tourist.language}로 이야기해요</Line>}
      </div>

      {chips.length > 0 && (
        <div className="mt-4">
          {!compact && <div className="mb-2 text-[13px] text-muted">요청 사항</div>}
          <div className="flex flex-wrap gap-1.5">{chips.map((c) => <TagChip key={c} variant="orange">{c}</TagChip>)}</div>
        </div>
      )}

      {!compact && (
        <>
          {(req.course_title || places.length > 0) && (
            <p className="mt-2.5 text-[15px] leading-relaxed text-ink">
              {req.course_title && <>코스: {req.course_title}</>}
              {req.course_title && places.length > 0 && " · "}
              {places.length > 0 && <>더 가 보고 싶은 곳: {places.join(", ")}</>}
            </p>
          )}
          {r?.note && <p className="mt-2.5 text-[15px] leading-relaxed text-ink">&ldquo;{r.note}&rdquo;</p>}
          {((req.meal_count ?? 0) > 0 || req.album) && (
            <div className="mt-4 space-y-2.5">
              {(req.meal_count ?? 0) > 0 && <Line icon="fork">식사 {req.meal_count}회 · 1회 {won(MEAL_LIMIT)}까지 먼저 계산 후 청구</Line>}
              {req.album && <Line icon="camera">앨범 옵션 · 사진을 올려 주세요</Line>}
            </div>
          )}
          {briefText && (
            <div className="mt-4 border-l-[3px] border-navy pl-4">
              <div className="text-[13px] font-bold text-navy">AI 동행 준비 자료</div>
              <p className="mt-1 text-[15px] leading-relaxed text-ink">{briefText}</p>
            </div>
          )}
        </>
      )}

      {pending && onDecide && !rejecting && (
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <Button variant="ghost" className="min-h-[48px]! border-[#C9CED3]" onClick={() => setRejecting(true)} disabled={busy}>거절</Button>
          <Button className="min-h-[48px]!" onClick={() => onDecide("approve")} disabled={busy}>수락</Button>
        </div>
      )}
      {pending && onDecide && rejecting && (
        <div className="mt-5 border-t border-line pt-4">
          <div className="text-[14px] font-semibold text-ink">거절하는 까닭을 골라 주세요</div>
          <p className="mt-0.5 text-[13px] text-muted">{req.stay ? "숙박에 묶인 동행이라 여행자가 다른 버디를 다시 골라요." : "여행자에게 사유가 함께 보여요."}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {REASONS.map((x) => (
              <button key={x} type="button" onClick={() => setReason(x)} aria-pressed={reason === x}
                className={cn("h-9 rounded-full border px-3.5 text-[14px]", reason === x ? "border-navy bg-navy font-semibold text-white" : "border-line text-ink")}>{x}</button>
            ))}
          </div>
          <input className={cn(inputCls, "mt-2.5 h-11")} placeholder="직접 적기" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <Button variant="ghost" className="min-h-[48px]!" onClick={() => { setRejecting(false); setReason(""); }} disabled={busy}>돌아가기</Button>
            <Button variant="danger" className="min-h-[48px]!" onClick={() => onDecide("reject", reason.trim() || undefined)} disabled={busy}>거절하기</Button>
          </div>
        </div>
      )}

      {req.status === "confirmed" && !compact && (
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-3.5 text-[15px] font-semibold text-navy">
          {claimsLeft > 0 && req.date <= DEMO_TODAY && <Link href={`/buddy/meals/new?item=${req.item_id}`}>식비 청구 ({req.meal_claims ?? 0}/{req.meal_count})</Link>}
          {req.date <= DEMO_TODAY && <Link href={`/buddy/log?item=${req.item_id}`}>활동 기록 남기기</Link>}
          {req.date > DEMO_TODAY && <span className="font-normal text-muted">만날 곳은 앱 채팅으로 정해요</span>}
        </div>
      )}
    </article>
  );
}
