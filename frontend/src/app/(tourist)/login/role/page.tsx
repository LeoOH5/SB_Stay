"use client";
// T0 첫 로그인 역할 선택 — AU-06 PATCH /users/me/role
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Hero } from "@/components/ui";
import { ErrorBox } from "@/components/tourist";
import { errMsg, homeFor } from "@/components/tourist/format";
import { patch } from "@/lib/api";
import { session, useUser } from "@/lib/auth";
import type { Role, User } from "@/lib/types";

const ROLES: { role: Role; title: string; desc: string }[] = [
  { role: "tourist", title: "관광객 · Tourist", desc: "기숙사에 머물며 투어·버디와 성북을 걸어요" },
  { role: "buddy", title: "버디 · Buddy", desc: "성북구 대학생. 관광객과 캠퍼스·동네를 함께 걸어요 (문화교류 동행)" },
  { role: "guide", title: "해설사 · Guide", desc: "관광통역안내사·문화관광해설사. 역사 투어를 진행해요" },
];

export default function RolePage() {
  const router = useRouter();
  const { user } = useUser();
  const [sel, setSel] = useState<Role>("tourist");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const u = await patch<User | null>("/users/me/role", { role: sel });
      session.update({ role: u?.role ?? sel });
      router.push(homeFor(u?.role ?? sel));
    } catch (e) { setErr(errMsg(e)); }
    finally { setBusy(false); }
  };

  return (
    <>
      <Hero title="Welcome" sub={user ? `${user.name} 님, 어떤 역할로 이용하시나요?` : "어떤 역할로 이용하시나요?"} />
      <div className="px-5 pb-6 space-y-3">
        {ROLES.map((r) => (
          <Card key={r.role} accent={sel === r.role ? "green" : undefined} tint={sel !== r.role} onClick={() => setSel(r.role)}>
            <div className="text-[15px] font-semibold text-ink">{r.title}</div>
            <div className="mt-1 text-[12px] text-muted">{r.desc}</div>
          </Card>
        ))}
        <p className="text-[12px] text-muted">대학 담당자·운영자 계정은 운영팀이 발급합니다.</p>
        <ErrorBox message={err} />
        <Button onClick={submit} disabled={busy}>{busy ? "저장 중…" : "시작하기"}</Button>
      </div>
    </>
  );
}
