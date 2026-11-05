"use client";
// 버디 홈 · 새 요청 + 오늘 일정
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Card, Empty, Hero, SectionTitle, Spinner, StatusPill } from "@/components/ui";
import { get, patch, post } from "@/lib/api";
import { useUser } from "@/lib/auth";
import type { Buddy, BuddyRequest, ListResponse } from "@/lib/types";
import { DEMO_TODAY, fmtDate, langsLabel, type BuddyBrief } from "@/components/buddy/format";
import { LoginGate } from "@/components/buddy/login-gate";
import { RequestCard, type DecideAction } from "@/components/buddy/request-card";
import { useToast } from "@/components/buddy/toast";

const MEETING_POINT_FALLBACK = "한성대입구역 5번 출구"; // BD-06 meeting_point — 목 응답에 없어 고정값

export default function Page() {
  const { user } = useUser();
  const { show, toast } = useToast();
  const [profile, setProfile] = useState<Buddy | null>(null);
  const [requests, setRequests] = useState<BuddyRequest[] | null>(null);
  const [schedule, setSchedule] = useState<BuddyRequest[] | null>(null);
  const [briefs, setBriefs] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);

  const reload = useCallback(() => {
    get<ListResponse<BuddyRequest>>("/buddy/requests", { status: "requested" }).then((r) => setRequests(r.items)).catch(() => setRequests([]));
    get<ListResponse<BuddyRequest>>("/buddy/schedule").then((r) => setSchedule(r.items)).catch(() => setSchedule([]));
  }, []);

  useEffect(() => {
    reload();
    get<Buddy>("/buddy/profile").then(setProfile).catch(() => setProfile(null));
  }, [reload]);

  const decide = async (req: BuddyRequest, action: DecideAction, reason?: string) => {
    setBusy(req.item_id);
    try {
      await patch(`/bookings/${req.booking_id}/items/${req.item_id}`, { action, reason });
      show(action === "approve" ? `${req.tourist.name} 요청을 수락했어요` : `${req.tourist.name} 요청을 거절했어요`);
      reload();
    } catch (e) {
      show(e instanceof Error ? e.message : "처리에 실패했어요");
    } finally { setBusy(null); }
  };

  const fetchBrief = async (req: BuddyRequest) => {
    setBusy(req.item_id);
    try {
      const r = await post<BuddyBrief>("/ai/buddy-brief", { item_id: req.item_id, booking_code: req.booking_code });
      setBriefs((b) => ({ ...b, [req.item_id]: r.brief }));
    } catch { show("AI 자료를 불러오지 못했어요"); }
    finally { setBusy(null); }
  };

  const isGuide = user?.role === "guide";
  const name = user?.name ?? profile?.name ?? "지우";
  const sub = isGuide
    ? `해설사 · ${profile ? langsLabel(profile.languages) : ""}`
    : profile ? `${profile.university} ${profile.major} ${profile.year}학년 · ${langsLabel(profile.languages)}` : "A대학교 국어국문 3학년 · 한/영/일";

  const today = schedule?.filter((s) => s.date === DEMO_TODAY) ?? [];
  const upcoming = schedule?.filter((s) => s.date > DEMO_TODAY).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)) ?? [];
  const todayList = today.length ? today : upcoming.slice(0, 1);

  return (
    <div className="pb-6">
      <Hero title={`안녕하세요, ${name} 님`} sub={sub} right={<StatusPill status="approved" label="승인됨" />} />
      <LoginGate />

      <div className="px-5">
        <SectionTitle right={<Link href="/buddy/requests" className="text-[13px] font-semibold text-navy">요청함 →</Link>}>
          새 요청 {requests?.length ?? 0}건
        </SectionTitle>
        {requests === null ? <Spinner /> : requests.length === 0 ? <Card><Empty>새 요청이 없어요</Empty></Card> : (
          <div className="space-y-3">
            {requests.map((req, i) => (
              <RequestCard key={req.item_id} req={req} compact={i > 0} brief={briefs[req.item_id]} onBrief={() => fetchBrief(req)}
                onDecide={(a, reason) => decide(req, a, reason)} busy={busy === req.item_id} />
            ))}
          </div>
        )}

        <SectionTitle>{today.length || !upcoming.length ? "오늘 일정" : "다가오는 일정"}</SectionTitle>
        {schedule === null ? <Spinner /> : todayList.length === 0 ? <Card><Empty>오늘 확정된 일정이 없어요</Empty></Card> : (
          <div className="space-y-3">
            {todayList.map((s) => (
              <Card key={s.item_id} accent="green">
                <div className="flex items-center gap-2">
                  <StatusPill status="confirmed" label="확정" />
                  <span className="text-[14px] font-semibold text-ink">{s.time}  {s.interests.join("·")} {isGuide ? "투어" : "동행"} · {s.tourist.name} ({s.tourist.nationality})</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[12px]">
                  <span className="text-muted">{s.date !== DEMO_TODAY && `${fmtDate(s.date)} · `}{MEETING_POINT_FALLBACK}</span>
                  <button type="button" className="font-semibold text-navy" onClick={() => show("채팅은 준비 중이에요")}>채팅 열기 →</button>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Card className="mt-4 bg-orange-bg ring-0">
          <p className="text-[13px] leading-relaxed text-orange">버디는 가이드가 아니라 문화교류 동행입니다.<br />역사 해설은 해설사·AI가 맡습니다.</p>
        </Card>
      </div>
      {toast}
    </div>
  );
}
