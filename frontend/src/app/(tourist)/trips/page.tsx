"use client";
// T16 내 여행 — BK-02 GET /bookings/me?scope=upcoming|past, 코스 장소 수 GET /tours/{id}, 체크인 안내(BK-07), 채팅(BK-09), 취소(BK-05)
// 버디 항목: 식사비 사용(meal_used / meal_deposit)·남은 보증금, 채팅 · 앨범 · 후기 · 버디 바꾸기, 신고(T22)
import Link from "next/link";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { BottomSheet, ErrorBox, LoginRequired, Row } from "@/components/tourist";
import { DEMO_TODAY, errMsg, itemStatusLabel, md, okv, itemTitle } from "@/components/tourist/format";
import type { ChatMessage, CheckinGuide } from "@/components/tourist/types";
import { NotiBell } from "@/components/tourist/trips/noti-bell";
import { Node, TimelineStep, bookingSpan, buddyNameOf, hoursLabel, iga, krDate, krRange, nightsOf, wa } from "@/components/tourist/trips/util";
import { Button, Chip, Hero, Icon, LinkButton, Spinner, StatusPill, cn } from "@/components/ui";
import { get, post } from "@/lib/api";
import { money, tr, useLang } from "@/lib/i18n";
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
  useLang();
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
    if (!window.confirm(tr(`${b.code} 예약을 취소할까요?\n숙박과 버디가 함께 취소돼요.\n환불: 체크인 7일 전 전액 · 3일 전 절반 · 그 뒤에는 안 돼요`, `Cancel booking ${b.code}?\nYour stay and buddy will both be cancelled.\nRefund: full up to 7 days before check-in · half up to 3 days before · none after that`))) return;
    setBusy(true); setErr(null);
    try { await post(`/bookings/${b.id}/cancel`, { reason: tr("일정 변경", "Change of plans") }); reload(); }
    catch (e) { setErr(errMsg(e)); }
    finally { setBusy(false); }
  };

  if (!user) {
    return (<><Hero title={tr("내 여행", "My trips")} right={<NotiBell />} /><div className="px-5 pb-6 pt-2"><LoginRequired what={tr("내 여행", "My trips")} /></div></>);
  }

  const shown = lists[tab];
  return (
    <>
      <Hero title={tr("내 여행", "My trips")} right={<NotiBell />}>
        <div className="mt-5 flex gap-2">
          <Chip selected={tab === "upcoming"} onClick={() => setTab("upcoming")}>{tr("다가오는 여행", "Upcoming")}{lists.upcoming ? ` ${lists.upcoming.length}` : ""}</Chip>
          <Chip selected={tab === "past"} onClick={() => setTab("past")}>{tr("지난 여행", "Past")}{lists.past ? ` ${lists.past.length}` : ""}</Chip>
        </div>
      </Hero>

      <div className="pb-8">
        <ErrorBox message={err} className="mx-5 mb-3" />
        {!shown && <Spinner />}
        {shown?.length === 0 && (
          <div className="px-5 py-10 text-center">
            <p className="text-[15px] text-muted">{tab === "upcoming" ? tr("다가오는 여행이 없어요.", "No upcoming trips.") : tr("지난 여행이 없어요.", "No past trips.")}</p>
            {tab === "upcoming" && <LinkButton href="/plan" className="mt-5">{tr("AI로 여행 설계하기", "Plan my stay with AI")}</LinkButton>}
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
      <BottomSheet open={guideFor !== null} onClose={() => setGuideFor(null)} title={tr("체크인 안내", "Check-in guide")}>
        <ErrorBox message={sheetErr} />
        {!guide && !sheetErr && <Spinner />}
        {guide && (
          <div>
            <div className="divide-y divide-line">
              <Row label={tr("건물", "Building")}>{guide.building}</Row>
              <Row label={tr("주소", "Address")}>{guide.address}</Row>
              <Row label={tr("체크인 · 체크아웃", "Check-in · Check-out")}>{guide.checkin} · {guide.checkout}</Row>
              <Row label={tr("와이파이", "Wi-Fi")}>{guide.wifi}</Row>
            </div>
            <h4 className="mt-5 text-[15px] font-bold text-ink">{tr("들어가는 방법", "How to get in")}</h4>
            <ol className="mt-2 space-y-1.5 text-[15px] text-ink">{guide.steps.map((s, k) => <li key={k} className="flex gap-2"><span className="font-semibold text-navy">{k + 1}</span>{s}</li>)}</ol>
            <h4 className="mt-5 text-[15px] font-bold text-ink">{tr("긴급 연락처", "Emergency contacts")}</h4>
            <ul className="mt-2 space-y-1 text-[15px] text-ink">{guide.emergency.map((s, k) => <li key={k}>{s}</li>)}</ul>
          </div>
        )}
      </BottomSheet>

      {/* 버디 채팅 */}
      <BottomSheet open={chatFor !== null} onClose={() => setChatFor(null)} title={chatFor ? tr(`${buddyNameOf(chatFor)}${wa(buddyNameOf(chatFor))} 채팅`, `Chat with ${buddyNameOf(chatFor)}`) : tr("채팅", "Chat")}>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[13px] text-muted">{tr("메시지는 자동으로 번역돼요", "Messages are translated automatically")}</span>
          <Chip selected={translate} onClick={() => setTranslate((v) => !v)} className="h-8 px-3 text-[13px]">{translate ? tr("번역 켜짐", "Translate on") : tr("번역 꺼짐", "Translate off")}</Chip>
        </div>
        <ErrorBox message={sheetErr} />
        {!chat && !sheetErr && <Spinner />}
        {chat && chatBooking && (
          <div className="space-y-2">
            {chat.map((m) => (
              <div key={m.id} className={cn("max-w-[80%] rounded-[14px] px-3.5 py-2.5 text-[15px]", m.sender === "tourist" ? "ml-auto bg-navy text-white" : "bg-gray-bg text-ink")}>
                <div>{translate ? m.translated_text : m.text}</div>
                {translate && m.translated_text !== m.text && <div className="mt-1 text-[12px] opacity-70">{tr("원문", "Original")}: {m.text}</div>}
              </div>
            ))}
            <form className="flex gap-2 pt-2" onSubmit={(e) => { e.preventDefault(); sendDraft(); }}>
              <input className="h-11 flex-1 rounded-[12px] border border-line bg-white px-3.5 text-[15px] text-ink placeholder:text-muted focus:border-navy focus:outline-none" placeholder={tr("메시지 보내기", "Send a message")} value={draft} onChange={(e) => setDraft(e.target.value)} />
              <Button type="submit" full={false} className="h-11! min-h-11! px-4 text-[15px]">{tr("보내기", "Send")}</Button>
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
  const status = items.length && ok === items.length ? tr(`${items.length}개 모두 확정`, `All ${items.length} confirmed`) : tr(`${items.length}개 중 ${ok}개 확정`, `${ok} of ${items.length} confirmed`);
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
      <h2 className="text-[22px] font-bold leading-tight text-ink">{krRange(span.from, span.to)}, {tr("성북동", "Seongbuk-dong")}</h2>
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
        <span className="text-muted">{tr("결제", "Payment")}</span>
        <span className="font-bold text-ink">{money(b.total_price)} {b.paid_at ? tr("결제 완료", "Paid") : tr("결제 전", "Not paid")}</span>
      </div>
      {!b.paid_at && paymentsEnabled() && <LinkButton href={`/pay?booking=${b.id}`} className="mt-4">{tr(`${money(b.total_price)} 결제하기`, `Pay ${money(b.total_price)}`)}</LinkButton>}

      {firstBuddy && (
        <LinkButton href={`/trips/${b.id}/report?item=${firstBuddy.id}`} variant="danger-outline" className="mt-5">
          <Icon name="shield" className="h-5 w-5" />{tr("도움이 필요해요 · 신고", "Need help · Report")}
        </LinkButton>
      )}
      <p className="mt-4 text-[13px] leading-relaxed text-muted">
        {tr("예약을 취소하면 숙박과 버디가 함께 취소돼요. 체크인 7일 전까지 전액 환불돼요.", "Cancelling cancels both your stay and buddy. Full refund up to 7 days before check-in.")}{" "}
        <button type="button" onClick={onCancel} disabled={busy} className="font-semibold text-ink underline underline-offset-2 disabled:opacity-40">{tr("예약 취소하기", "Cancel booking")}</button>
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
      <StepHead title={itemTitle(it.title)} pill={<StatusPill status={it.status} label={itemStatusLabel(it)} />} />
      <div className="mt-1 text-[15px] text-muted">{krRange(it.date_from, it.date_to)}{it.date_from && it.date_to ? tr(`, ${nightsOf(it.date_from, it.date_to)}박`, `, ${nightsOf(it.date_from, it.date_to)} night${nightsOf(it.date_from, it.date_to) === 1 ? "" : "s"}`) : ""}</div>
      {it.status === "requested" && <div className="mt-1 text-[14px] text-orange-ink">{tr("대학이 확인하고 있어요", "The university is reviewing it")}</div>}
      {it.status === "rejected" && <div className="mt-1 text-[14px] text-muted">{tr("대학이 거절했어요", "The university declined")}{it.reject_reason ? ` · ${it.reject_reason}` : ""}</div>}
      {okItem(it.status) && <button type="button" onClick={onGuide} className={cn(linkCls, "mt-2.5")}>{tr("체크인 안내 보기", "View check-in guide")}</button>}
    </>
  );
}

function BuddyStep({ b, it, onChat }: { b: Booking; it: BookingItem; onChat: () => void }) {
  const deposit = it.meal_deposit ?? 0, used = it.meal_used ?? 0;
  const left = Math.max(0, deposit - used);
  const name = buddyNameOf(it);
  return (
    <>
      <StepHead title={itemTitle(it.title)} pill={<StatusPill status={it.status} label={itemStatusLabel(it)} />} />
      <div className="mt-1 text-[15px] text-muted">{krDate(it.date_from)} {it.time}, {hoursLabel(it.duration_min)}</div>
      {it.status === "requested" && <div className="mt-1 text-[14px] text-orange-ink">{tr(`${name}${iga(name)} 수락하면 채팅이 열려요`, `Chat opens once ${name} accepts`)}</div>}
      {it.status === "rejected" && <div className="mt-1 text-[14px] text-muted">{tr(`${name}${iga(name)} 이날 갈 수 없대요`, `${name} can't make it that day`)}{it.reject_reason ? ` · ${it.reject_reason}` : ""}. {tr("숙박 기간 안에서 다른 버디를 골라 주세요.", "Please pick another buddy within your stay.")}</div>}

      {deposit > 0 && it.status !== "rejected" && (
        <div className="mt-3.5 rounded-[14px] border border-line px-4 py-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[15px] text-muted">{tr("식사비", "Meals")}</span>
            <span className="text-[16px] font-bold text-ink">{money(used)} / {money(deposit)}</span>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-gray-bg"><div className={cn("h-full rounded-full", used > deposit ? "bg-orange" : "bg-navy")} style={{ width: `${Math.min(100, deposit ? (used / deposit) * 100 : 0)}%` }} /></div>
          <p className="mt-2.5 text-[13px] leading-relaxed text-muted">
            {used === 0 ? tr(`식사 ${it.meal_count}회분 보증금이에요. 쓰지 않은 금액은 여행이 끝나면 돌려드려요.`, `Meal deposit for ${it.meal_count} meal${it.meal_count === 1 ? "" : "s"}. Anything unused is refunded after the trip.`) : tr(`식사 ${it.meal_count}회분 중 ${money(used)} 사용 · 남은 ${money(left)}은 여행이 끝나면 돌려드려요.`, `${money(used)} used of ${it.meal_count} meal${it.meal_count === 1 ? "" : "s"} · the remaining ${money(left)} is refunded after the trip.`)}
          </p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {it.status === "confirmed" && <button type="button" onClick={onChat} className={linkCls}>{tr("채팅", "Chat")}</button>}
        {it.album && it.status !== "rejected" && <Link href={`/trips/${b.id}/album`} className={linkCls}>{tr(`앨범 ${it.album_photos ?? 0}장`, `Photo record · ${it.album_photos ?? 0}`)}</Link>}
        {it.can_review && <Link href={`/trips/${b.id}/review?item=${it.id}`} className={linkCls}>{tr("후기 쓰기", "Write a review")}</Link>}
        {canReplace(it) && <Link href={`/trips/${b.id}/replace?item=${it.id}`} className={cn(linkCls, it.status === "rejected" && "text-orange")}>{it.status === "rejected" ? tr("다른 버디 고르기", "Pick another buddy") : tr("버디 바꾸기", "Change buddy")}</Link>}
      </div>
    </>
  );
}

function CourseStep({ it, course }: { it: BookingItem; course?: Tour }) {
  const title = it.course_title ?? course?.title ?? tr("산책 코스", "Walk");
  const titleEn = course?.title_en;
  const name = buddyNameOf(it);
  return (
    <>
      <StepHead title={tr(title.endsWith("코스") ? title : `${title} 코스`, titleEn ? `${titleEn} walk` : title)} pill={<StatusPill status="none" tone="gray" label={tr("무료 코스", "Free walk")} />} />
      <div className="mt-1 text-[15px] text-muted">{krDate(it.date_from)} {tr(`${name}${wa(name)} 함께`, `with ${name}`)}{course ? tr(` · 장소 ${course.places.length}곳`, ` · ${course.places.length} stops`) : ""}</div>
      <Link href={`/tours/${it.course_id}`} className={cn(linkCls, "mt-2.5 inline-block")}>{tr("AI 이야기 듣기", "Hear AI stories")}</Link>
    </>
  );
}

function PastTrip({ b }: { b: Booking }) {
  const span = bookingSpan(b);
  const cancelled = b.status === "cancelled";
  const items = cancelled ? b.items : b.items.filter((i) => i.status !== "cancelled");
  return (
    <section className="px-5">
      <h2 className="text-[20px] font-bold leading-tight text-ink">{krRange(span.from, span.to)}, {tr("성북동", "Seongbuk-dong")}</h2>
      <div className="mt-2 flex items-center justify-between text-[14px]">
        <span className="text-muted">{span.from.slice(0, 4)} · {b.code}</span>
        <StatusPill status={cancelled ? "cancelled" : "confirmed"} label={cancelled ? tr("취소됨", "Cancelled") : tr("다녀왔어요", "Completed")} />
      </div>
      <div className="mt-2 divide-y divide-line">
        {items.map((it) => (
          <div key={it.id} className="flex items-center justify-between gap-3 py-4">
            <div className="min-w-0">
              <div className={cn("text-[16px] font-semibold", cancelled ? "text-muted" : "text-ink")}>{itemTitle(it.title)}</div>
              <div className="mt-0.5 text-[14px] text-muted">
                {it.type === "dorm" ? `${krRange(it.date_from, it.date_to)}${it.date_from && it.date_to ? tr(`, ${nightsOf(it.date_from, it.date_to)}박`, `, ${nightsOf(it.date_from, it.date_to)} night${nightsOf(it.date_from, it.date_to) === 1 ? "" : "s"}`) : ""}` : `${krDate(it.date_from)} ${it.time ?? ""}`}
                {it.type === "buddy" && (it.meal_deposit ?? 0) > 0 && !cancelled ? tr(` · 식사비 ${money(it.meal_used ?? 0)} 사용, ${money(it.meal_refund ?? 0)} 환불`, ` · Meals ${money(it.meal_used ?? 0)} used, ${money(it.meal_refund ?? 0)} refunded`) : ""}
              </div>
              {it.album && !cancelled && <Link href={`/trips/${b.id}/album`} className="mt-1.5 inline-block text-[14px] font-semibold text-navy">{tr(`앨범 ${it.album_photos ?? 0}장`, `Photo record · ${it.album_photos ?? 0}`)}</Link>}
            </div>
            <div className="shrink-0">
              {it.can_review ? <Link href={`/trips/${b.id}/review?item=${it.id}`} className="text-[15px] font-semibold text-navy">{tr("후기 쓰기", "Write a review")}</Link>
                : it.reviewed ? <span className="text-[14px] text-muted">{tr("후기 남김", "Reviewed")}</span> : null}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-line pt-4 text-[15px]">
        <span className="text-muted">{cancelled ? tr("환불", "Refund") : tr("결제", "Payment")}</span>
        <span className="font-semibold text-ink">{money(b.total_price)} {cancelled ? (b.cancelled_at ? tr(`${md(b.cancelled_at.slice(0, 10))} 취소`, `cancelled ${md(b.cancelled_at.slice(0, 10))}`) : tr("취소", "cancelled")) : tr("결제 완료", "Paid")}</span>
      </div>
    </section>
  );
}
