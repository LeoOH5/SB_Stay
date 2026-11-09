"use client";
// T17 마이페이지 — AU-03 세션, AU-04 PATCH /auth/me(이름), BK-10 알림, CM-01 GET /contents/{key}
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BottomSheet, ErrorBox, LoginRequired } from "@/components/tourist";
import { CartButton } from "@/components/tourist/header-actions";
import { dateTime, errMsg, okv, ROLE_LABEL } from "@/components/tourist/format";
import { Avatar } from "@/components/tourist/trips/util";
import { DemoBuddyNotice, useDemoBuddyGuard } from "@/components/demo-buddy-notice";
import { Button, Hero, Icon, ListRow, Spinner, inputCls } from "@/components/ui";
import { get, patch } from "@/lib/api";
import { session, useUser } from "@/lib/auth";
import { tr, useLang } from "@/lib/i18n";
import type { ContentDoc, ListResponse, Notification, User } from "@/lib/types";

const DOCS: { key: string; label: string; en: string }[] = [
  { key: "support", label: "고객센터와 긴급 연락처", en: "Help center & emergency contacts" },
  { key: "terms", label: "이용약관", en: "Terms of service" },
  { key: "refund", label: "환불 규정", en: "Refund policy" },
  { key: "privacy", label: "개인정보 처리방침", en: "Privacy policy" },
];
const PRIVACY_FALLBACK: ContentDoc = { key: "privacy", language: "ko", title: "개인정보 처리방침", body: "여권번호는 숙박 항목이 있을 때 예약 시점에만 입력받고, 승인 후 대학 담당자에게만 전달해요. 버디에게는 이름과 국적만 보여요. 채팅은 앱 안에서만 이뤄져요." };
const PRIVACY_FALLBACK_EN: ContentDoc = { key: "privacy", language: "en", title: "Privacy policy", body: "We ask for your passport number only when booking a stay, and share it only with the university staff after approval. Buddies see only your name and nationality. Chats stay inside the app." };

/** v3.9 여행자 앱 → 버디 앱 입구 */
function BuddyEntry({ className }: { className?: string }) {
  const router = useRouter();
  const { user } = useUser();
  const demo = useDemoBuddyGuard(user);
  return (
    <>
      <ListRow onClick={() => demo.guard(() => router.push("/buddy/login"))} chevron icon="users" title={tr("버디로 활동하기", "Become a buddy")} meta={tr("성북구 대학생이라면 버디로 지원할 수 있어요", "University students in Seongbuk-gu can apply as buddies")} className={className} />
      <DemoBuddyNotice open={demo.open} onClose={demo.close} />
    </>
  );
}

export default function MePage() {
  const { user } = useUser();
  const { lang } = useLang();
  const [notis, setNotis] = useState<Notification[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [doc, setDoc] = useState<ContentDoc | null>(null);
  const [docKey, setDocKey] = useState<string | null>(null);
  const [docErr, setDocErr] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    if (!user) return;
    let alive = true;
    get<ListResponse<Notification>>("/notifications").then((r) => { if (alive) setNotis(r.items); }).catch(() => { if (alive) setNotis([]); });
    return () => { alive = false; };
  }, [user]);

  const saveName = async () => {
    const n = name.trim();
    if (!n) return;
    try { const u = await patch<User | null>("/auth/me", { name: n }); session.update({ name: u?.name ?? n }); setEditing(false); }
    catch (e) { setMsg(errMsg(e)); }
  };
  const openDoc = (key: string) => {
    setDocKey(key); setDoc(null); setDocErr(null);
    okv(get<ContentDoc>(`/contents/${key}`, { lang })).then(setDoc).catch((e: unknown) => { if (key === "privacy") setDoc(lang === "en" ? PRIVACY_FALLBACK_EN : PRIVACY_FALLBACK); else setDocErr(errMsg(e)); });
  };

  if (!user) {
    return (<><Hero title={tr("마이페이지", "My page")} right={<CartButton className="-mr-1" />} /><div className="px-5 pb-6 pt-2"><LoginRequired what={tr("마이페이지", "My page")} /><BuddyEntry className="mt-4" /></div></>);
  }

  const unread = (notis ?? []).filter((n) => !n.read_at);
  return (
    <>
      <Hero title={tr("마이페이지", "My page")} right={<CartButton className="-mr-1" />} />
      <div className="px-5 pb-8">
        <div className="flex items-center gap-4 pt-1">
          <Avatar name={user.name} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="text-[18px] font-bold text-ink">{user.name}</div>
            <div className="mt-0.5 truncate text-[14px] text-muted">{user.email}, {ROLE_LABEL[user.role]}</div>
          </div>
          <button type="button" className="shrink-0 text-[15px] font-semibold text-ink" onClick={() => { setName(user.name); setEditing(true); }}>{tr("수정", "Edit")}</button>
        </div>

        <ErrorBox message={msg} className="mt-2" />

        <h2 className="mt-9 text-[18px] font-bold text-ink">{tr("알림", "Notifications")}</h2>
        {notis === null ? <Spinner /> : unread.length === 0 ? (
          <p className="mt-2 text-[14px] text-muted">{tr("새 알림이 없어요. 예약이 승인되면 여기에 보여요.", "No new notifications. Booking approvals will show up here.")}</p>
        ) : (
          <div className="mt-1 divide-y divide-line">
            {unread.slice(0, 3).map((n) => (
              <div key={n.id} className="flex items-start gap-3 py-3.5">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-orange" />
                <div className="min-w-0"><div className="text-[15px] text-ink">{n.title}</div><div className="mt-0.5 text-[13px] text-muted">{dateTime(n.created_at)}</div></div>
              </div>
            ))}
          </div>
        )}

        <h2 className="mb-1 mt-9 text-[18px] font-bold text-ink">{tr("도움말", "Help")}</h2>
        <div className="divide-y divide-line">
          {DOCS.map((d) => (
            <button key={d.key} type="button" onClick={() => openDoc(d.key)} className="flex w-full items-center justify-between py-4 text-left text-[16px] text-ink">
              {lang === "en" ? d.en : d.label}<Icon name="chevron-right" className="h-5 w-5" />
            </button>
          ))}
        </div>

        <h2 className="mb-1 mt-9 text-[18px] font-bold text-ink">{tr("버디", "Buddy")}</h2>
        <BuddyEntry />
      </div>

      <BottomSheet open={docKey !== null} onClose={() => setDocKey(null)} title={doc?.title ?? (() => { const d = DOCS.find((x) => x.key === docKey); return d ? (lang === "en" ? d.en : d.label) : ""; })()}>
        <ErrorBox message={docErr} />
        {!doc && !docErr && <Spinner />}
        {doc && <div className="whitespace-pre-line text-[15px] leading-relaxed text-ink">{doc.body}</div>}
      </BottomSheet>

      <BottomSheet open={editing} onClose={() => setEditing(false)} title={tr("이름 바꾸기", "Change name")}>
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} aria-label={tr("이름", "Name")} />
        <Button className="mt-4" onClick={saveName} disabled={!name.trim()}>{tr("저장", "Save")}</Button>
      </BottomSheet>
    </>
  );
}
