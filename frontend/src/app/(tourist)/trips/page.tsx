"use client";
// T6 내 여행 · 예약 상태 + T11 지난 예약·취소 — BK-02 GET /bookings/me, BK-07 체크인 안내, BK-09 채팅, BK-05 취소, BK-08 리뷰
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Card, Chip, Hero, SectionTitle, Spinner, StatusPill } from "@/components/ui";
import { BottomSheet, ErrorBox, LoginRequired, Notice, Row, selectCls, Stars, textareaCls, TypeBadge } from "@/components/tourist";
import { DEMO_TODAY, errMsg, itemStatusLabel, md, okv, ymd } from "@/components/tourist/format";
import type { ChatMessage, CheckinGuide } from "@/components/tourist/types";
import { get, post, won } from "@/lib/api";
import { useUser } from "@/lib/auth";
import type { Booking, BookingItem, ListResponse } from "@/lib/types";

const okItem = (s: BookingItem["status"]) => s === "approved" || s === "confirmed";
const lastDate = (b: Booking) => b.items.reduce((m, i) => (i.date_to ?? i.date_from ?? "") > m ? (i.date_to ?? i.date_from ?? "") : m, "");
const isPast = (b: Booking) => b.status === "cancelled" || (lastDate(b) !== "" && lastDate(b) < DEMO_TODAY);
const range = (b: Booking) => { const ds = b.items.flatMap((i) => [i.date_from, i.date_to]).filter((d): d is string => !!d).sort(); return ds.length ? `${ymd(ds[0])} – ${ymd(ds[ds.length - 1]).slice(5)}` : ""; };

export default function TripsPage() {
  const { user } = useUser();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // 시트 상태
  const [guideFor, setGuideFor] = useState<Booking | null>(null);
  const [guide, setGuide] = useState<CheckinGuide | null>(null);
  const [chatFor, setChatFor] = useState<Booking | null>(null);
  const [chat, setChat] = useState<ChatMessage[] | null>(null);
  const [translate, setTranslate] = useState(true);
  const [draft, setDraft] = useState("");
  const [reviewFor, setReviewFor] = useState<Booking | null>(null);
  const [reviewItem, setReviewItem] = useState<number>(0);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewDone, setReviewDone] = useState<string | null>(null);
  const [receiptFor, setReceiptFor] = useState<Booking | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheetErr, setSheetErr] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    get<ListResponse<Booking>>("/bookings/me", { scope: tab }).then((r) => { if (alive) setBookings(r.items); }).catch((e: unknown) => { if (alive) setErr(errMsg(e)); });
    return () => { alive = false; };
  }, [user, tab, reloadKey]);

  const reload = () => { setBookings(null); setReloadKey((k) => k + 1); };

  const openGuide = (b: Booking) => {
    setGuideFor(b); setGuide(null); setSheetErr(null);
    okv(get<CheckinGuide>(`/bookings/${b.id}/checkin-guide`)).then(setGuide).catch((e: unknown) => setSheetErr(errMsg(e)));
  };
  const openChat = (b: Booking) => {
    setChatFor(b); setChat(null); setSheetErr(null);
    get<ListResponse<ChatMessage>>(`/bookings/${b.id}/chat`).then((r) => setChat(r.items)).catch((e: unknown) => setSheetErr(errMsg(e)));
  };
  const sendDraft = () => {
    const t = draft.trim();
    if (!t) return;
    setChat((c) => [...(c ?? []), { id: Date.now(), sender: "tourist", text: t, translated_text: t, created_at: new Date().toISOString() }]);
    setDraft("");
  };
  const cancel = async (b: Booking) => {
    if (!window.confirm(`${b.code} 예약을 취소할까요?\n숙박·투어·버디 모두 취소됩니다.\n환불: 체크인 7일 전 100% · 3일 전 50% · 이후 0%`)) return;
    setBusy(true); setErr(null);
    try { await post(`/bookings/${b.id}/cancel`, { reason: "일정 변경" }); reload(); }
    catch (e) { setErr(errMsg(e)); }
    finally { setBusy(false); }
  };
  const openReview = (b: Booking) => { setReviewFor(b); setReviewItem(b.items[0]?.id ?? 0); setRating(5); setReviewText(""); setReviewDone(null); setSheetErr(null); };
  const submitReview = async () => {
    if (!reviewFor) return;
    setBusy(true); setSheetErr(null);
    try { await post(`/bookings/${reviewFor.id}/reviews`, { item_id: reviewItem, rating, text: reviewText.trim() }); setReviewDone("리뷰가 등록됐어요. 고마워요!"); }
    catch (e) { setSheetErr(errMsg(e)); }
    finally { setBusy(false); }
  };

  const all = bookings ?? [];
  const upcoming = all.filter((b) => !isPast(b));
  const past = all.filter(isPast);
  const shown = tab === "upcoming" ? upcoming : past;

  if (!user) {
    return (<><Hero title="My trips" /><div className="px-5 pb-6 pt-4"><LoginRequired what="내 여행" /></div></>);
  }

  return (
    <>
      <Hero title="My trips" sub={user.name} right={<Link href="/me" className="rounded-lg bg-green px-2.5 py-1 text-[12px] font-semibold text-navy">마이페이지</Link>} />
      <div className="px-5 pb-6 pt-4 space-y-3">
        <div className="flex gap-2">
          <Chip selected={tab === "upcoming"} onClick={() => setTab("upcoming")}>예정 ({upcoming.length})</Chip>
          <Chip selected={tab === "past"} onClick={() => setTab("past")}>지난 ({past.length})</Chip>
        </div>
        <ErrorBox message={err} />
        {!bookings && !err && <Spinner />}
        {bookings && shown.length === 0 && (
          <Card tint className="text-center py-8"><div className="text-[14px] text-ink">{tab === "upcoming" ? "예정된 여행이 없어요." : "지난 예약이 없어요."}</div>{tab === "upcoming" && <Link href="/plan" className="block mt-4"><Button>AI로 여행 설계하기</Button></Link>}</Card>
        )}

        {tab === "upcoming" && shown.map((b) => {
          const ok = b.items.filter((i) => okItem(i.status)).length;
          return (
            <Card key={b.id} className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div><div className="text-[12px] text-muted">예약번호</div><div className="text-[14px] font-semibold text-ink">{b.code}</div></div>
                <span className="rounded-lg bg-green px-2.5 py-1 text-[12px] font-semibold text-navy">{ok}/{b.items.length} 승인</span>
              </div>
              <div className="h-2 rounded-full bg-gray-bg overflow-hidden"><div className="h-full rounded-full bg-green-dark" style={{ width: `${b.items.length ? (ok / b.items.length) * 100 : 0}%` }} /></div>
              {b.items.map((it) => (
                <div key={it.id} className={`rounded-[12px] border-l-4 ${okItem(it.status) ? "border-l-green-dark" : it.status === "requested" ? "border-l-orange" : "border-l-line"} bg-white ring-1 ring-line/60 p-3`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2"><TypeBadge type={it.type} className="px-2 py-0.5 text-[10px]" /><span className="text-[14px] font-semibold text-ink truncate">{it.title}</span></div>
                      <div className="mt-1 text-[12px] text-muted">{it.meta}{it.type === "buddy" && it.status === "requested" ? " · 수락되면 채팅이 열립니다" : ""}{it.status === "rejected" && it.reject_reason ? ` · 사유: ${it.reject_reason}` : ""}</div>
                    </div>
                    <StatusPill status={it.status} label={itemStatusLabel(it)} />
                  </div>
                  <div className="mt-2 flex justify-end gap-3 text-[12px]">
                    {it.type === "dorm" && <button type="button" onClick={() => openGuide(b)} className="text-navy font-semibold">체크인 안내 보기 →</button>}
                    {it.type === "buddy" && <button type="button" onClick={() => openChat(b)} className="text-navy font-semibold">버디 채팅 {it.status === "requested" ? "(목업)" : ""} →</button>}
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between text-[13px]"><span className="text-muted">합계 · {b.paid_at ? "결제 완료" : "미결제"}</span><span className="font-semibold text-ink">{won(b.total_price)}</span></div>
              <Button variant="danger" className="text-[14px]" onClick={() => cancel(b)} disabled={busy}>예약 취소하기 (확인 팝업)</Button>
              <p className="text-[12px] text-orange">취소 시 숙박·투어·버디 모두 취소 · 환불: 체크인 7일 전 100% · 3일 전 50% · 이후 0%</p>
            </Card>
          );
        })}

        {tab === "past" && shown.map((b) => {
          const done = b.status !== "cancelled";
          return (
            <Card key={b.id} accent={done ? "green" : undefined} className={done ? "" : "border-l-4 border-l-line"}>
              <div className="flex items-start justify-between gap-3">
                <div className="text-[12px] text-muted">{b.code} · {range(b)}</div>
                <StatusPill status={done ? "confirmed" : "cancelled"} label={done ? "완료" : "취소됨"} />
              </div>
              <div className="mt-2 text-[14px] text-ink">{b.items.map((i) => i.title).join(" · ")}</div>
              <div className="mt-1 flex items-center justify-between text-[12px] text-muted"><span>{done ? `리뷰 0/${b.items.length} 작성` : "환불 100% (7일 전 취소)"}</span><span className="text-[14px] font-semibold text-ink">{won(b.total_price)}</span></div>
              <div className="mt-3 flex items-center gap-3">
                {done && <Button full={false} variant="secondary" className="h-9 min-h-[36px] px-4 text-[13px]" onClick={() => openReview(b)}>리뷰 쓰기</Button>}
                <button type="button" onClick={() => setReceiptFor(b)} className="text-[13px] text-navy font-semibold">영수증</button>
                <Link href="/home" className="text-[13px] text-navy font-semibold">다시 예약</Link>
              </div>
            </Card>
          );
        })}

        <p className="text-[12px] text-muted">상태값: 신청 → 승인/거절 → 확정 → 취소</p>
        <SectionTitle>체크인 안내 (목업 · 정적 페이지)</SectionTitle>
        <Card accent="navy"><div className="text-[13px] text-ink leading-relaxed">국제관 위치 지도 · 입실 절차 · 와이파이<br />긴급 연락처: 대학 담당자 / 운영자 / 112·119</div></Card>
        <p className="text-[13px]"><Link href="/me" className="text-navy font-semibold">마이페이지 (알림 · 고객센터) →</Link></p>
      </div>

      {/* 체크인 안내 (BK-07) */}
      <BottomSheet open={guideFor !== null} onClose={() => setGuideFor(null)} title={`체크인 안내 · ${guideFor?.code ?? ""}`}>
        <ErrorBox message={sheetErr} />
        {!guide && !sheetErr && <Spinner />}
        {guide && (
          <div className="space-y-2">
            <Row label="건물">{guide.building}</Row>
            <Row label="주소">{guide.address}</Row>
            <Row label="체크인 / 아웃">{guide.checkin} / {guide.checkout}</Row>
            <Row label="Wi-Fi">{guide.wifi}</Row>
            <Card accent="navy"><div className="text-[14px] font-semibold text-navy">입실 절차</div><ol className="mt-1.5 space-y-1 text-[13px] text-ink">{guide.steps.map((s, i) => <li key={i}>{i + 1}. {s}</li>)}</ol></Card>
            <Card accent="orange"><div className="text-[14px] font-semibold text-orange">긴급 연락처</div><ul className="mt-1.5 space-y-1 text-[13px] text-ink">{guide.emergency.map((s, i) => <li key={i}>· {s}</li>)}</ul></Card>
          </div>
        )}
      </BottomSheet>

      {/* 버디 채팅 (BK-09 목업) */}
      <BottomSheet open={chatFor !== null} onClose={() => setChatFor(null)} title="버디 채팅 (목업 · 자동 번역)">
        <div className="flex items-center justify-between mb-2"><span className="text-[12px] text-muted">메시지는 저장되지 않아요 (목업)</span><Chip selected={translate} onClick={() => setTranslate((v) => !v)} className="h-8 text-[12px]">자동 번역 {translate ? "ON" : "OFF"}</Chip></div>
        <ErrorBox message={sheetErr} />
        {!chat && !sheetErr && <Spinner />}
        {chat && (
          <div className="rounded-[14px] bg-gray-bg p-3 space-y-2">
            {chat.map((m) => (
              <div key={m.id} className={`max-w-[80%] rounded-[10px] px-3 py-2 text-[12px] ${m.sender === "tourist" ? "ml-auto bg-navy text-white" : "bg-white text-ink"}`}>
                <div className="text-[11px] opacity-70 mb-0.5">{m.sender === "tourist" ? user.name.split(" ")[0] : "버디"} · {md(m.created_at.slice(0, 10))}</div>
                <div>{translate ? m.translated_text : m.text}</div>
                {translate && m.translated_text !== m.text && <div className="mt-0.5 text-[11px] opacity-70">원문: {m.text}</div>}
              </div>
            ))}
            <form className="flex gap-2 pt-1" onSubmit={(e) => { e.preventDefault(); sendDraft(); }}>
              <input className="flex-1 h-9 rounded-xl border border-line bg-white px-3 text-[12px] text-ink placeholder:text-muted focus:outline-none focus:border-navy" placeholder="Message…" value={draft} onChange={(e) => setDraft(e.target.value)} />
              <Button type="submit" full={false} className="h-9 min-h-[36px] px-3 text-[12px]">보내기</Button>
            </form>
          </div>
        )}
      </BottomSheet>

      {/* 리뷰 작성 (BK-08 목업 · 항목별 1회) */}
      <BottomSheet open={reviewFor !== null} onClose={() => setReviewFor(null)} title="리뷰 작성 (항목별 1회)">
        {reviewFor && (
          <div className="space-y-3">
            <select className={selectCls} value={reviewItem} onChange={(e) => setReviewItem(Number(e.target.value))}>
              {reviewFor.items.map((it) => <option key={it.id} value={it.id}>{it.title} · {it.meta}</option>)}
            </select>
            <div className="flex items-center gap-3"><span className="text-[13px] text-muted">별점</span><Stars value={rating} onChange={setRating} size="text-[22px]" /></div>
            <textarea className={textareaCls} placeholder="해설이 쉽고 코스가 걷기 좋아요…" value={reviewText} onChange={(e) => setReviewText(e.target.value)} />
            <ErrorBox message={sheetErr} />
            {reviewDone ? <Card className="bg-green-bg ring-0 text-[13px] text-green-dark">{reviewDone}</Card> : <Button onClick={submitReview} disabled={busy || !reviewText.trim()}>{busy ? "등록 중…" : "리뷰 등록"}</Button>}
            <p className="text-[12px] text-muted">숙박·투어·버디 리뷰 모두 같은 폼이에요. 샘플 리뷰(TR-04)와 섞어 보여줘요.</p>
          </div>
        )}
      </BottomSheet>

      {/* 영수증 */}
      <BottomSheet open={receiptFor !== null} onClose={() => setReceiptFor(null)} title={`영수증 · ${receiptFor?.code ?? ""}`}>
        {receiptFor && (
          <div className="space-y-1">
            {receiptFor.items.map((it) => <Row key={it.id} label={it.title}>{won(it.price)}</Row>)}
            <Row label="플랫폼 수수료 (10%, 합계에 포함)">{won(receiptFor.platform_fee)}</Row>
            <div className="flex items-end justify-between pt-2 border-t border-line"><span className="text-[13px] text-muted">합계</span><span className="text-[22px] font-bold text-navy">{won(receiptFor.total_price)}</span></div>
            <Row label="결제">{receiptFor.paid_at ? `${ymd(receiptFor.paid_at.slice(0, 10))} · 목업` : "-"}</Row>
            <Row label="상태"><StatusPill status={receiptFor.status} /></Row>
            {receiptFor.status === "cancelled" && <Notice>환불 100% (7일 전 취소) · 실제 환불은 해커톤에서 처리하지 않아요.</Notice>}
          </div>
        )}
      </BottomSheet>
    </>
  );
}
