"use client";
// T17 마이페이지 — AU-03 세션, AU-04 PATCH /auth/me(이름·언어), AU-07 구글 캘린더, BK-10 알림, CM-01 GET /contents/{key}
import { useEffect, useState, type ReactNode } from "react";
import { BottomSheet, ErrorBox, LoginRequired } from "@/components/tourist";
import { CartButton } from "@/components/tourist/header-actions";
import { dateTime, errMsg, okv, ROLE_LABEL } from "@/components/tourist/format";
import { Avatar } from "@/components/tourist/trips/util";
import { Button, Hero, Icon, ListRow, Spinner, cn, inputCls } from "@/components/ui";
import { del, get, patch, post } from "@/lib/api";
import { session, useUser } from "@/lib/auth";
import { googleBody, googleConfigured, requestGoogleCode } from "@/lib/google";
import { CURRENCY_KEY, tr, useLang } from "@/lib/i18n";
import { writeLS } from "@/lib/store";
import type { ContentDoc, Lang, ListResponse, Notification, User } from "@/lib/types";

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
  return <ListRow href="/buddy/login" icon="users" title={tr("버디로 활동하기", "Become a buddy")} meta={tr("성북구 대학생이라면 버디로 지원할 수 있어요", "University students in Seongbuk-gu can apply as buddies")} className={className} />;
}

/** 두 칸 고르기 (선택 = 쪽빛 채움) */
function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex shrink-0 gap-2">
      {options.map(([v, label]) => (
        <button key={v} type="button" onClick={() => onChange(v)} aria-pressed={value === v}
          className={cn("h-10 rounded-full border px-4 text-[15px] transition", value === v ? "border-navy bg-navy font-bold text-white" : "border-line bg-white text-ink hover:border-navy/50")}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ on, onClick, disabled, label }: { on: boolean; onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} disabled={disabled}
      className={cn("relative h-8 w-[52px] shrink-0 rounded-full transition disabled:opacity-40", on ? "bg-navy" : "bg-[#C9CED3]")}>
      <span className={cn("absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-all", on ? "left-[24px]" : "left-1")} />
    </button>
  );
}

function SettingRow({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[68px] items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="text-[16px] text-ink">{title}</div>
        {sub && <div className="mt-0.5 text-[13px] text-muted">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

export default function MePage() {
  const { user } = useUser();
  const { lang, set: setLang, currency } = useLang();
  const [notis, setNotis] = useState<Notification[] | null>(null);
  const [calBusy, setCalBusy] = useState(false);
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

  const changeLang = async (l: Lang) => {
    setLang(l);
    try { const u = await patch<User | null>("/auth/me", { language: l }); session.update({ language: u?.language ?? l }); } catch { /* 화면 언어는 이미 바뀜 */ }
  };
  const toggleCalendar = async () => {
    if (!user) return;
    setCalBusy(true); setMsg(null);
    try {
      if (user.calendar_connected) { await del("/auth/google/calendar"); session.update({ calendar_connected: false }); }
      else {
        let body: { code: string; redirect_uri?: string } = { code: "mock" };
        if (googleConfigured()) { const code = await requestGoogleCode("calendar", user.email); if (!code) return; body = googleBody(code); }
        await post("/auth/google/calendar", body); session.update({ calendar_connected: true });
      }
    } catch (e) { setMsg(errMsg(e)); }
    finally { setCalBusy(false); }
  };
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

        <h2 className="mb-1 mt-9 text-[18px] font-bold text-ink">{tr("설정", "Settings")}</h2>
        <div className="divide-y divide-line">
          <SettingRow title={tr("언어", "Language")}><Segmented value={lang} options={[["en", "English"], ["ko", "한국어"]]} onChange={(v) => void changeLang(v)} /></SettingRow>
          <SettingRow title={tr("통화 표시", "Currency")} sub={tr("가격을 이 통화로 보여 드려요. 결제는 수단에 따라 토스는 원화, PayPal은 달러로 돼요", "Prices are shown in this currency. You pay in KRW with Toss or in USD with PayPal")}><Segmented value={currency} options={[["KRW", "KRW"], ["USD", "USD"]]} onChange={(v) => writeLS(CURRENCY_KEY, v)} /></SettingRow>
          <SettingRow title={tr("구글 캘린더에 일정 넣기", "Add trips to Google Calendar")}><Toggle on={!!user.calendar_connected} onClick={toggleCalendar} disabled={calBusy} label={tr("구글 캘린더에 일정 넣기", "Add trips to Google Calendar")} /></SettingRow>
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
