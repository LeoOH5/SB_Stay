"use client";
// 탭 화면 제목 줄 오른쪽 — 언어 선택 + 장바구니(담은 게 있을 때) + 알림 + 내 정보 (BK-10 GET /notifications, AU-04 PATCH /auth/me)
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { get, patch } from "@/lib/api";
import { session, useUser } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { tr, useLang } from "@/lib/i18n";
import type { Lang, ListResponse, Notification, User } from "@/lib/types";
import { BottomSheet } from "@/components/tourist";
import { Icon } from "@/components/ui";
import { dateTime, loginHref } from "@/components/tourist/format";
import { PersonArt } from "@/components/person-art";

const READ_KEY = "sbstay.readNotis";

// 읽음 처리 API가 없어 이 브라우저에만 읽은 알림 id를 기억
function readIds(): number[] {
  try { return JSON.parse(localStorage.getItem(READ_KEY) ?? "[]") as number[]; } catch { return []; }
}
function markRead(ids: number[]) {
  try { localStorage.setItem(READ_KEY, JSON.stringify([...new Set([...readIds(), ...ids])])); } catch { /* 저장 못 해도 화면만 영향 */ }
}

/** v3.9 장바구니 바로가기 — 담은 게 1개 이상일 때만 보인다 (서버 렌더·첫 그림에서는 빈 장바구니로 보고 숨김) */
export function CartButton({ className }: { className?: string }) {
  const { items } = useCart();
  if (items.length === 0) return null;
  return (
    <Link href="/cart" aria-label={tr(`장바구니 ${items.length}개`, `Cart, ${items.length} item${items.length === 1 ? "" : "s"}`)} className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink hover:bg-gray-bg ${className ?? ""}`}>
      <Icon name="bag" className="h-[21px] w-[21px]" />
      <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange px-1 text-[10px] font-bold leading-none text-white">{items.length}</span>
    </Link>
  );
}

export function HeaderActions() {
  const path = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const [meOpen, setMeOpen] = useState(false);
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

  const meHref = user?.role === "buddy" ? "/buddy/me" : user && user.role !== "tourist" ? "/admin" : user ? "/me" : loginHref(path);
  const logout = () => { setMeOpen(false); session.clear(); router.push("/"); };
  return (
    <>
      <div className="-mr-1 flex shrink-0 items-center gap-1.5 text-ink">
        <div className="relative">
          <button type="button" onClick={() => { setLangOpen((v) => !v); setMeOpen(false); }} className="flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-[13px] font-semibold text-ink hover:bg-gray-bg" aria-label={tr("언어 선택", "Language")}>
            <Icon name="globe" className="h-[18px] w-[18px]" />
            {lang === "en" ? "EN" : "KO"}
          </button>
          {langOpen && <button type="button" aria-label={tr("닫기", "Close")} className="fixed inset-0 z-20 cursor-default" onClick={() => setLangOpen(false)} />}
          {langOpen && (
            <div className="absolute right-0 top-11 z-30 w-32 overflow-hidden rounded-xl bg-white py-1 text-ink shadow-lg ring-1 ring-line">
              {([["en", "English"], ["ko", "한국어"]] as const).map(([l, label]) => (
                <button key={l} type="button" onClick={() => void changeLang(l)} className={`block w-full px-3 py-2 text-left text-[14px] ${lang === l ? "font-semibold text-navy" : ""}`}>{label}{lang === l ? " ✓" : ""}</button>
              ))}
            </div>
          )}
        </div>
        <CartButton />
        {user && (
          <button type="button" onClick={openNotis} className="relative flex h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-gray-bg" aria-label={tr(`알림${unread ? ` ${unread}개` : ""}`, `Notifications${unread ? `, ${unread} new` : ""}`)}>
            <Icon name="bell" className="h-[21px] w-[21px]" />
            {unread > 0 && <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange px-1 text-[10px] font-bold leading-none text-white">{unread}</span>}
          </button>
        )}
        {user ? (
          <div className="relative">
            <button type="button" onClick={() => { setMeOpen((v) => !v); setLangOpen(false); }} aria-haspopup="menu" aria-expanded={meOpen} aria-label={tr("내 정보", "My account")} className="flex h-9 w-9 items-center justify-center rounded-full">
              <PersonArt name={user.name} className="h-9 w-9" />
            </button>
            {meOpen && <button type="button" aria-label={tr("닫기", "Close")} className="fixed inset-0 z-20 cursor-default" onClick={() => setMeOpen(false)} />}
            {meOpen && (
              <div role="menu" className="absolute right-0 top-11 z-30 w-56 overflow-hidden rounded-xl bg-white text-ink shadow-lg ring-1 ring-line">
                <div className="border-b border-line px-4 py-3">
                  <div className="truncate text-[15px] font-bold">{user.name}</div>
                  <div className="truncate text-[12.5px] text-muted">{user.email}</div>
                </div>
                <Link role="menuitem" href={meHref} onClick={() => setMeOpen(false)} className="flex items-center gap-2.5 px-4 py-3 text-[14.5px] hover:bg-gray-bg">
                  <Icon name="user" className="h-[18px] w-[18px]" />{tr("내 프로필", "My profile")}
                </Link>
                <button role="menuitem" type="button" onClick={logout} className="flex w-full items-center gap-2.5 border-t border-line px-4 py-3 text-left text-[14.5px] font-semibold text-red hover:bg-gray-bg">
                  {tr("로그아웃", "Log out")}
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link href={meHref} aria-label={tr("로그인", "Log in")} className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-bg text-navy">
            <Icon name="user" className="h-[18px] w-[18px]" />
          </Link>
        )}
      </div>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={tr("알림", "Notifications")}>
        {!user && <p className="py-6 text-center text-[14px] text-muted">{tr("로그인하면 예약 알림을 볼 수 있어요.", "Log in to see booking notifications.")}</p>}
        {user && !notis && <p className="py-6 text-center text-[14px] text-muted">{tr("불러오는 중…", "Loading…")}</p>}
        {user && notis?.length === 0 && <p className="py-6 text-center text-[14px] text-muted">{tr("알림이 없어요.", "No notifications.")}</p>}
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
