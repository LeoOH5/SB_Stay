"use client";
// B04 일정 — BD-04 GET/PUT /buddy/availability, GET /buddy/schedule, GET /buddy/requests?status=requested, AU-07 구글 캘린더
import { useEffect, useMemo, useState } from "react";
import { DEMO_TODAY, isProvider, krDateDow, timeSpan, wa, type AvailabilityOut, type CalendarOut } from "@/components/buddy/format";
import { LoginGate } from "@/components/buddy/login-gate";
import { MonthCalendar } from "@/components/buddy/month-calendar";
import { useToast } from "@/components/buddy/toast";
import { Toggle } from "@/components/buddy/ui";
import { Button, Hero, Spinner, StatusPill } from "@/components/ui";
import { del, get, post, put } from "@/lib/api";
import { session, useUser } from "@/lib/auth";
import { googleBody, googleConfigured, requestGoogleCode } from "@/lib/google";
import type { BuddyRequest, ListResponse } from "@/lib/types";

export default function Page() {
  const { user } = useUser();
  const { show, toast } = useToast();
  const [ym, setYm] = useState({ year: Number(DEMO_TODAY.slice(0, 4)), month: Number(DEMO_TODAY.slice(5, 7)) });
  const [available, setAvailable] = useState<Set<string> | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string>("2027-01-13");
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
  const dirty = useMemo(() => !!available && (available.size !== saved.size || [...available].some((d) => !saved.has(d))), [available, saved]);
  const prefix = `${ym.year}-${String(ym.month).padStart(2, "0")}`;
  const availCount = [...(available ?? [])].filter((d) => d.startsWith(prefix)).length;
  const confCount = [...confirmed].filter((d) => d.startsWith(prefix)).length;

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
      show(`가능한 날짜 ${r.dates.length}일을 저장했어요`);
    } catch (e) { show(e instanceof Error ? e.message : "저장하지 못했어요"); }
    finally { setSaving(false); }
  };

  const connected = !!user?.calendar_connected;
  const toggleCalendar = async () => {
    if (!user || !isProvider(user.role)) { show("버디로 로그인한 뒤 연동할 수 있어요"); return; }
    setCalBusy(true);
    try {
      if (connected) { await del<CalendarOut>("/auth/google/calendar"); session.update({ calendar_connected: false }); show("구글 캘린더 연동을 껐어요"); }
      else {
        let body: { code: string; redirect_uri?: string } = { code: "mock" };
        if (googleConfigured()) { const code = await requestGoogleCode("calendar", user.email); if (!code) return; body = googleBody(code); }
        await post<CalendarOut>("/auth/google/calendar", body); session.update({ calendar_connected: true }); show("구글 캘린더에 연동했어요");
      }
    } catch (e) { show(e instanceof Error ? e.message : "연동하지 못했어요"); }
    finally { setCalBusy(false); }
  };

  const dayItems = [
    ...pending.filter((r) => r.date === selected).map((r) => ({ r, status: "requested", label: "수락 대기" })),
    ...(schedule ?? []).filter((r) => r.date === selected).map((r) => ({ r, status: "confirmed", label: "확정" })),
  ].sort((a, b) => a.r.time.localeCompare(b.r.time));

  return (
    <div className="pb-8">
      <Hero title="일정" sub="날짜를 누르면 가능과 불가능이 바뀌어요." />
      <LoginGate />

      <div className="px-5">
        {available === null ? <Spinner /> : (
          <MonthCalendar year={ym.year} month={ym.month} available={available} confirmed={confirmed} selected={selected} onPrev={() => move(-1)} onNext={() => move(1)} onTap={tap} />
        )}
        <div className="mt-3 flex items-center gap-5 text-[14px] font-semibold">
          <span className="flex items-center gap-1.5 text-navy"><span className="h-1.5 w-1.5 rounded-full bg-navy" />가능 {availCount}일</span>
          <span className="flex items-center gap-1.5 text-ink"><span className="h-1.5 w-1.5 rounded-full bg-ink" />확정 {confCount}일</span>
          {dirty && <span className="ml-auto text-[13px] font-normal text-orange-ink">저장하지 않았어요</span>}
        </div>

        <h2 className="mt-8 text-[18px] font-bold text-ink">{krDateDow(selected)}</h2>
        {schedule === null ? <Spinner /> : dayItems.length === 0 ? (
          <p className="py-4 text-[15px] text-muted">{available?.has(selected) ? "가능한 날이에요. 아직 동행이 없어요." : "이날은 쉬는 날이에요."}</p>
        ) : (
          <div className="mt-1 divide-y divide-line">
            {dayItems.map(({ r, status, label }) => (
              <div key={`${status}${r.item_id}`} className="flex items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <div className="text-[16px] font-semibold text-ink">{r.tourist.name}{wa(r.tourist.name)} 동행</div>
                  <div className="mt-0.5 text-[14px] text-muted">{timeSpan(r.time, r.duration_min)}{r.course_title ? ` · ${r.course_title}` : ""}</div>
                </div>
                <StatusPill status={status} label={label} />
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-4 border-t border-line py-4">
          <div className="min-w-0">
            <div className="text-[16px] text-ink">구글 캘린더 연동</div>
            <div className="mt-0.5 text-[13px] text-muted">확정된 동행이 내 캘린더에 들어가요</div>
          </div>
          <Toggle on={connected} onClick={toggleCalendar} disabled={calBusy} label="구글 캘린더 연동" />
        </div>

        <Button className="mt-3" onClick={save} disabled={saving || !available}>{saving ? "저장하는 중…" : "가능한 날짜 저장"}</Button>
      </div>
      {toast}
    </div>
  );
}
