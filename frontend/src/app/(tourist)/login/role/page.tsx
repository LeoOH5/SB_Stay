"use client";
// T03 첫 로그인 역할 선택 — AU-06 PATCH /users/me/role (관광객 · 버디만). v3.9 ?next= 가 고른 역할 영역이면 그 화면으로
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Brand, Button, Spinner, cn } from "@/components/ui";
import { ErrorBox } from "@/components/tourist";
import { afterLogin, errMsg } from "@/components/tourist/format";
import { BottomBar } from "@/components/tourist/v3";
import { patch } from "@/lib/api";
import { session, useUser } from "@/lib/auth";
import type { Role, User } from "@/lib/types";

const ROLES: { role: Role; title: string; desc: string }[] = [
  { role: "tourist", title: "관광객", desc: "기숙사에 머물며 같은 학교 버디와 성북을 걸어요" },
  { role: "buddy", title: "버디", desc: "성북구 대학생이에요. 여행자와 캠퍼스·동네를 함께 걸어요" },
];

function RolePage() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const { user } = useUser();
  const [sel, setSel] = useState<Role>("tourist");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const u = await patch<User | null>("/users/me/role", { role: sel });
      session.update({ role: u?.role ?? sel });
      router.push(afterLogin(u?.role ?? sel, next));
    } catch (e) { setErr(errMsg(e)); setBusy(false); }
  };

  return (
    <div className="px-5 pt-5">
      <Brand />
      <h1 className="mt-7 text-[26px] font-bold leading-[1.35] text-ink">어떻게<br />이용하시나요?</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">{user ? `${user.name} 님의 역할을 골라 주세요.` : "역할을 골라 주세요."} 나중에 바꿀 수 없어요.</p>

      <div className="mt-7 divide-y divide-line" role="radiogroup">
        {ROLES.map((r) => (
          <button key={r.role} type="button" role="radio" aria-checked={sel === r.role} onClick={() => setSel(r.role)} className="flex w-full items-start gap-4 py-5 text-left">
            <span className={cn("mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px]", sel === r.role ? "border-navy bg-navy" : "border-[#BFC5CC]")}>
              {sel === r.role && <span className="h-2 w-2 rounded-full bg-white" />}
            </span>
            <span className="min-w-0">
              <span className="block text-[16px] font-semibold text-ink">{r.title}</span>
              <span className="mt-1 block text-[14.5px] leading-relaxed text-muted">{r.desc}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="mt-6 text-[14px] text-muted">대학 담당자와 운영자 계정은 운영팀이 따로 발급해요.</p>
      <ErrorBox message={err} className="mt-4" />

      <BottomBar><Button onClick={submit} disabled={busy}>{busy ? "저장 중…" : "시작하기"}</Button></BottomBar>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<Spinner />}><RolePage /></Suspense>;
}
