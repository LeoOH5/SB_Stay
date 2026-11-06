// API 클라이언트. NEXT_PUBLIC_USE_MOCK=true 면 src/lib/mock 데이터로 동작한다 (프론트 선개발).
// 실제 호출 시 경로·응답 형식은 docs/api-detail/*.md 와 같다. 실패 형식: { error: { code, message } }
import { ApiError } from "./errors";
import { mockHandlers } from "./mock";

export { ApiError };

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
export const USE_MOCK = (process.env.NEXT_PUBLIC_USE_MOCK ?? "true") === "true";

const TOKEN_KEY = "sbstay.token";
export const token = {
  get: () => (typeof window === "undefined" ? null : window.localStorage.getItem(TOKEN_KEY)),
  set: (t: string) => window.localStorage.setItem(TOKEN_KEY, t),
  clear: () => window.localStorage.removeItem(TOKEN_KEY),
};

export const lang = {
  get: (): "ko" | "en" => { if (typeof window === "undefined") return "ko"; try { return (JSON.parse(window.localStorage.getItem("sbstay.lang") ?? '"en"') as "ko" | "en"); } catch { return "en"; } },
};

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export async function api<T>(method: Method, path: string, body?: unknown, query?: Record<string, string | number | undefined>): Promise<T> {
  const qs = query ? "?" + Object.entries(query).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&") : "";
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 150)); // 체감용 지연
    return mockHandlers(method, path, body, query) as Promise<T>;
  }
  const headers: Record<string, string> = { "Accept-Language": lang.get() };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const t = token.get();
  if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(`${API_URL}${path}${qs}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!res.ok) {
    let err = { code: "ERROR", message: res.statusText };
    try { err = (await res.json()).error ?? err; } catch { /* ignore */ }
    throw new ApiError(res.status, err.code, err.message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const get = <T,>(path: string, query?: Record<string, string | number | undefined>) => api<T>("GET", path, undefined, query);
export const post = <T,>(path: string, body?: unknown) => api<T>("POST", path, body);
export const patch = <T,>(path: string, body?: unknown) => api<T>("PATCH", path, body);
export const put = <T,>(path: string, body?: unknown) => api<T>("PUT", path, body);
export const del = <T,>(path: string) => api<T>("DELETE", path);

export const won = (n: number) => `₩${n.toLocaleString("ko-KR")}`;
