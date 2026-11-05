"use client";
// Google Identity Services 래퍼.
// - 로그인: One Tap/버튼 대신 '토큰 클라이언트'로 id_token을 받지 않고, code client(popup)로 authorization code를 받아 백엔드에 넘긴다.
//   백엔드가 code → 프로필 교환 (redirect_uri = "postmessage").
// - 캘린더: 같은 code client에 calendar.events 범위 + access_type=offline, prompt=consent (refresh token 확보).
// NEXT_PUBLIC_GOOGLE_CLIENT_ID 가 없으면 USE_MOCK 여부와 관계없이 목업 코드로 동작한다.

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
export const googleConfigured = () => GOOGLE_CLIENT_ID.length > 0;

type CodeResponse = { code?: string; error?: string; error_description?: string };
type CodeClient = { requestCode: () => void };
type GoogleAccounts = {
  accounts: { oauth2: { initCodeClient: (cfg: { client_id: string; scope: string; ux_mode: "popup"; access_type?: "offline"; prompt?: string; callback: (r: CodeResponse) => void; error_callback?: (e: { type: string }) => void }) => CodeClient } };
};
declare global { interface Window { google?: GoogleAccounts } }

let loading: Promise<void> | null = null;
export function loadGis(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true; s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => { loading = null; reject(new Error("Google 스크립트를 불러오지 못했어요")); };
      document.head.appendChild(s);
    });
  }
  return loading;
}

const LOGIN_SCOPE = "openid email profile";
const CALENDAR_SCOPE = "openid email https://www.googleapis.com/auth/calendar.events";

/** 팝업으로 authorization code를 받는다. 취소하면 null. */
export async function requestGoogleCode(kind: "login" | "calendar"): Promise<string | null> {
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initCodeClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: kind === "calendar" ? CALENDAR_SCOPE : LOGIN_SCOPE,
      ux_mode: "popup",
      access_type: "offline",
      prompt: kind === "calendar" ? "consent" : "select_account",
      callback: (r) => { if (r.code) resolve(r.code); else if (r.error === "access_denied") resolve(null); else reject(new Error(r.error_description ?? r.error ?? "구글 인증 실패")); },
      error_callback: (e) => { if (e.type === "popup_closed") resolve(null); else reject(new Error(`구글 팝업 오류: ${e.type}`)); },
    });
    client.requestCode();
  });
}

/** 백엔드에 보낼 본문. 팝업 code flow는 redirect_uri가 "postmessage". */
export const googleBody = (code: string) => ({ code, redirect_uri: "postmessage" });
