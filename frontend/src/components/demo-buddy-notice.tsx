"use client";
// 데모 계정(심사용 시드 계정)은 버디 신청을 막는다 — 신청 버튼을 누르면 이 안내를 띄우고, 로그아웃 후 새 계정으로 가입하게 한다
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui";
import { session } from "@/lib/auth";
import { tr } from "@/lib/i18n";
import type { User } from "@/lib/types";

const APPLY = "/buddy/apply";

/** 데모 여행자 계정인지 (버디·관리자 데모 계정은 원래 지원 화면이 따로 막는다) */
export const isDemoTourist = (u: User | null | undefined) => !!u?.is_demo && u.role === "tourist";

export function DemoBuddyNotice({ open, onClose, ko = false }: { open: boolean; onClose: () => void; ko?: boolean }) {
  const router = useRouter();
  if (!open) return null;
  const t = (k: string, e: string) => (ko ? k : tr(k, e));
  const fresh = () => { session.clear(); onClose(); router.push(`/signup?next=${APPLY}`); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-6" onClick={onClose} role="alertdialog" aria-modal="true" aria-labelledby="demo-buddy-title">
      <div className="w-full max-w-[360px] rounded-[20px] bg-white px-5 pb-5 pt-6 text-left" onClick={(e) => e.stopPropagation()}>
        <h2 id="demo-buddy-title" className="text-[19px] font-bold leading-snug text-ink">{t("데모 계정은 버디 신청을 할 수 없어요", "Demo accounts can't apply as a buddy")}</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          {t("심사용 데모 계정이라 버디로 바꿀 수 없어요. 로그아웃한 뒤 새 계정을 만들어 신청해 주세요.", "This is a demo account for judges, so it can't become a buddy. Log out and sign up with a new account to apply.")}
        </p>
        <Button className="mt-6" onClick={fresh}>{t("로그아웃하고 새 계정 만들기", "Log out & create a new account")}</Button>
        <Button variant="ghost" className="mt-2.5" onClick={onClose}>{t("닫기", "Close")}</Button>
      </div>
    </div>
  );
}

/** 버디 신청 버튼용 — 데모 여행자면 안내를 띄우고, 아니면 go() 로 그대로 진행 */
export function useDemoBuddyGuard(user: User | null | undefined) {
  const [open, setOpen] = useState(false);
  const guard = useCallback((go: () => void) => { if (isDemoTourist(user)) setOpen(true); else go(); }, [user]);
  return { guard, open, close: () => setOpen(false) };
}
