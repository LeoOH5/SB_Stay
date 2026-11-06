"use client";
// T22 도움이 필요해요 · 신고 — GET /bookings/{id}, POST /reports {booking_item_id, category, text, photo_url?}
// 사진은 실제 업로드 없이 파일 이름만 기억한다 (photo_url 자리)
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { ErrorBox, textareaCls } from "@/components/tourist";
import { errMsg } from "@/components/tourist/format";
import { ActionBar, PhoneIcon, buddyNameOf, krDate, useBooking } from "@/components/tourist/trips/util";
import { Button, Hero, Icon, LinkButton, Spinner, cn } from "@/components/ui";
import { REPORT_CATEGORY, keysOf, label } from "@/lib/codes";
import { post } from "@/lib/api";
import type { Report, ReportCategory } from "@/lib/types";

/** 화면(T22) 문구 — 없으면 codes.ts 라벨 */
const COPY: Partial<Record<ReportCategory, string>> = {
  rude: "불편한 말이나 행동을 했어요",
  money: "돈이나 선물을 따로 요구했어요",
};

function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const { booking, err: loadErr } = useBooking(id);
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState<Report | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const buddyItems = booking?.items.filter((i) => i.type === "buddy" && i.status !== "cancelled") ?? [];
  const itemParam = Number(sp.get("item"));
  const [picked, setPicked] = useState<number | null>(null);
  const item = buddyItems.find((i) => i.id === (picked ?? itemParam)) ?? buddyItems[0];

  const submit = async () => {
    if (!item || !category) return;
    setBusy(true); setErr(null);
    try { setSent(await post<Report>("/reports", { booking_item_id: item.id, category, text: text.trim(), photo_url: photo ? `uploads/${photo}` : null })); }
    catch (e) { setErr(errMsg(e)); }
    finally { setBusy(false); }
  };

  const emergency = (
    <div className="flex items-start gap-3 rounded-[14px] bg-orange-bg px-4 py-3.5 text-[14px] font-semibold leading-relaxed text-orange-ink">
      <PhoneIcon className="mt-0.5 h-[18px] w-[18px]" />
      <p>지금 위험하다면 <a href="tel:112" className="underline-offset-2 hover:underline">112(경찰)</a>, <a href="tel:119" className="underline-offset-2 hover:underline">119(구급)</a>에 먼저 연락하세요. 관광 통역 안내는 <a href="tel:1330" className="underline-offset-2 hover:underline">1330</a></p>
    </div>
  );

  if (sent) {
    return (
      <>
        <Hero back="/trips" title={<>운영팀에<br />알렸어요</>} sub="운영팀이 확인하고 앱 알림과 메일로 연락드려요. 버디에게는 누가 신고했는지 알리지 않아요." />
        <div className="space-y-4 px-5">
          {sent.auto_suspended && <p className="text-[15px] leading-relaxed text-ink">이 버디는 운영팀이 확인할 때까지 새 요청을 받지 않아요.</p>}
          {emergency}
        </div>
        <ActionBar><LinkButton href="/trips">내 여행으로</LinkButton></ActionBar>
      </>
    );
  }

  return (
    <>
      <Hero back="/trips" title={<>무슨 일이<br />있었나요?</>} sub="운영팀이 바로 확인해요. 버디에게는 누가 신고했는지 알리지 않아요." />
      <div className="px-5">
        {emergency}
        <ErrorBox message={loadErr} className="mt-3" />
        {!booking && !loadErr && <Spinner />}
        {booking && buddyItems.length === 0 && <p className="py-8 text-center text-[15px] text-muted">신고할 버디 동행이 없어요. 급한 일은 위 번호로 연락해 주세요.</p>}

        {item && buddyItems.length > 1 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {buddyItems.map((i) => (
              <button key={i.id} type="button" onClick={() => setPicked(i.id)} aria-pressed={i.id === item.id}
                className={cn("h-9 rounded-full border px-3.5 text-[14px]", i.id === item.id ? "border-navy bg-navy font-semibold text-white" : "border-line text-ink")}>
                {buddyNameOf(i)} · {krDate(i.date_from)}
              </button>
            ))}
          </div>
        )}
        {item && buddyItems.length === 1 && <p className="mt-5 text-[14px] text-muted">{item.title} · {krDate(item.date_from)}</p>}

        {item && (
          <>
            <div role="radiogroup" aria-label="무슨 일이 있었나요" className="mt-2 divide-y divide-line">
              {keysOf(REPORT_CATEGORY).map((c) => {
                const on = category === c;
                return (
                  <button key={c} type="button" role="radio" aria-checked={on} onClick={() => setCategory(c)} className="flex w-full items-center gap-4 py-4 text-left">
                    <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2", on ? "border-navy bg-navy" : "border-[#C9CED3] bg-white")}>
                      {on && <span className="h-2 w-2 rounded-full bg-white" />}
                    </span>
                    <span className={cn("text-[16px]", on ? "font-semibold text-ink" : "text-ink")}>{COPY[c] ?? label(REPORT_CATEGORY, c)}</span>
                  </button>
                );
              })}
            </div>

            <textarea className={`${textareaCls} mt-4 min-h-[96px] text-[15px]`} placeholder="언제, 어디서, 어떤 일이 있었는지 적어 주세요" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} aria-label="무슨 일이 있었는지" />

            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setPhoto(f.name); e.target.value = ""; }} />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex h-12 items-center gap-2.5 rounded-[12px] border border-line px-5 text-[15px] font-semibold text-ink hover:bg-gray-bg">
                <Icon name="image" className="h-5 w-5" />{photo ? "사진 바꾸기" : "사진 첨부"}
              </button>
              {photo && (
                <span className="inline-flex max-w-full items-center gap-1.5 text-[14px] text-muted">
                  <span className="truncate">{photo}</span>
                  <button type="button" onClick={() => setPhoto(null)} aria-label="사진 빼기" className="text-ink"><Icon name="x" className="h-4 w-4" /></button>
                </span>
              )}
            </div>
            <ErrorBox message={err} className="mt-4" />
          </>
        )}
      </div>

      {item && (
        <ActionBar note={!category ? "무슨 일인지 하나 골라 주세요" : !text.trim() ? "있었던 일을 적어 주세요" : undefined}>
          <Button variant="danger" onClick={submit} disabled={busy || !category || !text.trim()}>{busy ? "보내는 중…" : "운영팀에 알리기"}</Button>
        </ActionBar>
      )}
    </>
  );
}

export default function Page() {
  return <Suspense fallback={<Spinner />}><ReportPage /></Suspense>;
}
