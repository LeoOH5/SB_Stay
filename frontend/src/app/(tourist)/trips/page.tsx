"use client";
// T16 내 여행 — BK-02 GET /bookings/me?scope=upcoming|past, 코스 장소 수 GET /tours/{id}, 체크인 안내(BK-07), 채팅(BK-09), 취소(BK-05)
// 버디 항목: 식사비 사용(meal_used / meal_deposit)·남은 보증금, 채팅 · 앨범 · 후기 · 버디 바꾸기, 신고(T22)
import Link from "next/link";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { BottomSheet, ErrorBox, LoginRequired, Row } from "@/components/tourist";
import { DEMO_TODAY, errMsg, itemStatusLabel, md, okv } from "@/components/tourist/format";
import type { ChatMessage, CheckinGuide } from "@/components/tourist/types";
import { NotiBell } from "@/components/tourist/trips/noti-bell";
import { Node, TimelineStep, bookingSpan, buddyNameOf, hoursLabel, iga, krDate, krRange, nightsOf, wa } from "@/components/tourist/trips/util";
import { Button, Chip, Hero, Icon, LinkButton, Spinner, StatusPill, cn } from "@/components/ui";
import { get, post, won } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { paymentsEnabled } from "@/lib/toss";
import type { Booking, BookingItem, ListResponse, Tour } from "@/lib/types";

type Tab = "upcoming" | "past";
const okItem = (s: BookingItem["status"]) => s === "approved" || s === "confirmed";
const nodeOf = (s: BookingItem["status"]) => (okItem(s) ? "done" : s === "requested" ? "wait" : "off");
/** 버디 바꾸기 가능: 신청·거절 상태이거나, 확정이지만 아직 날짜 전 */
const canReplace = (it: BookingItem) => it.type === "buddy" && (it.status === "requested" || it.status === "rejected" || (it.status === "confirmed" && (it.date_from ?? "") > DEMO_TODAY));
const linkCls = "text-[15px] font-semibold text-navy";

export default function TripsPage() {
  const { user } = useUser();
  const [tab, setTab] = useState<Tab>("upcoming");
  const [lists, setLists] = useState<Record<Tab, Booking[] | null>>({ upcoming: null, past: null });
  const [courses, setCourses] = useState<Record<number, Tour>>({});
  const [err, setErr] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  // 시트
  const [guideFor, setGuideFor] = useState<Booking | null>(null);
  const [guide, setGuide] = useState<CheckinGuide | null>(null);
  const [chatFor, setChatFor] = useState<BookingItem | null>(null);
  const [chat, setChat] = useState<ChatMessage[] | null>(null);
  const [chatBooking, setChatBooking] = useState<number | null>(null);
  const [translate, setTranslate] = useState(true);
  const [draft, setDraft] = useState("");
  const [sheetErr, setSheetErr] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    for (const scope of ["upcoming", "past"] as const) {
      get<ListResponse<Booking>>("/bookings/me", { scope })
        .then((r) => { if (alive) setLists((p) => ({ ...p, [scope]: r.items })); })
        .catch((e: unknown) => { if (alive) { setErr(errMsg(e)); setLists((p) => ({ ...p, [scope]: [] })); } });
    }
    return () => { alive = false; };
  }, [user, reloadKey]);

  // 버디 항목에 고른 코스 → 장소 수
  const courseIds = [...new Set([...(lists.upcoming ?? []), ...(lists.past ?? [])].flatMap((b) => b.items).map((i) => i.course_id).filter((c): c is number => c != null))].sort().join(",");
  useEffect(() => {
    if (!courseIds) return;
    let alive = true;
    for (const id of courseIds.split(",").map(Number)) {
      okv(get<Tour>(`/tours/${id}`)).then((t) => { if (alive) setCourses((c) => ({ ...c, [id]: t })); }).catch(() => { /* 장소 수는 선택 */ });
    }
    return () => { alive = false; };
  }, [courseIds]);

  const reload = () => { setLists({ upcoming: null, past: null }); setReloadKey((k) => k + 1); };

  const openGuide = (b: Booking) => {
    setGuideFor(b); setGuide(null); setSheetErr(null);
    okv(get<CheckinGuide>(`/bookings/${b.id}/checkin-guide`)).then(setGuide).catch((e: unknown) => setSheetErr(errMsg(e)));
  };
  const openChat = (b: Booking, it: BookingItem) => {
    setChatFor(it); setChatBooking(b.id); setChat(null); setSheetErr(null);
    get<ListResponse<ChatMessage>>(`/bookings/${b.id}/chat`).then((r) => setChat(r.items)).catch((e: unknown) => setSheetErr(errMsg(e)));
  };
  const sendDraft = () => {
    const t = draft.trim();
    if (!t) return;
    setChat((c) => [...(c ?? []), { id: Date.now(), sender: "tourist", text: t, translated_text: t, created_at: new Date().toISOString() }]);
    setDraft("");
  };
  const cancel = async (b: Booking) => {
    if (!window.confirm(`${b.code} 예약을 취소할까요?\n숙박과 버디가 함께 취소돼요.\n환불: 체크인 7일 전 전액 · 3일 전 절반 · 그 뒤에는 안 돼요`)) return;
    setBusy(true); setErr(null);
    try { await post(`/bookings/${b.id}/cancel`, { reason: "일정 변경" }); reload(); }
    catch (e) { setErr(errMsg(e)); }
    finally { setBusy(false); }
  };

  if (!user) {
    return (<><Hero title="내 여행" right={<NotiBell />} /><div className="px-5 pb-6 pt-2"><LoginRequired what="내 여행" /></div></>);
  }

  const shown = lists[tab];
  return (
    <>
      <Hero title="내 여행" right={<NotiBell />}>
        <div className="mt-5 flex gap-2">
          <Chip selected={tab === "upcoming"} onClick={() => setTab("upcoming")}>다가오는 여행{lists.upcoming ? ` ${lists.upcoming.length}` : ""}</Chip>
          <Chip selected={tab === "past"} onClick={() => setTab("past")}>지난 여행{lists.past ? ` ${lists.past.length}` : ""}</Chip>
        </div>
      </Hero>

      <div className="pb-8">
        <ErrorBox message={err} className="mx-5 mb-3" />
        {!shown && <Spinner />}
        {shown?.length === 0 && (
          <div className="px-5 py-10 text-center">
            <p className="text-[15px] text-muted">{tab === "upcoming" ? "다가오는 여행이 없어요." : "지난 여행이 없어요."}</p>
            {tab === "upcoming" && <LinkButton href="/plan" className="mt-5">AI로 여행 설계하기</LinkButton>}
          </div>
        )}
        {shown?.map((b, i) => (
          <Fragment key={b.id}>
            {i > 0 && <div className="my-6 h-2 bg-gray-bg" />}
            {tab === "upcoming"
              ? <UpcomingTrip b={b} courses={courses} busy={busy} onGuide={() => openGuide(b)} onChat={(it) => openChat(b, it)} onCancel={() => cancel(b)} />
              : <PastTrip b={b} />}
          </Fragment>
        ))}
      </div>

      {/* 체크인 안내 */}
      <BottomSheet open={guideFor !== null} onClose={() => setGuideFor(null)} title="체크인 안내">
        <ErrorBox message={sheetErr} />
        {!guide && !sheetErr && <Spinner />}
        {guide && (
          <div>
            <div className="divide-y divide-line">
              <Row label="건물">{guide.building}</Row>
              <Row label="주소">{guide.address}</Row>
              <Row label="체크인 · 체크아웃">{guide.checkin} · {guide.checkout}</Row>
              <Row label="와이파이">{guide.wifi}</Row>
            </div>
            <h4 className="mt-5 text-[15px] font-bold text-ink">들어가는 방법</h4>
            <ol className="mt-2 space-y-1.5 text-[15px] text-ink">{guide.steps.map((s, k) => <li key={k} className="flex gap-2"><span className="font-semibold text-navy">{k + 1}</span>{s}</li>)}</ol>
            <h4 className="mt-5 text-[15px] font-bold text-ink">긴급 연락처</h4>
            <ul className="mt-2 space-y-1 text-[15px] text-ink">{guide.emergency.map((s, k) => <li key={k}>{s}</li>)}</ul>
          </div>
        )}
      </BottomSheet>

      {/* 버디 채팅 */}
      <BottomSheet open={chatFor !== null} onClose={() => setChatFor(null)} title={chatFor ? `${buddyNameOf(chatFor)}${wa(buddyNameOf(chatFor))} 채팅` : "채팅"}>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[13px] text-muted">메시지는 자동으로 번역돼요</span>
          <Chip selected={translate} onClick={() => setTranslate((v) => !v)} className="h-8 px-3 text-[13px]">번역 {translate ? "켜짐" : "꺼짐"}</Chip>
        </div>
        <ErrorBox message={sheetErr} />
        {!chat && !sheetErr && <Spinner />}
        {chat && chatBooking && (
          <div className="space-y-2">
            {chat.map((m) => (
              <div key={m.id} className={cn("max-w-[80%] rounded-[14px] px-3.5 py-2.5 text-[15px]", m.sender === "tourist" ? "ml-auto bg-navy text-white" : "bg-gray-bg text-ink")}>
                <div>{translate ? m.translated_text : m.text}</div>
                {translate && m.translated_text !== m.text && <div className="mt-1 text-[12px] opacity-70">원문: {m.text}</div>}
              </div>
            ))}
            <form className="flex gap-2 pt-2" onSubmit={(e) => { e.preventDefault(); sendDraft(); }}>
              <input className="h-11 flex-1 rounded-[12px] border border-line bg-white px-3.5 text-[15px] text-ink placeholder:text-muted focus:border-navy focus:outline-none" placeholder="메시지 보내기" value={draft} onChange={(e) => setDraft(e.target.value)} />
              <Button type="submit" full={false} className="h-11! min-h-11! px-4 text-[15px]">보내기</Button>
            </form>
          </div>
        )}
      </BottomSheet>
    </>
  );
}

function UpcomingTrip({ b, courses, busy, onGuide, onChat, onCancel }: {
  b: Booking; courses: Record<number, Tour>; busy: boolean; onGuide: () => void; onChat: (it: BookingItem) => void; onCancel: () => void;
}) {
  const span = bookingSpan(b);
  const items = b.items.filter((i) => i.status !== "cancelled");
  const ok = items.filter((i) => okItem(i.status)).length;
  const status = items.length && ok === items.length ? `${items.length}개 모두 확정` : `${items.length}개 중 ${ok}개 확정`;
  const firstBuddy = items.find((i) => i.type === "buddy");

  // 타임라인: 숙박 → 버디 → (버디가 고른 코스)
  type Step = { key: string; kind: "item" | "course"; it: BookingItem };
  const steps: Step[] = [];
  for (const it of items) {
    steps.push({ key: `i${it.id}`, kind: "item", it });
    if (it.type === "buddy" && it.course_id != null && it.status !== "rejected") steps.push({ key: `c${it.id}`, kind: "course", it });
  }

  return (
    <section className="px-5">
      <h2 className="text-[22px] font-bold leading-tight text-ink">{krRange(span.from, span.to)}, 성북동</h2>
      <div className="mt-2 flex items-center justify-between text-[14px]">
        <span className="text-muted">{b.code}</span>
        <span className={ok === items.length ? "text-ink" : "font-semibold text-orange"}>{status}</span>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-gray-bg"><div className="h-full rounded-full bg-navy transition-all" style={{ width: `${items.length ? (ok / items.length) * 100 : 0}%` }} /></div>

      <div className="mt-6">
        {steps.map((s, k) => (
          <TimelineStep key={s.key} last={k === steps.length - 1} node={<Node kind={s.kind === "course" ? "open" : nodeOf(s.it.status)} />}>
            {s.kind === "course" ? <CourseStep it={s.it} course={courses[s.it.course_id!]} /> : s.it.type === "dorm" ? <DormStep it={s.it} onGuide={onGuide} /> : <BuddyStep b={b} it={s.it} onChat={() => onChat(s.it)} />}
          </TimelineStep>
        ))}
      </div>

      <div className="mt-7 flex items-center justify-between border-t border-line pt-4 text-[15px]">
        <span className="text-muted">결제</span>
        <span className="font-bold text-ink">{won(b.total_price)} {b.paid_at ? "결제 완료" : "결제 전"}</span>
      </div>
      {!b.paid_at && paymentsEnabled() && <LinkButton href={`/pay?booking=${b.id}`} className="mt-4">{won(b.total_price)} 결제하기</LinkButton>}

      {firstBuddy && (
        <LinkButton href={`/trips/${b.id}/report?item=${firstBuddy.id}`} variant="danger-outline" className="mt-5">
          <Icon name="shield" className="h-5 w-5" />도움이 필요해요 · 신고
        </LinkButton>
      )}
      <p className="mt-4 text-[13px] leading-relaxed text-muted">
        예약을 취소하면 숙박과 버디가 함께 취소돼요. 체크인 7일 전까지 전액 환불돼요.{" "}
        <button type="button" onClick={onCancel} disabled={busy} className="font-semibold text-ink underline underline-offset-2 disabled:opacity-40">예약 취소하기</button>
      </p>
    </section>
  );
}

function StepHead({ title, pill }: { title: string; pill: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[17px] font-semibold leading-snug text-ink">{title}</span>
      <span className="mt-0.5">{pill}</span>
    </div>
  );
}

function DormStep({ it, onGuide }: { it: BookingItem; onGuide: () => void }) {
  return (
    <>
      <StepHead title={it.title} pill={<StatusPill status={it.status} label={itemStatusLabel(it)} />} />
      <div className="mt-1 text-[15px] text-muted">{krRange(it.date_from, it.date_to)}{it.date_from && it.date_to ? `, ${nightsOf(it.date_from, it.date_to)}박` : ""}</div>
      {it.status === "requested" && <div className="mt-1 text-[14px] text-orange-ink">대학이 확인하고 있어요</div>}
      {it.status === "rejected" && <div className="mt-1 text-[14px] text-muted">대학이 거절했어요{it.reject_reason ? ` · ${it.reject_reason}` : ""}</div>}
      {okItem(it.status) && <button type="button" onClick={onGuide} className={cn(linkCls, "mt-2.5")}>체크인 안내 보기</button>}
    </>
  );
}

function BuddyStep({ b, it, onChat }: { b: Booking; it: BookingItem; onChat: () => void }) {
  const deposit = it.meal_deposit ?? 0, used = it.meal_used ?? 0;
  const left = Math.max(0, deposit - used);
  const name = buddyNameOf(it);
  return (
    <>
      <StepHead title={it.title} pill={<StatusPill status={it.status} label={itemStatusLabel(it)} />} />
      <div className="mt-1 text-[15px] text-muted">{krDate(it.date_from)} {it.time}, {hoursLabel(it.duration_min)}</div>
      {it.status === "requested" && <div className="mt-1 text-[14px] text-orange-ink">{name}{iga(name)} 수락하면 채팅이 열려요</div>}
      {it.status === "rejected" && <div className="mt-1 text-[14px] text-muted">{name}{iga(name)} 이날 갈 수 없대요{it.reject_reason ? ` · ${it.reject_reason}` : ""}. 숙박 기간 안에서 다른 버디를 골라 주세요.</div>}

      {deposit > 0 && it.status !== "rejected" && (
        <div className="mt-3.5 rounded-[14px] border border-line px-4 py-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[15px] text-muted">식사비</span>
            <span className="text-[16px] font-bold text-ink">{won(used)} / {won(deposit)}</span>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-gray-bg"><div className={cn("h-full rounded-full", used > deposit ? "bg-orange" : "bg-navy")} style={{ width: `${Math.min(100, deposit ? (used / deposit) * 100 : 0)}%` }} /></div>
          <p className="mt-2.5 text-[13px] leading-relaxed text-muted">
            {used === 0 ? `식사 ${it.meal_count}회분 보증금이에요. 쓰지 않은 금액은 여행이 끝나면 돌려드려요.` : `식사 ${it.meal_count}회분 중 ${won(used)} 사용 · 남은 ${won(left)}은 여행이 끝나면 돌려드려요.`}
          </p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {it.status === "confirmed" && <button type="button" onClick={onChat} className={linkCls}>채팅</button>}
        {it.album && it.status !== "rejected" && <Link href={`/trips/${b.id}/album`} className={linkCls}>앨범 {it.album_photos ?? 0}장</Link>}
        {it.can_review && <Link href={`/trips/${b.id}/review?item=${it.id}`} className={linkCls}>후기 쓰기</Link>}
        {canReplace(it) && <Link href={`/trips/${b.id}/replace?item=${it.id}`} className={cn(linkCls, it.status === "rejected" && "text-orange")}>{it.status === "rejected" ? "다른 버디 고르기" : "버디 바꾸기"}</Link>}
      </div>
    </>
  );
}

function CourseStep({ it, course }: { it: BookingItem; course?: Tour }) {
  const title = it.course_title ?? course?.title ?? "산책 코스";
  const name = buddyNameOf(it);
  return (
    <>
      <StepHead title={title.endsWith("코스") ? title : `${title} 코스`} pill={<StatusPill status="none" tone="gray" label="무료 코스" />} />
      <div className="mt-1 text-[15px] text-muted">{krDate(it.date_from)} {name}{wa(name)} 함께{course ? ` · 장소 ${course.places.length}곳` : ""}</div>
      <Link href={`/tours/${it.course_id}`} className={cn(linkCls, "mt-2.5 inline-block")}>AI 이야기 듣기</Link>
    </>
  );
}

function PastTrip({ b }: { b: Booking }) {
  const span = bookingSpan(b);
  const cancelled = b.status === "cancelled";
  const items = cancelled ? b.items : b.items.filter((i) => i.status !== "cancelled");
  return (
    <section className="px-5">
      <h2 className="text-[20px] font-bold leading-tight text-ink">{krRange(span.from, span.to)}, 성북동</h2>
      <div className="mt-2 flex items-center justify-between text-[14px]">
        <span className="text-muted">{span.from.slice(0, 4)} · {b.code}</span>
        <StatusPill status={cancelled ? "cancelled" : "confirmed"} label={cancelled ? "취소됨" : "다녀왔어요"} />
      </div>
      <div className="mt-2 divide-y divide-line">
        {items.map((it) => (
          <div key={it.id} className="flex items-center justify-between gap-3 py-4">
            <div className="min-w-0">
              <div className={cn("text-[16px] font-semibold", cancelled ? "text-muted" : "text-ink")}>{it.title}</div>
              <div className="mt-0.5 text-[14px] text-muted">
                {it.type === "dorm" ? `${krRange(it.date_from, it.date_to)}${it.date_from && it.date_to ? `, ${nightsOf(it.date_from, it.date_to)}박` : ""}` : `${krDate(it.date_from)} ${it.time ?? ""}`}
                {it.type === "buddy" && (it.meal_deposit ?? 0) > 0 && !cancelled ? ` · 식사비 ${won(it.meal_used ?? 0)} 사용, ${won(it.meal_refund ?? 0)} 환불` : ""}
              </div>
              {it.album && !cancelled && <Link href={`/trips/${b.id}/album`} className="mt-1.5 inline-block text-[14px] font-semibold text-navy">앨범 {it.album_photos ?? 0}장</Link>}
            </div>
            <div className="shrink-0">
              {it.can_review ? <Link href={`/trips/${b.id}/review?item=${it.id}`} className="text-[15px] font-semibold text-navy">후기 쓰기</Link>
                : it.reviewed ? <span className="text-[14px] text-muted">후기 남김</span> : null}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-line pt-4 text-[15px]">
        <span className="text-muted">{cancelled ? "환불" : "결제"}</span>
        <span className="font-semibold text-ink">{won(b.total_price)} {cancelled ? (b.cancelled_at ? `${md(b.cancelled_at.slice(0, 10))} 취소` : "취소") : "결제 완료"}</span>
      </div>
    </section>
  );
}
