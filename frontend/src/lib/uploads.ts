// v3.6 사진 올리기 — POST /uploads (multipart) → {url: "/media/…"}. 활동 기록·식비 영수증·신고 사진에 쓴다.
// /media/… 는 Next.js 앱이 아니라 백엔드 주소 기준이라 MEDIA_ORIGIN 을 붙여 보여 준다.
// 목업 모드는 서버 없이 URL.createObjectURL(file) 을 돌려준다 (새로고침하면 사라짐).
import { API_URL, ApiError, USE_MOCK, token } from "./api";
import { mockHandlers } from "./mock";

export interface Uploaded { url: string; content_type: string; size: number }

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
/** <input accept> 값. 기종마다 사진 형식이 달라서(갤럭시 고효율=HEIF 등) 사진이면 일단 고르게 하고, 올리기 전에 JPG로 바꾼다 */
export const UPLOAD_ACCEPT = "image/*";
/** 올리기 전 줄이는 기준 — 긴 변 px, JPG 품질 */
const MAX_SIDE = 2000;
const JPEG_QUALITY = 0.85;

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

const isHeif = (f: File) => /hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name);

/** 브라우저가 열 수 있는 사진이면 긴 변 2000px 이하 JPG로 바꾼다. 열 수 없으면 null */
async function toJpeg(file: File): Promise<File | null> {
  if (typeof document === "undefined") return null;
  let src: ImageBitmap | HTMLImageElement;
  let url: string | null = null;
  try {
    src = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    try {
      url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      await img.decode();
      src = img;
    } catch {
      if (url) URL.revokeObjectURL(url);
      return null;
    }
  }
  const w = "naturalWidth" in src ? src.naturalWidth : src.width;
  const h = "naturalHeight" in src ? src.naturalHeight : src.height;
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#fff"; // 투명 PNG도 흰 바탕으로
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  if ("close" in src) src.close();
  if (url) URL.revokeObjectURL(url);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", JPEG_QUALITY));
  if (!blob) return null;
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

/** 올릴 수 있는 형태로 맞춘다: 작은 JPG·PNG·WebP는 그대로, 나머지(큰 사진·HEIF 등)는 JPG로 줄여서 */
export async function preparePhoto(file: File): Promise<File> {
  if (file.size === 0) throw new ApiError(422, "INVALID_PHOTO", "빈 파일이에요");
  const ok = (UPLOAD_TYPES as readonly string[]).includes(file.type);
  if (ok && file.size <= 1.5 * 1024 * 1024) return file;
  const jpg = await toJpeg(file);
  if (jpg) return jpg;
  if (isHeif(file)) {
    // 갤럭시 '고효율 사진' 등 브라우저가 못 여는 HEIF → 변환 라이브러리를 이때만 불러와 JPG로 바꾼 뒤 다시 줄인다
    try {
      const heic2any = (await import("heic2any")).default;
      const out = await heic2any({ blob: file, toType: "image/jpeg", quality: JPEG_QUALITY });
      const blob = Array.isArray(out) ? out[0] : out;
      const converted = new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
      return (await toJpeg(converted)) ?? converted;
    } catch { /* 아래 안내 */ }
  }
  if (isHeif(file)) throw new ApiError(422, "INVALID_PHOTO", "이 사진 형식(HEIF)은 열 수 없어요. 카메라 설정에서 '고효율 사진'을 끄고 다시 찍거나, 화면을 캡처해서 올려 주세요");
  if (ok) return file; // 줄이지 못했지만 원래 형식이 맞으면 그대로 (10MB는 아래에서 확인)
  throw new ApiError(422, "INVALID_PHOTO", "사진 파일만 올릴 수 있어요");
}

/** 사진 한 장 올리기. 실패하면 한국어 메시지를 가진 ApiError */
export async function uploadPhoto(original: File): Promise<Uploaded> {
  const file = await preparePhoto(original);
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
