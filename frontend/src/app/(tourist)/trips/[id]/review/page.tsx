"use client";
// T20 후기 쓰기 — GET /bookings/{id}, BK-08 POST /bookings/{id}/reviews {item_id, rating, text, sub_scores, tags}
// 409 TRIP_NOT_DONE(여행 전) · ALREADY_REVIEWED 는 안내 화면으로 보여 준다
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ErrorBox, textareaCls } from "@/components/tourist";
import { errMsg } from "@/components/tourist/format";
import { ActionBar, Avatar, StarRow, buddyNameOf, hoursLabel, krDate, krRange, useBooking, wa } from "@/components/tourist/trips/util";
import { Banner, Button, Chip, LinkButton, Spinner, TopBar } from "@/components/ui";
import { REVIEW_TAGS, SUB_SCORES, keysOf, label } from "@/lib/codes";
import { ApiError, post } from "@/lib/api";
import type { ReviewTag, SubScoreKey, SubScores } from "@/lib/types";

const RATING_WORD = ["", "아쉬웠어요", "그저 그랬어요", "괜찮았어요", "좋았어요", "최고였어요"];

function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const { booking, err: loadErr } = useBooking(id);
  const [rating, setRating] = useState(5);
  const [subs, setSubs] = useState<SubScores>({ kind: 5, talk: 5, punctual: 5, local: 5 });
  const [tags, setTags] = useState<ReviewTag[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<"TRIP_NOT_DONE" | "ALREADY_REVIEWED" | null>(null);
  const [done, setDone] = useState(false);

  const itemParam = Number(sp.get("item"));
  const item = booking?.items.find((i) => i.id === itemParam) ?? booking?.items.find((i) => i.type === "buddy" && i.can_review) ?? booking?.items.find((i) => i.type === "buddy");
  const isBuddy = item?.type === "buddy";
  const name = item ? (isBuddy ? buddyNameOf(item) : item.title) : "";
  // 서버 응답 전에도 can_review / reviewed 로 미리 막는다
  const state = blocked ?? (item?.reviewed ? "ALREADY_REVIEWED" : item && !item.can_review ? "TRIP_NOT_DONE" : null);

  const submit = async () => {
    if (!booking || !item) return;
    setBusy(true); setErr(null);
    try {
      await post(`/bookings/${booking.id}/reviews`, { item_id: item.id, rating, text: text.trim(), ...(isBuddy ? { sub_scores: subs, tags } : {}) });
      setDone(true);
    } catch (e) {
      if (e instanceof ApiError && (e.code === "TRIP_NOT_DONE" || e.code === "ALREADY_REVIEWED")) setBlocked(e.code);
      else setErr(errMsg(e));
    } finally { setBusy(false); }
  };

  return (
    <>
      <TopBar back="/trips" right={item && !state && !done ? <span className="text-muted">여행이 끝났어요</span> : undefined} />
      {loadErr && <ErrorBox message={loadErr} className="mx-5 mt-2" />}
      {!booking && !loadErr && <Spinner />}
      {booking && !item && <p className="px-5 py-10 text-center text-[15px] text-muted">후기를 남길 항목이 없어요.</p>}

      {item && (
        <div className="px-5 pt-1">
          <div className="flex items-center gap-3.5">
            <Avatar name={name} />
            <div className="min-w-0">
              <div className="text-[16px] font-semibold text-ink">{item.title}</div>
              <div className="mt-0.5 text-[14px] text-muted">{isBuddy ? `${krDate(item.date_from)}, ${hoursLabel(item.duration_min)}` : krRange(item.date_from, item.date_to)}</div>
            </div>
          </div>
        </div>
      )}

      {item && done && (
        <div className="px-5 pt-8">
          <h1 className="text-[24px] font-bold leading-snug text-ink">후기를 올렸어요.<br />고마워요!</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">{isBuddy ? `${name}의 프로필과 다른 여행자들이 버디를 고를 때 보여요.` : "다른 여행자들이 숙소를 고를 때 보여요."}</p>
          <LinkButton href="/trips" className="mt-8">내 여행으로</LinkButton>
        </div>
      )}

      {item && !done && state && (
        <div className="px-5 pt-8">
          <h1 className="text-[24px] font-bold leading-snug text-ink">{state === "ALREADY_REVIEWED" ? "이미 후기를 남겼어요" : "아직 후기를 쓸 수 없어요"}</h1>
          <Banner variant={state === "ALREADY_REVIEWED" ? "info" : "warn"} icon={state === "ALREADY_REVIEWED" ? "check" : "clock"} className="mt-4">
            {state === "ALREADY_REVIEWED"
              ? "한 동행에 후기는 한 번만 쓸 수 있어요."
              : `후기는 동행이 끝난 뒤에만 쓸 수 있어요. ${krDate(item.date_from)}${isBuddy ? ` ${name}${wa(name)} 걷고 나면` : " 체크인 뒤에"} 여기서 남겨 주세요.`}
          </Banner>
          <LinkButton href="/trips" variant="secondary" className="mt-8">내 여행으로</LinkButton>
        </div>
      )}

      {item && !done && !state && (
        <>
          <div className="px-5">
            <h1 className="mt-7 text-[22px] font-bold leading-snug text-ink">{isBuddy ? `${name}${wa(name)}의 시간은 어땠나요?` : "숙박은 어땠나요?"}</h1>
            <div className="mt-5 flex items-center gap-4">
              <StarRow value={rating} onChange={setRating} size="h-9 w-9" gap="gap-2.5" label="전체 별점" />
            </div>
            <p className="mt-2 text-[14px] font-semibold text-orange-ink">{RATING_WORD[rating]}</p>

            {isBuddy && (
              <>
                <h2 className="mt-8 text-[17px] font-bold text-ink">자세히</h2>
                <div className="mt-1 divide-y divide-line">
                  {keysOf(SUB_SCORES).map((k: SubScoreKey) => (
                    <div key={k} className="flex h-[52px] items-center justify-between">
                      <span className="text-[16px] text-ink">{label(SUB_SCORES, k)}</span>
                      <StarRow value={subs[k]} onChange={(v) => setSubs((s) => ({ ...s, [k]: v }))} size="h-[22px] w-[22px]" gap="gap-2" label={label(SUB_SCORES, k)} />
                    </div>
                  ))}
                </div>

                <h2 className="mt-8 text-[17px] font-bold text-ink">좋았던 점</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {keysOf(REVIEW_TAGS).map((t) => (
                    <Chip key={t} selected={tags.includes(t)} onClick={() => setTags((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]))}>{label(REVIEW_TAGS, t)}</Chip>
                  ))}
                </div>
              </>
            )}

            <textarea className={`${textareaCls} mt-6 min-h-[96px] text-[15px]`} placeholder={isBuddy ? "기억에 남는 순간을 적어 주세요 (선택)" : "방, 체크인, 주변은 어땠나요? (선택)"} value={text} maxLength={500} onChange={(e) => setText(e.target.value)} aria-label="후기 내용" />
            <ErrorBox message={err} className="mt-3" />
          </div>
          <ActionBar note="후기는 동행이 끝난 뒤에만 쓸 수 있어요">
            <Button onClick={submit} disabled={busy}>{busy ? "올리는 중…" : "후기 올리기"}</Button>
          </ActionBar>
        </>
      )}
    </>
  );
}

export default function Page() {
  return <Suspense fallback={<Spinner />}><ReviewPage /></Suspense>;
}
