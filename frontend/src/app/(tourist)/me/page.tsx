"use client";
// T8 마이페이지 · 설정 · 고객센터 — AU-03 (세션), CM-01 GET /contents/{key}. 언어·알림은 상단 바
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Chip, Hero, SectionTitle, Spinner } from "@/components/ui";
import { BottomSheet, ErrorBox, LoginRequired } from "@/components/tourist";
import { errMsg, okv, ROLE_LABEL } from "@/components/tourist/format";
import { get } from "@/lib/api";
import { session, useUser } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import type { ContentDoc } from "@/lib/types";

const DOCS: { key: string; label: string }[] = [
  { key: "support", label: "고객센터 · 긴급연락처 (112 · 119 · 운영자)" },
  { key: "terms", label: "이용약관" },
  { key: "refund", label: "환불 규정 (7일 전 100% · 3일 전 50% · 이후 0%)" },
  { key: "privacy", label: "개인정보 처리방침 (여권번호는 예약 시점에만)" },
];
const PRIVACY_FALLBACK: ContentDoc = { key: "privacy", language: "ko", title: "개인정보 처리방침", body: "여권번호는 숙박 항목이 있을 때 예약 시점에만 입력받고, 승인 후 대학 담당자에게만 전달합니다 (최소 수집 원칙). 버디 연락처는 노출하지 않으며 채팅은 플랫폼 안에서만 이뤄집니다." };

export default function MePage() {
  const router = useRouter();
  const { user } = useUser();
  const { lang } = useLang();
  const [currency, setCurrency] = useState<"KRW" | "USD">("KRW");
  const [doc, setDoc] = useState<ContentDoc | null>(null);
  const [docKey, setDocKey] = useState<string | null>(null);
  const [docErr, setDocErr] = useState<string | null>(null);


  const openDoc = (key: string) => {
    setDocKey(key); setDoc(null); setDocErr(null);
    okv(get<ContentDoc>(`/contents/${key}`, { lang })).then(setDoc).catch((e: unknown) => { if (key === "privacy") setDoc(PRIVACY_FALLBACK); else setDocErr(errMsg(e)); });
  };
  const logout = () => { session.clear(); router.push("/login"); };

  if (!user) {
    return (<><Hero title="My page" /><div className="px-5 pb-6 pt-4"><LoginRequired what="마이페이지" /></div></>);
  }

  return (
    <>
      <Hero title="My page" />
      <div className="px-5 pb-6 pt-4 space-y-3">
        <Card className="flex items-center gap-3">
          <div className="h-12 w-12 shrink-0 rounded-full bg-navy-bg flex items-center justify-center text-[16px] font-semibold text-navy">{user.name[0]}</div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-ink break-keep">{user.name}</div>
            <div className="text-[12px] text-muted break-keep">{user.email} · {ROLE_LABEL[user.role]}</div>
          </div>
          <Link href="/checkout" className="text-[13px] text-navy font-semibold">수정</Link>
        </Card>

        <SectionTitle>설정</SectionTitle>
        <div className="flex items-center gap-3">
          <span className="w-10 text-[14px] text-ink">통화</span>
          <Chip selected={currency === "KRW"} onClick={() => setCurrency("KRW")}>KRW</Chip>
          <Chip selected={currency === "USD"} onClick={() => setCurrency("USD")}>USD</Chip>
          <span className="text-[12px] text-muted">결제는 원화로 진행돼요</span>
        </div>

        <SectionTitle>고객센터 · 약관</SectionTitle>
        {DOCS.map((d) => (
          <Card key={d.key} className="flex items-center justify-between py-3" onClick={() => openDoc(d.key)}>
            <span className="text-[13px] text-ink">{d.label}</span><span className="text-muted">›</span>
          </Card>
        ))}

        <Button variant="ghost" onClick={logout}>로그아웃</Button>
      </div>

      <BottomSheet open={docKey !== null} onClose={() => setDocKey(null)} title={doc?.title ?? DOCS.find((d) => d.key === docKey)?.label ?? ""}>
        <ErrorBox message={docErr} />
        {!doc && !docErr && <Spinner />}
        {doc && <div className="whitespace-pre-line text-[14px] text-ink leading-relaxed">{doc.body}</div>}
      </BottomSheet>
    </>
  );
}
