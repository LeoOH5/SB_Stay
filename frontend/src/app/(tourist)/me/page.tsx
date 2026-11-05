"use client";
// T8 마이페이지 · 설정 · 알림 · 고객센터 — AU-03 (세션), AU-04 PATCH /auth/me (언어), BK-10 GET /notifications, CM-01 GET /contents/{key}
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Card, Chip, Hero, SectionTitle, Spinner } from "@/components/ui";
import { BottomSheet, ErrorBox, LoginRequired } from "@/components/tourist";
import { dateTime, errMsg, okv, ROLE_LABEL } from "@/components/tourist/format";
import { get, patch } from "@/lib/api";
import { session, useUser } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import type { ContentDoc, Lang, ListResponse, Notification, User } from "@/lib/types";

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
  const { lang, set: setLang } = useLang();
  const [currency, setCurrency] = useState<"KRW" | "USD">("KRW");
  const [notis, setNotis] = useState<Notification[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [doc, setDoc] = useState<ContentDoc | null>(null);
  const [docKey, setDocKey] = useState<string | null>(null);
  const [docErr, setDocErr] = useState<string | null>(null);
  const [langBusy, setLangBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    get<ListResponse<Notification>>("/notifications").then((r) => { if (alive) setNotis(r.items); }).catch((e: unknown) => { if (alive) setErr(errMsg(e)); });
    return () => { alive = false; };
  }, [user]);

  const changeLang = async (l: Lang) => {
    setLang(l);
    setLangBusy(true);
    try { const u = await patch<User | null>("/auth/me", { language: l }); session.update({ language: u?.language ?? l }); }
    catch (e) { setErr(errMsg(e)); }
    finally { setLangBusy(false); }
  };
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
            <div className="text-[15px] font-semibold text-ink truncate">{user.name}</div>
            <div className="text-[12px] text-muted truncate">{user.email} · {ROLE_LABEL[user.role]}</div>
          </div>
          <Link href="/checkout" className="text-[13px] text-navy font-semibold">수정</Link>
        </Card>

        <SectionTitle right={<span className="text-[12px] text-muted">언어만 저장 · 통화는 표시용</span>}>설정 (AU-04)</SectionTitle>
        <div className="flex items-center gap-3">
          <span className="w-10 text-[14px] text-ink">언어</span>
          <Chip selected={lang === "en"} onClick={() => changeLang("en")}>English</Chip>
          <Chip selected={lang === "ko"} onClick={() => changeLang("ko")}>한국어</Chip>
          {langBusy && <span className="text-[12px] text-muted">저장 중…</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className="w-10 text-[14px] text-ink">통화</span>
          <Chip selected={currency === "KRW"} onClick={() => setCurrency("KRW")}>KRW</Chip>
          <Chip selected={currency === "USD"} onClick={() => setCurrency("USD")}>USD</Chip>
          <span className="text-[12px] text-muted">결제는 항상 KRW</span>
        </div>

        <SectionTitle>알림 (BK-10 · 목업)</SectionTitle>
        <ErrorBox message={err} />
        {!notis && !err && <Spinner />}
        {notis && notis.length === 0 && <Card tint className="text-[13px] text-muted">알림이 없어요.</Card>}
        {notis?.map((n) => (
          <Card key={n.id} className="flex items-center gap-3 py-3">
            <span className={`h-2 w-2 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-orange"}`} />
            <div className="min-w-0 flex-1 text-[13px] text-ink truncate">{n.title}</div>
            <span className="shrink-0 text-[12px] text-muted">{dateTime(n.created_at)}</span>
          </Card>
        ))}

        <SectionTitle>고객센터 · 약관 (CM-01 · 목업)</SectionTitle>
        {DOCS.map((d) => (
          <Card key={d.key} className="flex items-center justify-between py-3" onClick={() => openDoc(d.key)}>
            <span className="text-[13px] text-ink">{d.label}</span><span className="text-muted">›</span>
          </Card>
        ))}

        <div className="flex items-center justify-between pt-3">
          <button type="button" onClick={logout} className="text-[14px] text-navy font-semibold">로그아웃</button>
          <span className="text-[12px] text-muted">Seongbuk Stay v0.1 · 성북 해커톤</span>
        </div>
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
