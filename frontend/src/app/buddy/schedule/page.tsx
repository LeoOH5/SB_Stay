"use client";
// B3 일정 관리 · 가능한 날짜 캘린더 + 구글 캘린더 연동
// API: GET/PUT /buddy/availability (BD-04), GET /buddy/schedule (BD-06), GET /buddy/requests?status=requested (BD-05),
//      POST/DELETE /auth/google/calendar (AU-07)
import { googleBody, googleConfigured, requestGoogleCode } from "@/lib/google";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, Empty, Hero, SectionTitle, Spinner, StatusPill } from "@/components/ui";
import { del, get, post, put } from "@/lib/api";
import { session, useUser } from "@/lib/auth";
import type { BuddyRequest, ListResponse } from "@/lib/types";
import { DEMO_TODAY, fmtDate, isProvider, timeRange, type AvailabilityOut, type CalendarOut } from "@/components/buddy/format";
import { LoginGate } from "@/components/buddy/login-gate";
import { MonthCalendar } from "@/components/buddy/month-calendar";
import { useToast } from "@/components/buddy/toast";

export default function Page() {
  const { user } = useUser();
  const { show, toast } = useToast();
  const [ym, setYm] = useState({ year: 2027, month: 1 });
  const [available, setAvailable] = useState<Set<string> | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string>(DEMO_TODAY);
  const [schedule, setSchedule] = useState<BuddyRequest[] | null>(null);
  const [pending, setPending] = useState<BuddyRequest[]>([]);
  const [saving, setSaving] = useState(false);
  const [calBusy, setCalBusy] = useState(false);

  useEffect(() => {
    get<AvailabilityOut>("/buddy/availability").then((r) => { setAvailable(new Set(r.dates)); setSaved(new Set(r.dates)); }).catch(() => setAvailable(new Set()));
    get<ListResponse<BuddyRequest>>("/buddy/schedule").then((r) => setSchedule(r.items)).catch(() => setSchedule([]));
    get<ListResponse<BuddyRequest>>("/buddy/requests", { status: "requested" }).then((r) => setPending(r.items)).catch(() => setPending([]));
  }, []);

  const confirmed = useMemo(() => new Set((schedule ?? []).map((s) => s.date)), [schedule]);
  const dirty = useMemo(() => {
    if (!available) return false;
    if (available.size !== saved.size) return true;
    for (const d of available) if (!saved.has(d)) return true;
    return false;
  }, [available, saved]);

  const tap = (iso: string) => {
    setSelected(iso);
    setAvailable((prev) => { const n = new Set(prev ?? []); if (n.has(iso)) n.delete(iso); else n.add(iso); return n; });
  };
  const move = (d: number) => setYm((p) => { const m = p.month + d; return m < 1 ? { year: p.year - 1, month: 12 } : m > 12 ? { year: p.year + 1, month: 1 } : { year: p.year, month: m }; });

  const save = async () => {
    if (!available) return;
    setSaving(true);
    try {
      const r = await put<AvailabilityOut>("/buddy/availability", { dates: [...available].sort() });
      setAvailable(new Set(r.dates)); setSaved(new Set(r.dates));
      show(`가능한 날짜 ${r.dates.length}일 저장됨`);
    } catch (e) { show(e instanceof Error ? e.message : "저장에 실패했어요"); }
    finally { setSaving(false); }
  };

  const connected = !!user?.calendar_connected;
  const toggleCalendar = async () => {
    if (!user || !isProvider(user.role)) { show("버디 로그인 후 연동할 수 있어요"); return; }
    setCalBusy(true);
    try {
      if (connected) { await del<CalendarOut>("/auth/google/calendar"); session.update({ calendar_connected: false }); show("구글 캘린더 연동을 해제했어요"); }
      else {
        let body: { code: string; redirect_uri?: string } = { code: "mock" };
        if (googleConfigured()) { const code = await requestGoogleCode("calendar", user?.email); if (!code) return; body = googleBody(code); }
        await post<CalendarOut>("/auth/google/calendar", body); session.update({ calendar_connected: true }); show("구글 캘린더에 연동됐어요");
      }
    } catch (e) { show(e instanceof Error ? e.message : "연동에 실패했어요"); }
    finally { setCalBusy(false); }
  };

  const dayItems = [
    ...pending.filter((r) => r.date === selected).map((r) => ({ key: `p${r.item_id}`, text: `${timeRange(r.time, r.duration_min)}  ${r.tourist.name} 동행 (수락 대기)`, status: "requested", label: "수락 대기" })),
    ...(schedule ?? []).filter((r) => r.date === selected).map((r) => ({ key: `c${r.item_id}`, text: `${r.time}  ${r.interests.join("·")} · ${r.tourist.name}`, status: "confirmed", label: "확정" })),
  ].sort((a, b) => a.text.localeCompare(b.text));

  return (
    <div className="pb-6">
      <Hero title="일정 관리" sub={`${ym.year}년 ${ym.month}월 · 날짜를 눌러 가능/불가를 바꿔요`} />
      <LoginGate />

      <div className="px-5">
        <Card className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[14px] font-semibold text-ink">구글 캘린더 연동</div>
              <div className="mt-0.5 text-[12px] text-muted">확정된 동행 일정이 내 구글 캘린더에 자동으로 들어갑니다(단방향).</div>
            </div>
            <button type="button" role="switch" aria-checked={connected} aria-label="구글 캘린더 연동" onClick={toggleCalendar} disabled={calBusy}
              className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-40 ${connected ? "bg-green-dark" : "bg-line"}`}>
              <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${connected ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>
          <div className={`mt-2 text-[12px] font-semibold ${connected ? "text-green-dark" : "text-muted"}`}>{connected ? "연동됨 ✓ · 수락 시 이벤트가 생성돼요" : "연동 안 됨"}</div>
        </Card>

        <div className="mt-4">
          {available === null ? <Spinner /> : (
            <MonthCalendar year={ym.year} month={ym.month} available={available} confirmed={confirmed} selected={selected} onPrev={() => move(-1)} onNext={() => move(1)} onTap={tap} />
          )}
        </div>

        <div className="mt-3 flex items-center gap-4 text-[12px] text-muted">
          <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded bg-green-bg" />가능</span>
          <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded border border-line bg-white" />불가</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-navy" />확정 일정</span>
        </div>

        <SectionTitle>{fmtDate(selected)} 일정</SectionTitle>
        {schedule === null ? <Spinner /> : dayItems.length === 0 ? <Card><Empty>이 날짜에는 일정이 없어요</Empty></Card> : (
          <div className="space-y-2">
            {dayItems.map((it) => (
              <Card key={it.key} className="flex items-center justify-between gap-3 py-3">
                <span className="text-[14px] text-ink">{it.text}</span>
                <StatusPill status={it.status} label={it.label} />
              </Card>
            ))}
          </div>
        )}

        <Button className="mt-5" onClick={save} disabled={saving || !available}>{saving ? "저장 중…" : dirty ? "가능한 날짜 저장" : "가능한 날짜 저장 ✓"}</Button>
      </div>
      {toast}
    </div>
  );
}
