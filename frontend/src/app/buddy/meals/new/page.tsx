"use client";
// B11 식비 청구 — GET /buddy/schedule(확정 동행·식사 횟수·청구 수), POST /buddy/meal-claims {item_id, place, items, amount, receipt_url}
// v3.6: 영수증 사진은 고르면 바로 POST /uploads 로 올리고, 받은 /media 주소를 receipt_url 에 넣는다
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { krDate } from "@/components/buddy/format";
import { LoginGate } from "@/components/buddy/login-gate";
import { BottomBar } from "@/components/buddy/ui";
import { UploadThumb, usePhotoUploads } from "@/components/photo-upload";
import { Banner, Button, Hero, Icon, LinkButton, Spinner, cn, inputCls } from "@/components/ui";
import { MEAL_LIMIT } from "@/lib/codes";
import { ApiError, get, post, won } from "@/lib/api";
import type { BuddyRequest, ListResponse, MealClaim } from "@/lib/types";
import { UPLOAD_ACCEPT } from "@/lib/uploads";

const fieldCls = cn(inputCls, "h-[52px] text-[16px]");

function MealClaimPage() {
  const sp = useSearchParams();
  const [items, setItems] = useState<BuddyRequest[] | null>(null);
  const upload = usePhotoUploads(1);
  const slot = upload.slots[0];
  const receipt = upload.urls[0] ?? null;
  const [place, setPlace] = useState("");
  const [amount, setAmount] = useState(0);
  const [foods, setFoods] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<MealClaim | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    get<ListResponse<BuddyRequest>>("/buddy/schedule").then((r) => setItems(r.items)).catch(() => setItems([]));
  }, []);

  const want = Number(sp.get("item"));
  const eligible = (items ?? []).filter((i) => (i.meal_count ?? 0) > (i.meal_claims ?? 0));
  const item = items?.find((i) => i.item_id === want) ?? eligible[0];
  const used = item?.meal_claims ?? 0, total = item?.meal_count ?? 0;
  const full = !!item && used >= total;
  const over = Math.max(0, amount - MEAL_LIMIT);

  const submit = async () => {
    if (!item) return;
    setBusy(true); setErr(null);
    try { setDone(await post<MealClaim>("/buddy/meal-claims", { item_id: item.item_id, place: place.trim(), items: foods.trim(), amount, receipt_url: receipt })); }
    catch (e) { setErr(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "청구하지 못했어요"); }
    finally { setBusy(false); }
  };

  if (done) {
    return (
      <>
        <Hero back="/buddy" title={<>식비를<br />청구했어요</>} sub={`${done.place} · ${won(done.amount)}. 운영팀이 영수증을 확인하면 활동비와 같이 지급돼요.`} />
        <div className="px-5">{done.over_limit && <Banner variant="warn">한도를 넘은 {won(done.amount - done.limit)}은 여행자가 동의하면 돌려받아요.</Banner>}</div>
        <BottomBar>
          <div className="grid grid-cols-2 gap-2.5">
            <LinkButton href="/buddy" variant="ghost">홈으로</LinkButton>
            <LinkButton href="/buddy/activity">내 활동 보기</LinkButton>
          </div>
        </BottomBar>
      </>
    );
  }

  return (
    <>
      <Hero back="/buddy" title="식비 청구" sub={item ? `${item.tourist.name} · ${krDate(item.date)} · 식사 ${Math.min(used + 1, total)} / ${total}회` : undefined} />
      <LoginGate />
      <div className="px-5 pb-6">
        {items === null && <Spinner />}
        {items && !item && <p className="py-8 text-center text-[15px] leading-relaxed text-muted">식비를 청구할 동행이 없어요.<br />식사 옵션이 있는 확정된 동행만 청구할 수 있어요.</p>}
        {full && <Banner variant="warn" className="mb-4">이 동행의 식사 {total}회를 모두 청구했어요.</Banner>}

        {item && (
          <>
            <input ref={fileRef} type="file" accept={UPLOAD_ACCEPT} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { upload.clear(); upload.add([f]); } e.target.value = ""; }} />
            {slot ? (
              <div className="flex items-center gap-4 rounded-[16px] border-[1.5px] border-navy/40 p-3">
                <UploadThumb slot={slot} onRemove={upload.clear} onRetry={() => upload.retry(slot.key)} className="h-[120px] w-[96px] shrink-0 rounded-[10px]" />
                <div className="min-w-0 flex-1">
                  <div className={cn("text-[16px] font-semibold", slot.error ? "text-red" : "text-ink")}>{slot.error ? "올리지 못했어요" : receipt ? "영수증 사진을 올렸어요" : "올리는 중…"}</div>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">{slot.error ?? "가게 이름, 날짜, 금액이 잘 보이는지 확인해 주세요"}</p>
                  <button type="button" onClick={() => fileRef.current?.click()} className="mt-2 text-[14px] font-semibold text-navy">다른 사진으로 바꾸기</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="flex h-[180px] w-full flex-col items-center justify-center rounded-[16px] border-[1.5px] border-dashed border-[#C9CED3] text-center transition hover:bg-gray-bg">
                <Icon name="camera" className="h-6 w-6 text-ink" />
                <span className="mt-2.5 text-[16px] text-ink">영수증 사진 올리기</span>
                <span className="mt-1 max-w-[80%] truncate text-[14px] text-muted">가게 이름, 날짜, 금액이 보이게 · JPG · PNG · WebP, 10MB까지</span>
              </button>
            )}

            <label className="mt-5 block">
              <span className="mb-2 block text-[14px] font-semibold text-ink">가게</span>
              <input className={fieldCls} value={place} onChange={(e) => setPlace(e.target.value)} placeholder="가게 이름" maxLength={100} />
            </label>
            <label className="mt-5 block">
              <span className="mb-2 block text-[14px] font-semibold text-ink">금액 (2인)</span>
              <input className={fieldCls} inputMode="numeric" value={amount ? won(amount) : ""} placeholder="₩0"
                onChange={(e) => setAmount(Math.min(1_000_000, Number(e.target.value.replace(/\D/g, "")) || 0))} />
            </label>
            <label className="mt-5 block">
              <span className="mb-2 block text-[14px] font-semibold text-ink">먹은 것</span>
              <input className={fieldCls} value={foods} onChange={(e) => setFoods(e.target.value)} placeholder="예: 대추차, 단팥죽" maxLength={200} />
            </label>

            <div className="mt-5 divide-y divide-line">
              <div className="flex items-center justify-between py-3.5 text-[15px]"><span className="text-muted">1회 한도</span><span className="font-bold text-ink">{won(MEAL_LIMIT)}</span></div>
              <div className="flex items-center justify-between py-3.5 text-[15px]">
                <span className="text-muted">이번 청구</span>
                <span className={cn("font-bold", over ? "text-orange" : "text-navy")}>{amount ? `${won(amount)} · ${over ? `한도 ${won(over)} 넘음` : "한도 안"}` : "—"}</span>
              </div>
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">한도를 넘은 금액은 여행자가 동의하면 돌려받아요. 운영팀이 확인한 뒤 활동비와 같이 지급돼요.</p>
            {err && <Banner variant="warn" className="mt-4">{err}</Banner>}
          </>
        )}
      </div>

      {item && (
        <BottomBar note={upload.uploading ? "영수증 사진을 올리는 중이에요" : !receipt ? "영수증 사진을 올려 주세요" : undefined}>
          <Button onClick={submit} disabled={busy || full || !receipt || !place.trim() || amount <= 0}>{busy ? "보내는 중…" : "청구하기"}</Button>
        </BottomBar>
      )}
    </>
  );
}

export default function Page() {
  return <Suspense fallback={<Spinner />}><MealClaimPage /></Suspense>;
}
