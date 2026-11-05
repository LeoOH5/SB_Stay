"use client";
// 탭 화면 제목 줄 오른쪽 — 언어 선택 + 알림 (BK-10 GET /notifications, AU-04 PATCH /auth/me)
import { useEffect, useState } from "react";
import { get, patch } from "@/lib/api";
import { session, useUser } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import type { Lang, ListResponse, Notification, User } from "@/lib/types";
import { BottomSheet } from "@/components/tourist";
import { dateTime } from "@/components/tourist/format";

const READ_KEY = "sbstay.readNotis";

// 읽음 처리 API가 없어 이 브라우저에만 읽은 알림 id를 기억
function readIds(): number[] {
  try { return JSON.parse(localStorage.getItem(READ_KEY) ?? "[]") as number[]; } catch { return []; }
}
function markRead(ids: number[]) {
  try { localStorage.setItem(READ_KEY, JSON.stringify([...new Set([...readIds(), ...ids])])); } catch { /* 저장 못 해도 화면만 영향 */ }
}

export function HeaderActions() {
  const { user } = useUser();
  const { lang, set: setLang } = useLang();
  const [notis, setNotis] = useState<Notification[] | null>(null);
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    get<ListResponse<Notification>>("/notifications").then((r) => {
      if (!alive) return;
      const read = readIds();
      setNotis(r.items.map((n) => (n.read_at || !read.includes(n.id) ? n : { ...n, read_at: "local" })));
    }).catch(() => { /* 알림은 선택 */ });
    return () => { alive = false; };
  }, [user]);

  const list = user ? notis : [];
  const unread = (list ?? []).filter((n) => !n.read_at).length;

  const changeLang = async (l: Lang) => {
    setLang(l); setLangOpen(false);
    if (!user) return;
    try { const u = await patch<User | null>("/auth/me", { language: l }); session.update({ language: u?.language ?? l }); } catch { /* 화면 언어는 이미 바뀜 */ }
  };
  const openNotis = () => {
    setOpen(true); setLangOpen(false);
    if (notis) markRead(notis.map((n) => n.id));
    setTimeout(() => setNotis((ns) => ns?.map((n) => (n.read_at ? n : { ...n, read_at: "local" })) ?? ns), 1200);
  };

  return (
    <>
      <div className="-mr-2 -mt-1 flex shrink-0 items-center gap-0.5 text-white">
        <div className="relative">
          <button type="button" onClick={() => setLangOpen((v) => !v)} className="flex h-9 items-center gap-1 rounded-lg px-1.5 text-[13px] font-semibold text-white/90 hover:bg-white/10" aria-label="언어 선택">
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" /></svg>
            {lang === "en" ? "EN" : "KO"}
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}><path d="m6 9 6 6 6-6" /></svg>
          </button>
          {langOpen && <button type="button" aria-label="닫기" className="fixed inset-0 z-20 cursor-default" onClick={() => setLangOpen(false)} />}
          {langOpen && (
            <div className="absolute right-0 top-10 z-30 w-32 overflow-hidden rounded-xl bg-white py-1 text-ink shadow-lg ring-1 ring-line">
              {([["en", "English"], ["ko", "한국어"]] as const).map(([l, label]) => (
                <button key={l} type="button" onClick={() => void changeLang(l)} className={`block w-full px-3 py-2 text-left text-[14px] ${lang === l ? "font-semibold text-navy" : ""}`}>{label}{lang === l ? " ✓" : ""}</button>
              ))}
            </div>
          )}
        </div>
        <button type="button" onClick={openNotis} className="relative flex h-9 w-9 items-center justify-center rounded-lg text-white/90 hover:bg-white/10" aria-label={`알림${unread ? ` ${unread}개` : ""}`}>
          <svg viewBox="0 0 24 24" className="h-[21px] w-[21px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
          {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange px-1 text-[10px] font-bold leading-none text-white">{unread}</span>}
        </button>
      </div>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="알림">
        {!user && <p className="py-6 text-center text-[14px] text-muted">로그인하면 예약 알림을 볼 수 있어요.</p>}
        {user && !notis && <p className="py-6 text-center text-[14px] text-muted">불러오는 중…</p>}
        {user && notis?.length === 0 && <p className="py-6 text-center text-[14px] text-muted">알림이 없어요.</p>}
        <div className="divide-y divide-line/60">
          {user && notis?.map((n) => (
            <div key={n.id} className="flex items-start gap-3 py-3">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read_at ? "bg-line" : "bg-orange"}`} />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] text-ink break-keep">{n.title}</div>
                <div className="mt-0.5 text-[12px] text-muted">{dateTime(n.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
