"use client";
// 로그인 안 된 상태 / 버디·해설사가 아닌 계정으로 /buddy* 접근 시 상단 안내 카드 (강제 리다이렉트 없음)
import Link from "next/link";
import { Card } from "@/components/ui";
import { useUser } from "@/lib/auth";
import { isProvider } from "./format";

export function LoginGate() {
  const { user } = useUser();
  if (user && isProvider(user.role)) return null;
  return (
    <Card accent="orange" className="mx-5 mt-4">
      <div className="text-[14px] font-semibold text-ink">{user ? "버디·해설사 계정이 아닙니다" : "버디 로그인이 필요합니다"}</div>
      <div className="mt-1 text-[12px] text-muted">
        {user ? `현재 ${user.name} (${user.role}) 계정으로 로그인되어 있어요. 아래 내용은 데모 데이터입니다.` : "학교 이메일로 로그인하면 내 요청·일정·활동을 볼 수 있어요. 아래 내용은 데모 데이터입니다."}
      </div>
      <Link href="/buddy/login" className="mt-2 inline-block text-[13px] font-semibold text-navy">버디 로그인 →</Link>
    </Card>
  );
}
