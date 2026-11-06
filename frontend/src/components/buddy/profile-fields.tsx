"use client";
// 버디 성향 고르기 (B09 지원 4단계 · 마이페이지) — 성격 · 같이 다니는 스타일 · 도와줄 수 있어요 · 쓰는 말 · 한 줄 소개
import type { ReactNode } from "react";
import { Chip } from "@/components/ui";
import { CAN_HELP, PERSONALITY, STYLE, keysOf, label } from "@/lib/codes";
import type { BuddyProfile, CanHelp, Personality, WalkStyle } from "@/lib/types";

export interface ProfileDraft { personality: Personality[]; style: WalkStyle[]; can_help: CanHelp[]; languages: string[]; intro: string }
export const draftOf = (p?: Partial<BuddyProfile> | null): ProfileDraft => ({
  personality: p?.personality ?? [], style: p?.style ?? [], can_help: p?.can_help ?? [], languages: p?.languages?.length ? p.languages : ["ko"], intro: p?.intro ?? "",
});
/** 한국어는 기본, 고르는 건 외국어 */
const LANGS: [string, string][] = [["en", "English"], ["ja", "日本語"], ["zh", "中文"]];
const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="mt-6 first:mt-0">
      <legend className="mb-2.5 text-[14px] font-semibold text-ink">{title}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

export function ProfileFields({ value, onChange }: { value: ProfileDraft; onChange: (v: ProfileDraft) => void }) {
  const set = <K extends keyof ProfileDraft>(k: K, v: ProfileDraft[K]) => onChange({ ...value, [k]: v });
  return (
    <div>
      <Group title="성격">
        {keysOf(PERSONALITY).map((k) => <Chip key={k} selected={value.personality.includes(k)} onClick={() => set("personality", toggle(value.personality, k))}>{label(PERSONALITY, k)}</Chip>)}
      </Group>
      <Group title="같이 다니는 스타일">
        {keysOf(STYLE).map((k) => <Chip key={k} selected={value.style.includes(k)} onClick={() => set("style", toggle(value.style, k))}>{label(STYLE, k)}</Chip>)}
      </Group>
      <Group title="도와줄 수 있어요">
        {keysOf(CAN_HELP).map((k) => <Chip key={k} selected={value.can_help.includes(k)} onClick={() => set("can_help", toggle(value.can_help, k))}>{label(CAN_HELP, k)}</Chip>)}
      </Group>
      <Group title="쓰는 말">
        {LANGS.map(([k, l]) => <Chip key={k} selected={value.languages.includes(k)} onClick={() => set("languages", ["ko", ...toggle(value.languages.filter((x) => x !== "ko"), k)])}>{l}</Chip>)}
      </Group>
      <label className="mt-6 block">
        <span className="mb-2.5 block text-[14px] font-semibold text-ink">한 줄 소개</span>
        <textarea className="min-h-[88px] w-full rounded-[12px] border border-line bg-white px-4 py-3 text-[16px] leading-relaxed text-ink placeholder:text-muted focus:border-navy focus:outline-none"
          value={value.intro} maxLength={200} onChange={(e) => set("intro", e.target.value)} placeholder="여행자에게 나를 한 줄로 소개해 주세요" />
      </label>
    </div>
  );
}
