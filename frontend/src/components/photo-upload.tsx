"use client";
// v3.6 사진 올리기 공용 — 고른 파일을 바로 POST /uploads 로 올리고, 올라가는 동안 미리보기 위에 도는 표시, 실패는 한국어로.
// 쓰는 곳: 버디 활동 기록(B12, 여러 장) · 식비 영수증(B11, 1장) · 신고 사진(T22, 1장)
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon, cn } from "@/components/ui";
import { uploadPhoto } from "@/lib/uploads";

export interface UploadSlot {
  key: string;
  name: string;
  /** 이 기기에서 바로 보이는 미리보기 (object URL) */
  preview: string;
  /** 올리기가 끝나면 서버가 준 /media 주소 */
  url: string | null;
  error: string | null;
}

let seq = 0;

/** 고른 사진들의 올리기 상태. urls 는 다 올라간 것만 */
export function usePhotoUploads(max = 20) {
  const [slots, setSlots] = useState<UploadSlot[]>([]);
  /** 고른 파일·미리보기 (다시 올리기와 미리보기 정리용, 그리기에는 쓰지 않음) */
  const picked = useRef(new Map<string, { file: File; preview: string }>());
  useEffect(() => { const m = picked.current; return () => { for (const v of m.values()) URL.revokeObjectURL(v.preview); }; }, []);

  const update = (key: string, patch: Partial<UploadSlot>) => setSlots((all) => all.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const start = useCallback((key: string) => {
    const f = picked.current.get(key)?.file;
    if (!f) return;
    update(key, { error: null, url: null });
    uploadPhoto(f).then((r) => update(key, { url: r.url })).catch((e: unknown) => update(key, { error: e instanceof Error ? e.message : "사진을 올리지 못했어요" }));
  }, []);

  const add = useCallback((files: File[]) => {
    const room = Math.max(0, max - picked.current.size);
    const fresh = files.slice(0, room).map((file) => {
      const key = `p${++seq}`, preview = URL.createObjectURL(file);
      picked.current.set(key, { file, preview });
      return { key, name: file.name, preview, url: null, error: null } satisfies UploadSlot;
    });
    if (!fresh.length) return;
    setSlots((all) => [...all, ...fresh]);
    for (const s of fresh) start(s.key);
  }, [max, start]);

  const retry = useCallback((key: string) => start(key), [start]);
  const drop = (key: string) => { const v = picked.current.get(key); if (v) URL.revokeObjectURL(v.preview); picked.current.delete(key); };
  const remove = useCallback((key: string) => { drop(key); setSlots((all) => all.filter((s) => s.key !== key)); }, []);
  const clear = useCallback(() => { for (const k of [...picked.current.keys()]) drop(k); setSlots([]); }, []);

  const urls = slots.flatMap((s) => (s.url ? [s.url] : []));
  const uploading = slots.some((s) => !s.url && !s.error);
  const error = slots.find((s) => s.error)?.error ?? null;
  return { slots, urls, uploading, error, add, retry, remove, clear, full: slots.length >= max };
}

/** 미리보기 한 칸 — 올리는 중이면 도는 표시, 실패면 '다시', 오른쪽 위 빼기 */
export function UploadThumb({ slot, onRemove, onRetry, className }: { slot: UploadSlot; onRemove: () => void; onRetry: () => void; className?: string }) {
  const busy = !slot.url && !slot.error;
  return (
    <div className={cn("relative overflow-hidden bg-[#3B4652]", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={slot.preview} alt={slot.name} className={cn("h-full w-full object-cover transition", (busy || slot.error) && "opacity-55")} />
      {busy && (
        <span className="absolute inset-0 flex items-center justify-center" role="status" aria-label={`${slot.name} 올리는 중`}>
          <span className="h-6 w-6 animate-spin rounded-full border-[2.5px] border-white/40 border-t-white" />
        </span>
      )}
      {slot.error && (
        <button type="button" onClick={onRetry} title={slot.error} aria-label={`${slot.name} 다시 올리기`}
          className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-red/35 text-[12px] font-semibold text-white">
          <Icon name="warn" className="h-4 w-4" strokeWidth={2.2} />다시
        </button>
      )}
      <button type="button" onClick={onRemove} aria-label={`${slot.name} 빼기`}
        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white"><Icon name="x" className="h-3 w-3" strokeWidth={2.4} /></button>
    </div>
  );
}
