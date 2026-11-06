"use client";
// 버디 마이페이지 — BD-05 GET·PUT /buddy/profile (전공·학년·성격·스타일·도와줄 수 있는 것·쓰는 말·소개), CM-01 GET /contents/{key}, 로그아웃
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/tourist";
import { LoginGate } from "@/components/buddy/login-gate";
import { ProfileFields, draftOf, type ProfileDraft } from "@/components/buddy/profile-fields";
import { useToast } from "@/components/buddy/toast";
import { Avatar } from "@/components/buddy/ui";
import { Button, Hero, Icon, Spinner, cn, inputCls } from "@/components/ui";
import { get, put } from "@/lib/api";
import { session, useUser } from "@/lib/auth";
import type { BuddyProfile, ContentDoc } from "@/lib/types";

const DOCS: { key: string; label: string }[] = [
  { key: "support", label: "고객센터와 긴급 연락처" },
  { key: "terms", label: "이용약관" },
  { key: "privacy", label: "개인정보 처리방침" },
];
const PRIVACY: ContentDoc = { key: "privacy", language: "ko", title: "개인정보 처리방침", body: "버디에게는 여행자의 이름·국적·인원과 내 동행의 요청 사항만 보여요. 여권번호와 연락처는 보이지 않아요. 여행자 정보를 앱 밖에 올리거나 나누면 안 돼요." };
const STATUS_TEXT: Record<string, string> = { approved: "활동 중", pending: "승인 대기", suspended: "활동 멈춤" };

export default function Page() {
  const { user } = useUser();
  const router = useRouter();
  const { show, toast } = useToast();
  const [profile, setProfile] = useState<BuddyProfile | null>(null);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [basic, setBasic] = useState({ major: "", year: 1 });
  const [saving, setSaving] = useState(false);
  const [docKey, setDocKey] = useState<string | null>(null);
  const [doc, setDoc] = useState<ContentDoc | null>(null);
  const [docErr, setDocErr] = useState<string | null>(null);

  useEffect(() => {
    get<BuddyProfile>("/buddy/profile").then((p) => { setProfile(p); setDraft(draftOf(p)); setBasic({ major: p.major, year: p.year }); }).catch(() => setProfile(null));
  }, []);

  const dirty = !!profile && !!draft && (JSON.stringify(draftOf(profile)) !== JSON.stringify(draft) || basic.major !== profile.major || basic.year !== profile.year);
  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const p = await put<BuddyProfile>("/buddy/profile", { ...draft, intro: draft.intro.trim(), major: basic.major.trim(), year: basic.year });
      setProfile(p); setDraft(draftOf(p)); show("프로필을 저장했어요");
    } catch (e) { show(e instanceof Error ? e.message : "저장하지 못했어요"); }
    finally { setSaving(false); }
  };
  const openDoc = (key: string) => {
    setDocKey(key); setDoc(null); setDocErr(null);
    get<ContentDoc>(`/contents/${key}`, { lang: "ko" }).then(setDoc).catch((e: unknown) => { if (key === "privacy") setDoc(PRIVACY); else setDocErr(e instanceof Error ? e.message : "불러오지 못했어요"); });
  };
  const logout = () => { session.clear(); router.push("/buddy/login"); };

  const name = user?.name ?? profile?.name ?? "";
  return (
    <div className="pb-8">
      <Hero back="/buddy/activity" backLabel="내 활동" title="내 프로필" sub="여행자가 버디를 고를 때 보고, AI 추천에도 쓰여요." />
      <LoginGate />

      <div className="px-5">
        {!profile || !draft ? <Spinner /> : (
          <>
            <div className="flex items-center gap-4">
              <Avatar name={name || profile.name} large />
              <div className="min-w-0">
                <div className="text-[18px] font-bold text-ink">{name || profile.name}</div>
                <div className="mt-0.5 text-[14px] text-muted">{profile.university} · {STATUS_TEXT[profile.status ?? "approved"] ?? "활동 중"}</div>
                {(profile.school_email ?? user?.email) && <div className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-navy"><Icon name="check" className="h-4 w-4" strokeWidth={2.4} />{profile.school_email ?? user?.email} 학교 인증</div>}
              </div>
            </div>

            <div className="mt-8 grid grid-cols-[1fr_96px] gap-3">
              <label className="block">
                <span className="mb-2 block text-[14px] font-semibold text-ink">전공</span>
                <input className={cn(inputCls, "text-[16px]")} value={basic.major} maxLength={40} onChange={(e) => setBasic((b) => ({ ...b, major: e.target.value }))} />
              </label>
              <label className="block">
                <span className="mb-2 block text-[14px] font-semibold text-ink">학년</span>
                <select className={cn(inputCls, "text-[16px]")} value={basic.year} onChange={(e) => setBasic((b) => ({ ...b, year: Number(e.target.value) }))}>
                  {[1, 2, 3, 4, 5, 6].map((y) => <option key={y} value={y}>{y}학년</option>)}
                </select>
              </label>
            </div>

            <div className="mt-6"><ProfileFields value={draft} onChange={setDraft} /></div>
            <Button className="mt-6" onClick={save} disabled={saving || !dirty || !draft.intro.trim()}>{saving ? "저장하는 중…" : dirty ? "프로필 저장" : "저장됨"}</Button>
          </>
        )}

        <h2 className="mb-1 mt-10 text-[18px] font-bold text-ink">정산과 도움말</h2>
        <div className="divide-y divide-line">
          <Link href="/buddy/settlement" className="flex items-center justify-between py-4 text-[16px] text-ink">
            <span>정산 계좌와 내역</span>
            <span className="flex items-center gap-2 text-[14px] text-muted">{profile?.bank_account ?? ""}<Icon name="chevron-right" className="h-5 w-5 text-ink" /></span>
          </Link>
          {DOCS.map((d) => (
            <button key={d.key} type="button" onClick={() => openDoc(d.key)} className="flex w-full items-center justify-between py-4 text-left text-[16px] text-ink">
              {d.label}<Icon name="chevron-right" className="h-5 w-5" />
            </button>
          ))}
        </div>
        <button type="button" onClick={logout} className="mt-2 py-3 text-[15px] text-muted">로그아웃</button>
      </div>

      <BottomSheet open={docKey !== null} onClose={() => setDocKey(null)} title={doc?.title ?? DOCS.find((d) => d.key === docKey)?.label ?? ""}>
        {docErr && <p className="text-[14px] text-orange-ink">{docErr}</p>}
        {!doc && !docErr && <Spinner />}
        {doc && <div className="whitespace-pre-line text-[15px] leading-relaxed text-ink">{doc.body}</div>}
      </BottomSheet>
      {toast}
    </div>
  );
}
