"use client";
// 요청 카드 (B1·B2 공용) — 관광객·날짜/시간·언어·관심사 + 수락/거절. 거절 시 인라인 사유 폼.
import { useState } from "react";
import { AiBlock, Button, Card, StatusPill, inputCls } from "@/components/ui";
import type { BuddyRequest } from "@/lib/types";
import { fmtDate, timeRange } from "./format";

export type DecideAction = "approve" | "reject";
const REASONS = ["일정 겹침", "언어가 맞지 않아요", "개인 사정"];

export function RequestCard({ req, compact, brief, onBrief, onDecide, busy }: {
  req: BuddyRequest; compact?: boolean; brief?: string | null; onBrief?: () => void;
  onDecide?: (action: DecideAction, reason?: string) => void; busy?: boolean;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const when = `${fmtDate(req.date)} ${timeRange(req.time, req.duration_min)}`;
  const decided = req.status !== "requested";

  return (
    <Card accent={decided ? (req.status === "confirmed" ? "green" : undefined) : "orange"}>
      <div className="flex items-center gap-2">
        <StatusPill status={req.status} label={req.status === "requested" ? "새 요청" : req.status === "confirmed" ? "수락됨" : undefined} />
        <span className="text-[15px] font-semibold text-ink">{req.tourist.name} · {req.tourist.nationality}</span>
      </div>
      {compact ? (
        <div className="mt-2 text-[12px] text-muted">{when} · {req.tourist.language} · {req.interests.join(", ")}</div>
      ) : (
        <div className="mt-2 space-y-1 text-[12px] text-muted">
          <div><span className="mr-2 text-ink/70">날짜</span>{when}</div>
          <div><span className="mr-2 text-ink/70">언어</span>{req.tourist.language}<span className="mx-2">·</span><span className="mr-2 text-ink/70">관심사</span>{req.interests.join(", ")}</div>
        </div>
      )}

      {!compact && (brief || req.ai_brief) && (
        <AiBlock title="동행 준비 자료" className="mt-3">{brief ?? req.ai_brief}</AiBlock>
      )}
      {!compact && !brief && !req.ai_brief && onBrief && (
        <Button variant="ghost" className="mt-3 h-10! min-h-10! text-[13px]" onClick={onBrief} disabled={busy}>AI 동행 준비 자료 받기</Button>
      )}

      {!decided && onDecide && !rejecting && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Button className="h-10! min-h-10! text-[14px]" onClick={() => onDecide("approve")} disabled={busy}>수락</Button>
          <Button variant="ghost" className="h-10! min-h-10! text-[14px] text-muted" onClick={() => setRejecting(true)} disabled={busy}>거절</Button>
        </div>
      )}
      {!decided && onDecide && rejecting && (
        <div className="mt-3 rounded-xl bg-gray-bg p-3">
          <div className="mb-2 text-[12px] text-muted">거절 사유</div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {REASONS.map((r) => (
              <button key={r} type="button" onClick={() => setReason(r)} className={`h-8 rounded-full border px-3 text-[12px] ${reason === r ? "border-navy bg-navy text-white" : "border-line bg-white text-ink"}`}>{r}</button>
            ))}
          </div>
          <input className={`${inputCls} h-10!`} placeholder="직접 입력" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Button variant="danger" className="h-10! min-h-10! text-[14px]" onClick={() => onDecide("reject", reason || undefined)} disabled={busy}>거절 확정</Button>
            <Button variant="ghost" className="h-10! min-h-10! text-[14px]" onClick={() => { setRejecting(false); setReason(""); }} disabled={busy}>취소</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
