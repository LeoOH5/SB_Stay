"use client";
// 버디 마이페이지 — 프로필(BD-05 GET·PUT /buddy/profile), 캘린더 연동 상태, 고객센터·약관(CM-01), 로그아웃
import { HeaderActions } from "@/components/tourist/header-actions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Card, Chip, Field, Hero, SectionTitle, Spinner, inputCls } from "@/components/ui";
import { BottomSheet } from "@/components/tourist";
import { get, put } from "@/lib/api";
import { session, useUser } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import type { Buddy, ContentDoc } from "@/lib/types";
import { INTEREST_LABEL, LANG_LABEL, interestsLabel, langsLabel, roleLabel } from "@/components/buddy/format";
import { LoginGate } from "@/components/buddy/login-gate";
import { useToast } from "@/components/buddy/toast";

const DOCS: { key: string; label: string }[] = [
  { key: "support", label: "고객센터 · 긴급연락처" },
  { key: "terms", label: "이용약관" },
  { key: "privacy", label: "개인정보 처리방침" },
];

export default function Page() {
  const { user } = useUser();
  const { lang } = useLang();
  const router = useRouter();
  const { show, toast } = useToast();
  const [profile, setProfile] = useState<Buddy | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Pick<Buddy, "major" | "year" | "languages" | "interests" | "intro"> | null>(null);
  const [saving, setSaving] = useState(false);
  const [docKey, setDocKey] = useState<string | null>(null);
  const [doc, setDoc] = useState<ContentDoc | null>(null);
  const [docErr, setDocErr] = useState<string | null>(null);

  useEffect(() => {
    get<Buddy>("/buddy/profile").then(setProfile).catch(() => setProfile(null));
  }, []);

  const name = user?.name ?? profile?.name ?? "지우";
  const email = user?.email ?? "jiwoo@a-univ.ac.kr";
  const connected = !!user?.calendar_connected;

  const startEdit = () => { if (!profile) return; setDraft({ major: profile.major, year: profile.year, languages: profile.languages, interests: profile.interests, intro: profile.intro }); setEditing(true); };
  const toggleIn = (arr: string[], k: string) => (arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k]);
  const saveProfile = async () => {
    if (!draft || !profile) return;
    setSaving(true);
    try {
      const r = await put<Buddy>("/buddy/profile", { ...draft, avatar: profile.avatar, hourly_fee: profile.hourly_fee, school_email: email });
      setProfile({ ...profile, ...r }); setEditing(false); show("프로필을 저장했어요");
    } catch (e) { show(e instanceof Error ? e.message : "저장에 실패했어요"); }
    finally { setSaving(false); }
  };
  const openDoc = (key: string) => {
    setDocKey(key); setDoc(null); setDocErr(null);
    get<ContentDoc>(`/contents/${key}`, { lang }).then(setDoc).catch((e: unknown) => setDocErr(e instanceof Error ? e.message : "불러오지 못했어요"));
  };
  const logout = () => { session.clear(); show("로그아웃했어요"); router.push("/buddy/login"); };

  return (
    <div className="pb-6">
      <Hero title="마이페이지" sub={`${roleLabel(user?.role)} · ${name}`} right={<HeaderActions />} />
      <LoginGate />

      <div className="px-5">
        <SectionTitle right={profile && !editing && <button type="button" className="text-[13px] font-semibold text-navy" onClick={startEdit}>수정</button>}>프로필</SectionTitle>
        {profile === null ? <Spinner /> : !editing ? (
          <Card>
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-navy-bg text-[16px] font-semibold text-navy">{name.slice(0, 1)}</div>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-ink">{name} · {profile.university} {profile.major} {profile.year}학년</div>
                <div className="mt-0.5 text-[12px] text-muted">{langsLabel(profile.languages)} · {interestsLabel(profile.interests)} · 승인됨</div>
                <div className="mt-0.5 text-[12px] text-green-dark">{email} ✓ 학교 이메일 인증</div>
                {profile.intro && <div className="mt-2 text-[12px] leading-relaxed text-ink/80">{profile.intro}</div>}
              </div>
            </div>
          </Card>
        ) : draft && (
          <Card className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="전공"><input className={inputCls} value={draft.major} onChange={(e) => setDraft({ ...draft, major: e.target.value })} /></Field>
              <Field label="학년"><input className={inputCls} type="number" min={1} max={6} value={draft.year} onChange={(e) => setDraft({ ...draft, year: Number(e.target.value) || 1 })} /></Field>
            </div>
            <div>
              <div className="mb-1.5 text-[12px] text-muted">언어</div>
              <div className="flex flex-wrap gap-2">{Object.entries(LANG_LABEL).map(([k, v]) => <Chip key={k} selected={draft.languages.includes(k)} onClick={() => setDraft({ ...draft, languages: toggleIn(draft.languages, k) })}>{v}</Chip>)}</div>
            </div>
            <div>
              <div className="mb-1.5 text-[12px] text-muted">관심사</div>
              <div className="flex flex-wrap gap-2">{Object.entries(INTEREST_LABEL).map(([k, v]) => <Chip key={k} selected={draft.interests.includes(k)} onClick={() => setDraft({ ...draft, interests: toggleIn(draft.interests, k) })}>{v}</Chip>)}</div>
            </div>
            <Field label="소개"><textarea className={`${inputCls} h-24 py-3`} value={draft.intro} onChange={(e) => setDraft({ ...draft, intro: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Button className="h-11! min-h-11!" onClick={saveProfile} disabled={saving}>{saving ? "저장 중…" : "저장"}</Button>
              <Button variant="ghost" className="h-11! min-h-11!" onClick={() => setEditing(false)} disabled={saving}>취소</Button>
            </div>
          </Card>
        )}


        <SectionTitle>구글 캘린더</SectionTitle>
        <Link href="/buddy/schedule" className="block">
          <Card className="flex items-center justify-between py-3">
            <span className="text-[13px] text-ink">{connected ? "연동됨 · 확정된 동행이 캘린더에 자동으로 들어가요" : "연동 안 됨 · 일정 화면에서 연동할 수 있어요"}</span>
            <span className="text-muted">›</span>
          </Card>
        </Link>

        <SectionTitle>고객센터 · 약관</SectionTitle>
        <div className="space-y-2">
          {DOCS.map((d) => (
            <Card key={d.key} className="flex items-center justify-between py-3" onClick={() => openDoc(d.key)}>
              <span className="text-[13px] text-ink">{d.label}</span><span className="text-muted">›</span>
            </Card>
          ))}
        </div>

        <Button variant="ghost" className="mt-4" onClick={logout}>로그아웃</Button>
      </div>

      <BottomSheet open={docKey !== null} onClose={() => setDocKey(null)} title={doc?.title ?? DOCS.find((d) => d.key === docKey)?.label ?? ""}>
        {docErr && <p className="text-[13px] text-orange">{docErr}</p>}
        {!doc && !docErr && <Spinner />}
        {doc && <div className="whitespace-pre-line text-[14px] leading-relaxed text-ink">{doc.body}</div>}
      </BottomSheet>
      {toast}
    </div>
  );
}
