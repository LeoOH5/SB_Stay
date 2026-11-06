"use client";
// 버디 성향 고르기 (B09 지원 4단계 · 마이페이지) — 성격 · 같이 다니는 스타일 · 도와줄 수 있어요 · 쓰는 말 · 운전 · 한 줄 소개
// 운전 가능은 표시만: 자가용 유상 운송 금지(여객자동차 운수사업법 제81조)라 차량 동행·차비는 받지 않는다
import type { ReactNode } from "react";
import { CheckRow } from "@/components/tourist/v3";
import { Chip } from "@/components/ui";
import { CAN_HELP, PERSONALITY, STYLE, keysOf, label } from "@/lib/codes";
import type { BuddyProfile, CanHelp, Personality, WalkStyle } from "@/lib/types";

export interface ProfileDraft { personality: Personality[]; style: WalkStyle[]; can_help: CanHelp[]; languages: string[]; can_drive: boolean; intro: string }
export const draftOf = (p?: Partial<BuddyProfile> | null): ProfileDraft => ({
  personality: p?.personality ?? [], style: p?.style ?? [], can_help: p?.can_help ?? [], languages: p?.languages?.length ? p.languages : ["ko"],
  can_drive: p?.can_drive ?? false, intro: p?.intro ?? "",
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
      <fieldset className="mt-6">
        <legend className="mb-1.5 text-[14px] font-semibold text-ink">운전</legend>
        <CheckRow checked={value.can_drive} onChange={(v) => set("can_drive", v)}>운전할 수 있어요 (차량 동행은 하지 않아요)</CheckRow>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">프로필에 표시만 돼요. 여행자를 내 차에 태우거나 기름값·주차비를 받으면 안 돼요.</p>
      </fieldset>
      <label className="mt-6 block">
        <span className="mb-2.5 block text-[14px] font-semibold text-ink">한 줄 소개</span>
        <textarea className="min-h-[88px] w-full rounded-[12px] border border-line bg-white px-4 py-3 text-[16px] leading-relaxed text-ink placeholder:text-muted focus:border-navy focus:outline-none"
          value={value.intro} maxLength={200} onChange={(e) => set("intro", e.target.value)} placeholder="여행자에게 나를 한 줄로 소개해 주세요" />
      </label>
    </div>
  );
}
