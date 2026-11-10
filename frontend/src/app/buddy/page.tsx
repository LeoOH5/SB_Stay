"use client";
// B02 버디 홈 — BD-05 GET /buddy/profile, BD-03 GET /buddy/requests?status=requested, GET /buddy/schedule, GET /buddy/activities,
// 수락/거절 PATCH /bookings/{id}/items/{item}, AI-04 POST /ai/buddy-brief(카드 안), 할 일 → 식비 청구 · 활동 기록
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DEMO_TODAY, krDate, langsName } from "@/components/buddy/format";
import { BuddyGuide, useBuddyGuide } from "@/components/buddy/guide";
import { LoginGate } from "@/components/buddy/login-gate";
import { RequestCard, type DecideAction } from "@/components/buddy/request-card";
import { useToast } from "@/components/buddy/toast";
import { usePlaceNames } from "@/components/buddy/ui";
import { HeaderActions } from "@/components/tourist/header-actions";
import { Banner, Brand, Icon, ListRow, Spinner, StatusPill } from "@/components/ui";
import { get, patch } from "@/lib/api";
import { useUser } from "@/lib/auth";
import type { Activity, BuddyProfile, BuddyRequest, ListResponse } from "@/lib/types";

const first = (n: string) => n.split(" ")[0];

export default function Page() {
  const { user } = useUser();
  const { show, toast } = useToast();
  const places = usePlaceNames();
  const [profile, setProfile] = useState<BuddyProfile | null>(null);
  const [requests, setRequests] = useState<BuddyRequest[] | null>(null);
  const [schedule, setSchedule] = useState<BuddyRequest[] | null>(null);
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const guide = useBuddyGuide();

  const reload = useCallback(() => {
    get<ListResponse<BuddyRequest>>("/buddy/requests", { status: "requested" }).then((r) => setRequests(r.items)).catch(() => setRequests([]));
    get<ListResponse<BuddyRequest>>("/buddy/schedule").then((r) => setSchedule(r.items)).catch(() => setSchedule([]));
  }, []);
  useEffect(() => {
    reload();
    get<BuddyProfile>("/buddy/profile").then(setProfile).catch(() => setProfile(null));
    get<ListResponse<Activity>>("/buddy/activities").then((r) => setActivities(r.items)).catch(() => setActivities([]));
  }, [reload]);

  const decide = async (req: BuddyRequest, action: DecideAction, reason?: string) => {
    setBusy(req.item_id);
    try {
      await patch(`/bookings/${req.booking_id}/items/${req.item_id}`, { action, reason });
      show(action === "approve" ? `${first(req.tourist.name)}의 요청을 수락했어요` : `${first(req.tourist.name)}의 요청을 거절했어요`);
      reload();
    } catch (e) { show(e instanceof Error ? e.message : "처리하지 못했어요"); }
    finally { setBusy(null); }
  };

  const name = user?.name ?? profile?.name ?? "";
  const st = profile?.status ?? "approved";
  // 할 일: 지난 동행 중 식비 청구가 남은 것 · 활동 기록이 없는 것
  const done = (schedule ?? []).filter((s) => s.date <= DEMO_TODAY).sort((a, b) => b.date.localeCompare(a.date));
  const mealTodo = done.filter((s) => (s.meal_count ?? 0) > (s.meal_claims ?? 0));
  const logged = new Set((activities ?? []).map((a) => a.item_id));
  const logTodo = done.find((s) => !logged.has(s.item_id));

  return (
    <div className="pb-8">
      <div className="flex h-16 items-center justify-between bg-white px-5 pt-1">
        <Brand badge="버디" href="/buddy" />
        <HeaderActions />
      </div>
      <header className="px-5 pt-1">
        <h1 className="mt-6 text-[28px] font-bold leading-[1.3] text-ink">안녕하세요,<br />{name || "버디"} 님</h1>
        {profile && <StatusPill className="mt-3" status={st} label={st === "approved" ? "활동 중" : st === "suspended" ? "활동 멈춤" : "승인 대기"} />}
        {profile && <p className="mt-2 text-[15px] text-muted">{profile.university} {profile.major} {profile.year}학년, {langsName(profile.languages)}</p>}
        <button type="button" onClick={guide.show} className="mt-4 flex w-full items-center gap-3 rounded-[14px] bg-orange-bg px-4 py-3 text-left">
          <Icon name="info" className="h-5 w-5 shrink-0 text-orange-ink" />
          <span className="flex-1 text-[14.5px] font-semibold text-orange-ink">처음이라면? 버디 활동 4단계 안내</span>
          <Icon name="chevron-right" className="h-5 w-5 shrink-0 text-orange-ink" />
        </button>
      </header>
      <LoginGate className="mx-5 mt-4" />
      {st === "suspended" && <Banner variant="warn" className="mx-5 mt-4">신고가 들어와 운영팀이 확인하고 있어요. 확인이 끝날 때까지 새 요청을 받지 않아요.</Banner>}
      {st === "pending" && <Banner className="mx-5 mt-4">운영팀 승인을 기다리고 있어요. <Link href="/buddy/apply" className="underline underline-offset-2">지원 상태 보기</Link></Banner>}

      <section className="mt-8 px-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[18px] font-bold text-ink">새 요청 {requests?.length ?? 0}건</h2>
          <Link href="/buddy/requests" className="inline-flex items-center gap-0.5 text-[15px] font-semibold text-navy">요청함<Icon name="chevron-right" className="h-4 w-4" strokeWidth={2.4} /></Link>
        </div>
        {requests === null ? <Spinner /> : requests.length === 0 ? (
          <p className="py-4 text-[15px] leading-relaxed text-muted">새 요청이 없어요. <Link href="/buddy/schedule" className="font-semibold text-navy underline underline-offset-2">가능한 날짜</Link>를 열어 두면 요청이 들어와요.</p>
        ) : (
          <div className="space-y-3">
            {requests.slice(0, 3).map((req, i) => (
              <RequestCard key={req.item_id} req={req} placeNames={places} compact={i > 0} busy={busy === req.item_id} onDecide={(a, reason) => decide(req, a, reason)} />
            ))}
            {requests.length > 3 && <Link href="/buddy/requests" className="flex items-center justify-center gap-0.5 py-2 text-[15px] font-semibold text-navy">요청 {requests.length - 3}건 더 보기<Icon name="chevron-right" className="h-4 w-4" strokeWidth={2.4} /></Link>}
          </div>
        )}
      </section>

      <section className="mt-9 px-5">
        <h2 className="text-[18px] font-bold text-ink">할 일</h2>
        {schedule === null ? <Spinner /> : (
          <div className="mt-1 divide-y divide-line">
            {mealTodo.map((s) => (
              <ListRow key={`m${s.item_id}`} href={`/buddy/meals/new?item=${s.item_id}`} icon="receipt" title="식비 영수증 올리기"
                meta={`${krDate(s.date)} ${first(s.tourist.name)} · 식사 ${s.meal_claims ?? 0} / ${s.meal_count}회`} />
            ))}
            <ListRow href={logTodo ? `/buddy/log?item=${logTodo.item_id}` : "/buddy/log"} icon="image" title="활동 기록 남기기"
              meta={logTodo ? `${krDate(logTodo.date)} ${first(logTodo.tourist.name)} · 다녀온 곳과 사진` : "다녀온 곳과 사진"} />
          </div>
        )}
      </section>
      {toast}
      <BuddyGuide open={guide.open} onClose={guide.close} />
    </div>
  );
}
