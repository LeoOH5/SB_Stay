"use client";
// 작은 토스트 — 저장 완료 등 짧은 안내용
import { useCallback, useEffect, useState } from "react";

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2200);
    return () => clearTimeout(t);
  }, [msg]);
  const show = useCallback((m: string) => setMsg(m), []);
  const toast = msg ? <Toast msg={msg} /> : null;
  return { show, toast };
}

export function Toast({ msg }: { msg: string }) {
  return (
    <div role="status" className="pointer-events-none fixed bottom-24 left-1/2 z-30 -translate-x-1/2 rounded-full bg-navy px-4 py-2 text-[13px] font-medium text-white shadow-[0_4px_12px_rgba(31,42,68,0.25)]">
      {msg}
    </div>
  );
}
