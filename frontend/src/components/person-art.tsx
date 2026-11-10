// 프로필 사진 자리 — 사진을 올리기 전까지 이름으로 정해지는 일러스트 얼굴 (같은 이름이면 늘 같은 그림)
// 실제 사진(photo_url)이 생기면 그 사진을 동그랗게 보여 준다.
import { cn } from "@/components/ui";

const BG = ["#E7EDF5", "#FDF0E7", "#E8F3EC", "#F1ECF7", "#FBF3D9", "#E5F1F6"];
const SKIN = ["#F6D7C3", "#EFC7A8", "#E2B08C", "#F3CFB3"];
const HAIR = ["#2B2B33", "#4A3426", "#1E2433", "#6B4A2E", "#3A2E2A"];
const SHIRT = ["#1E3A5F", "#E2722F", "#3D7A55", "#6C5A9C", "#C98A1B", "#2F6E8C"];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

export function PersonArt({ name, photo, className }: { name: string; photo?: string | null; className?: string }) {
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt="" className={cn("shrink-0 rounded-full object-cover", className)} />;
  }
  const h = hash(name || "?");
  const pick = <T,>(xs: T[], k: number) => xs[Math.floor(h / k) % xs.length];
  const bg = pick(BG, 1), skin = pick(SKIN, 7), hair = pick(HAIR, 13), shirt = pick(SHIRT, 29);
  const style = Math.floor(h / 97) % 4; // 0 짧은 머리 · 1 단발 · 2 긴 머리 · 3 묶은 머리
  return (
    <svg viewBox="0 0 64 64" className={cn("shrink-0 rounded-full", className)} aria-hidden>
      <circle cx="32" cy="32" r="32" fill={bg} />
      {style === 2 && <path d="M17 30c0-10 6.5-17 15-17s15 7 15 17v20H17V30Z" fill={hair} />}
      <path d="M10 64c1.5-11 10-17 22-17s20.5 6 22 17Z" fill={shirt} />
      <rect x="27.5" y="38" width="9" height="9" rx="4" fill={skin} />
      <ellipse cx="32" cy="30" rx="11" ry="12.5" fill={skin} />
      {style === 0 && <path d="M20.5 28c-.5-9 5-14.5 11.5-14.5S44 18 43.5 28c-2-5.5-6.5-7.5-11.5-7.5S22.5 22.5 20.5 28Z" fill={hair} />}
      {style === 1 && <path d="M20 33c-1.5-12 4.5-19.5 12-19.5S45.5 21 44 33l-2.5-1c0-6-3.5-10-9.5-10.5-6 .5-9.5 4.5-9.5 10.5Z" fill={hair} />}
      {style === 2 && <path d="M21 28c0-8 5-13.5 11-13.5S43 20 43 28c-3-4.5-7-6.5-11-6.5S24 23.5 21 28Z" fill={hair} />}
      {style === 3 && <><circle cx="32" cy="13" r="5" fill={hair} /><path d="M20.5 29c-.5-9 5-14 11.5-14S44 20 43.5 29c-2.5-5-6.5-7.5-11.5-7.5S23 24 20.5 29Z" fill={hair} /></>}
      <circle cx="27.8" cy="31" r="1.4" fill="#2B2B33" />
      <circle cx="36.2" cy="31" r="1.4" fill="#2B2B33" />
      <path d="M28.8 36.2c1.9 1.7 4.5 1.7 6.4 0" stroke="#B5654A" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <circle cx="25.5" cy="34.5" r="1.8" fill="#F08A8A" opacity=".35" />
      <circle cx="38.5" cy="34.5" r="1.8" fill="#F08A8A" opacity=".35" />
    </svg>
  );
}
