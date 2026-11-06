"use client";
// 관광객 화면 공용 컴포넌트 — 바텀시트·오류·로그인 안내·유형 뱃지·별점
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Banner, Card, LinkButton, TagChip, cn } from "@/components/ui";
import type { ItemType } from "@/lib/types";
import { TYPE_LABEL, loginHref } from "./format";

export function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40" onClick={onClose} role="dialog" aria-modal="true">
      <div className="w-full max-w-[430px] max-h-[85dvh] overflow-y-auto rounded-t-[20px] bg-white px-5 pt-4 pb-[max(env(safe-area-inset-bottom),20px)]" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[16px] font-bold text-ink">{title}</h3>
          <button type="button" onClick={onClose} className="text-[13px] text-muted">닫기</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ErrorBox({ message, className }: { message: string | null; className?: string }) {
  if (!message) return null;
  return <Banner variant="warn" className={className}>{message}</Banner>;
}

export function Notice({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[13px] text-orange-ink", className)}>{children}</p>;
}

/** 로그인 안 된 상태의 /trips·/me 안내 (강제 리다이렉트 없음) */
export function LoginRequired({ what }: { what: string }) {
  const path = usePathname();
  return (
    <Card tint className="text-center py-8">
      <div className="text-[16px] font-semibold text-ink">{what}은 로그인 후 볼 수 있어요</div>
      <p className="mt-1 text-[13px] text-muted">데모 계정으로 바로 로그인할 수 있어요.</p>
      <LinkButton href={loginHref(path)} className="mt-4">로그인하러 가기</LinkButton>
    </Card>
  );
}

/** 숙박/버디 유형 뱃지 — v3 장바구니의 흰 바탕 테두리 작은 태그 */
export function TypeBadge({ type, className }: { type: ItemType; className?: string }) {
  return <TagChip variant="outline" className={cn("h-6 px-2 text-[12px]", className)}>{TYPE_LABEL[type]}</TagChip>;
}

export function Stars({ value, onChange, size = "text-[18px]" }: { value: number; onChange?: (v: number) => void; size?: string }) {
  return (
    <span className={cn("inline-flex", size, "text-orange")}>
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button key={n} type="button" onClick={() => onChange(n)} className={cn("px-0.5", n > value && "opacity-30")} aria-label={`${n}점`}>★</button>
        ) : (
          <span key={n} className={cn(n > value && "opacity-30")}>★</span>
        ),
      )}
    </span>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-[14px]">
      <span className="text-muted shrink-0">{label}</span>
      <span className="text-ink text-right">{children}</span>
    </div>
  );
}

export const selectCls = "w-full h-12 rounded-[12px] border border-line bg-white px-4 text-[14px] text-ink focus:outline-none focus:border-navy";
export const textareaCls = "w-full min-h-[64px] rounded-[12px] border border-line bg-white px-4 py-3 text-[14px] text-ink placeholder:text-muted focus:outline-none focus:border-navy";
