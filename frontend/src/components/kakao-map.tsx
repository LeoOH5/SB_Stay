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

const NAVY = "#1E3A5F";
const GREEN = "#E2722F"; // v3: 강조색은 감 주황 (이름은 B 코드 그대로)
const LABEL_MAX = 14; // 이름표 글자 수 (겹침 방지)

const short = (s: string) => (s.length > LABEL_MAX ? `${s.slice(0, LABEL_MAX - 1)}…` : s);

/**
 * points에 마커를 찍고 route면 순서대로 선을 잇는다.
 * numbered면 번호 마커를 쓰고, 이름표는 active(선택된 점)에만 붙인다. active가 없으면 모든 점에 짧은 이름표.
 * onSelect가 있으면 마커를 눌러 선택할 수 있다.
 */
export function KakaoMap({ points, route = false, numbered = false, active, onSelect, className, h = "h-60" }: {
  points: MapPoint[]; route?: boolean; numbered?: boolean; active?: number; onSelect?: (index: number) => void; className?: string; h?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const selectRef = useRef(onSelect);
  const [failed, setFailed] = useState(!KEY);
  const [ready, setReady] = useState(0); // 지도가 새로 만들어질 때마다 증가
  const sig = JSON.stringify(points);

  useEffect(() => { selectRef.current = onSelect; }, [onSelect]);

  // 1) 지도 생성 + 범위 맞추기 (점 목록이 바뀔 때만)
  useEffect(() => {
    if (!KEY || !el.current || points.length === 0) return;
    let cancelled = false;
    loadKakao().then((kakao) => {
      if (cancelled || !el.current) return;
      const { maps } = kakao;
      const latlngs = points.map((p) => new maps.LatLng(p.lat, p.lng));
      const map = new maps.Map(el.current, { center: latlngs[0], level: 4 });
      map.addControl(new maps.ZoomControl(), maps.ControlPosition.RIGHT);
      if (latlngs.length > 1) {
        const bounds = new maps.LatLngBounds();
        latlngs.forEach((ll: any) => bounds.extend(ll));
        map.setBounds(bounds, 36, 28, 28, 28); // 위·오른쪽·아래·왼쪽 여백 (이름표 공간)
        // 한 단계 더 확대해도 모든 점이 화면 안이면 확대 (코스가 작게 보이지 않게)
        const lvl = map.getLevel();
        if (lvl > 2) {
          map.setLevel(lvl - 1);
          const view = map.getBounds();
          if (!latlngs.every((ll: any) => view.contain(ll))) map.setLevel(lvl);
        }
      }
      if (route && latlngs.length > 1) {
        new maps.Polyline({ map, path: latlngs, strokeWeight: 4, strokeColor: GREEN, strokeOpacity: 0.9, strokeStyle: "solid" });
      }
      mapRef.current = map;
      setReady((n) => n + 1);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, route]);

  // 2) 마커·이름표 (선택이 바뀔 때마다 다시 그림, 지도는 유지)
  useEffect(() => {
    const map = mapRef.current;
    const maps = window.kakao?.maps;
    if (!map || !maps) return;
    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = points.map((p, i) => {
      const isActive = active === i;
      const showLabel = !!p.label && (active === undefined || isActive);
      const wrap = document.createElement("div");
      const size = isActive ? 28 : 22;
      // xAnchor 0 + 왼쪽으로 반 칸 이동 → 점의 중심이 정확히 좌표 위
      wrap.style.cssText = `display:flex;align-items:center;gap:4px;margin-left:-${size / 2}px;font:600 12px/1 Pretendard,system-ui,sans-serif;cursor:pointer;`;
      const dot = document.createElement("span");
      dot.textContent = numbered ? String(i + 1) : "";
      dot.style.cssText = `display:inline-flex;align-items:center;justify-content:center;min-width:${size}px;height:${size}px;padding:0 5px;border-radius:999px;background:${isActive ? GREEN : NAVY};color:${isActive ? NAVY : "#fff"};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3);`;
      wrap.appendChild(dot);
      if (showLabel) {
        const tag = document.createElement("span");
        tag.textContent = short(p.label!);
        tag.title = p.label!;
        tag.style.cssText = `padding:4px 7px;border-radius:8px;background:#fff;color:${NAVY};box-shadow:0 1px 4px rgba(0,0,0,.2);white-space:nowrap;`;
        wrap.appendChild(tag);
      }
      wrap.addEventListener("click", () => selectRef.current?.(i));
      return new maps.CustomOverlay({ map, position: new maps.LatLng(p.lat, p.lng), content: wrap, xAnchor: 0, yAnchor: 0.5, zIndex: isActive ? 10 : 1 });
    });
    // 선택된 점이 화면 밖이면 가운데로
    if (active !== undefined && points[active]) {
      const ll = new maps.LatLng(points[active].lat, points[active].lng);
      if (!map.getBounds().contain(ll)) map.panTo(ll);
    }
    return () => { overlaysRef.current.forEach((o) => o.setMap(null)); overlaysRef.current = []; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, active, numbered, sig]);

  if (points.length === 0) return null;
  if (failed) return <MapEmbed points={points} className={className} h={h} />;
  return <div ref={el} className={`overflow-hidden rounded-[14px] ring-1 ring-line/60 ${h} ${className ?? ""}`} />;
}
