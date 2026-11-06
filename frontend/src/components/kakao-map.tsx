"use client";
// 카카오맵 (JavaScript 키: NEXT_PUBLIC_KAKAO_MAP_KEY). 키가 없거나 불러오지 못하면 OpenStreetMap으로 대신 보여준다.
import { useEffect, useRef, useState } from "react";
import { MapEmbed } from "@/components/ui";

export interface MapPoint { lat: number; lng: number; label?: string }

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global { interface Window { kakao?: any } }

const KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ?? "";
let loader: Promise<any> | null = null;

/** SDK를 한 번만 불러온다 (autoload=false 후 kakao.maps.load) */
function loadKakao(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  if (window.kakao?.maps?.LatLng) return Promise.resolve(window.kakao);
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(KEY)}&autoload=false`;
    s.async = true;
    s.onload = () => {
      if (!window.kakao?.maps) { loader = null; reject(new Error("kakao maps unavailable")); return; }
      window.kakao.maps.load(() => resolve(window.kakao));
    };
    s.onerror = () => { loader = null; reject(new Error("kakao sdk load failed")); };
    document.head.appendChild(s);
  });
  return loader;
}

const NAVY = "#1f2a44";
const GREEN = "#b5bd00";

/** points에 번호 마커를 찍고, route면 순서대로 선을 잇는다 */
export function KakaoMap({ points, route = false, numbered = false, className, h = "h-52" }: { points: MapPoint[]; route?: boolean; numbered?: boolean; className?: string; h?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(!KEY);
  const sig = JSON.stringify(points);

  useEffect(() => {
    if (!KEY || !el.current || points.length === 0) return;
    let cancelled = false;
    const overlays: any[] = [];
    loadKakao().then((kakao) => {
      if (cancelled || !el.current) return;
      const { maps } = kakao;
      const latlngs = points.map((p) => new maps.LatLng(p.lat, p.lng));
      const map = new maps.Map(el.current, { center: latlngs[0], level: 5 });
      map.setZoomable(true);

      points.forEach((p, i) => {
        const content = document.createElement("div");
        content.style.cssText = `display:flex;align-items:center;gap:4px;transform:translateY(-4px);font:600 12px/1 Pretendard,system-ui,sans-serif;`;
        const dot = document.createElement("span");
        dot.textContent = numbered ? String(i + 1) : "";
        dot.style.cssText = `display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:24px;padding:0 6px;border-radius:999px;background:${NAVY};color:#fff;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3);`;
        content.appendChild(dot);
        if (p.label) {
          const tag = document.createElement("span");
          tag.textContent = p.label;
          tag.style.cssText = `padding:4px 7px;border-radius:8px;background:#fff;color:${NAVY};box-shadow:0 1px 4px rgba(0,0,0,.2);white-space:nowrap;`;
          content.appendChild(tag);
        }
        overlays.push(new maps.CustomOverlay({ map, position: latlngs[i], content, xAnchor: 0.1, yAnchor: 1 }));
      });

      if (route && latlngs.length > 1) {
        overlays.push(new maps.Polyline({ map, path: latlngs, strokeWeight: 4, strokeColor: GREEN, strokeOpacity: 0.9, strokeStyle: "solid" }));
      }

      if (latlngs.length > 1) {
        const bounds = new maps.LatLngBounds();
        latlngs.forEach((ll: any) => bounds.extend(ll));
        map.setBounds(bounds, 40, 40, 40, 40);
      }
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; overlays.forEach((o) => o.setMap(null)); };
    // sig로 점 목록 변화만 감지
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, route, numbered]);

  if (points.length === 0) return null;
  if (failed) return <MapEmbed points={points} className={className} h={h} />;
  return <div ref={el} className={`overflow-hidden rounded-[14px] ring-1 ring-line/60 ${h} ${className ?? ""}`} />;
}
