// v3.6 사진 올리기 — POST /uploads (multipart) → {url: "/media/…"}. 활동 기록·식비 영수증·신고 사진에 쓴다.
// /media/… 는 Next.js 앱이 아니라 백엔드 주소 기준이라 MEDIA_ORIGIN 을 붙여 보여 준다.
// 목업 모드는 서버 없이 URL.createObjectURL(file) 을 돌려준다 (새로고침하면 사라짐).
import { API_URL, ApiError, USE_MOCK, token } from "./api";
import { mockHandlers } from "./mock";

export interface Uploaded { url: string; content_type: string; size: number }

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
/** <input accept> 값 */
export const UPLOAD_ACCEPT = UPLOAD_TYPES.join(",");

/** 백엔드 주소 (API_URL 에서 /api/v1 을 뺀 것). API_URL 이 상대 경로면 빈 문자열 = 같은 주소 */
export const MEDIA_ORIGIN = API_URL.replace(/\/api\/v\d+\/?$/, "");

/** 사진 값 → <img src>. 우리가 올린 /media 주소(목업은 blob:)만 진짜 사진, 예전 시드 값(파일 이름)은 null → 자리 표시 타일 */
export function mediaSrc(value?: string | null): string | null {
  if (!value) return null;
  if (value.startsWith("/media/")) return `${MEDIA_ORIGIN}${value}`;
  if (value.startsWith("blob:")) return value;
  return null;
}

/** 올리기 전 화면에서 먼저 거르는 오류 (서버도 매직 바이트로 다시 확인한다) */
export function checkPhoto(file: File): string | null {
  if (!(UPLOAD_TYPES as readonly string[]).includes(file.type)) return "JPG · PNG · WebP 사진만 올릴 수 있어요";
  if (file.size > MAX_UPLOAD_BYTES) return "사진은 10MB까지 올릴 수 있어요";
  if (file.size === 0) return "빈 파일이에요";
  return null;
}

/** 사진 한 장 올리기. 실패하면 한국어 메시지를 가진 ApiError */
export async function uploadPhoto(file: File): Promise<Uploaded> {
  const bad = checkPhoto(file);
  if (bad) throw new ApiError(422, "INVALID_PHOTO", bad);
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 400)); // 체감용 지연
    return mockHandlers("POST", "/uploads", { file }) as Promise<Uploaded>;
  }
  const form = new FormData();
  form.append("file", file);
  const headers: Record<string, string> = {};
  const t = token.get();
  if (t) headers.Authorization = `Bearer ${t}`;
  let res: Response;
  try { res = await fetch(`${API_URL}/uploads`, { method: "POST", headers, body: form }); }
  catch { throw new ApiError(0, "NETWORK", "사진을 올리지 못했어요. 연결을 확인하고 다시 시도해 주세요"); }
  if (!res.ok) {
    let err = { code: "ERROR", message: "사진을 올리지 못했어요" };
    try { err = (await res.json()).error ?? err; } catch { /* ignore */ }
    if (res.status === 401) err.message = "로그인한 뒤 사진을 올릴 수 있어요";
    throw new ApiError(res.status, err.code, err.message);
  }
  return (await res.json()) as Uploaded;
}
