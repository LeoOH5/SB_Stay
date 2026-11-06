"use client";
// 로그인 안 된 상태 / 버디가 아닌 계정으로 /buddy* 접근 시 위쪽 안내 띠 (강제 리다이렉트 없음)
import Link from "next/link";
import { Banner } from "@/components/ui";
import { useUser } from "@/lib/auth";
import { isProvider } from "./format";

export function LoginGate({ className }: { className?: string }) {
  const { user } = useUser();
  if (user && isProvider(user.role)) return null;
  return (
    <Banner variant="warn" className={className ?? "mx-5 mb-2"}>
      {user ? `${user.name} 계정은 버디 계정이 아니에요. 아래는 데모 데이터예요.` : "버디로 로그인하면 내 요청·일정·활동을 볼 수 있어요. 아래는 데모 데이터예요."}{" "}
      <Link href="/buddy/login" className="underline underline-offset-2">버디 로그인</Link>
    </Banner>
  );
}
