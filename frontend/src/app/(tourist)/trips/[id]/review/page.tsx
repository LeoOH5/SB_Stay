"use client";
// T20 후기 쓰기 — GET /bookings/{id}, BK-08 POST /bookings/{id}/reviews {item_id, rating, text, sub_scores, tags}
// 409 TRIP_NOT_DONE(여행 전) · ALREADY_REVIEWED 는 안내 화면으로 보여 준다
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ErrorBox, textareaCls } from "@/components/tourist";
import { errMsg, itemTitle } from "@/components/tourist/format";
import { ActionBar, Avatar, StarRow, buddyNameOf, hoursLabel, krDate, krRange, useBooking, wa } from "@/components/tourist/trips/util";
import { Banner, Button, Chip, LinkButton, Spinner, TopBar } from "@/components/ui";
import { REVIEW_TAGS, SUB_SCORES, keysOf, label } from "@/lib/codes";
import { ApiError, post } from "@/lib/api";
import { tr, useLang, curLang } from "@/lib/i18n";
import type { ReviewTag, SubScoreKey, SubScores } from "@/lib/types";

const RATING_WORD = ["", "아쉬웠어요", "그저 그랬어요", "괜찮았어요", "좋았어요", "최고였어요"];
const RATING_WORD_EN = ["", "Disappointing", "So-so", "Okay", "Good", "Amazing"];

function ReviewPage() {
  const { lang } = useLang();
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
      <TopBar back="/trips" right={item && !state && !done ? <span className="text-muted">{tr("여행이 끝났어요", "Trip finished")}</span> : undefined} />
      {loadErr && <ErrorBox message={loadErr} className="mx-5 mt-2" />}
      {!booking && !loadErr && <Spinner />}
      {booking && !item && <p className="px-5 py-10 text-center text-[15px] text-muted">{tr("후기를 남길 항목이 없어요.", "Nothing to review.")}</p>}

      {item && (
        <div className="px-5 pt-1">
          <div className="flex items-center gap-3.5">
            <Avatar name={name} />
            <div className="min-w-0">
              <div className="text-[16px] font-semibold text-ink">{itemTitle(item.title)}</div>
              <div className="mt-0.5 text-[14px] text-muted">{isBuddy ? `${krDate(item.date_from)}, ${hoursLabel(item.duration_min)}` : krRange(item.date_from, item.date_to)}</div>
            </div>
          </div>
        </div>
      )}

      {item && done && (
        <div className="px-5 pt-8">
          <h1 className="text-[24px] font-bold leading-snug text-ink">{lang === "en" ? <>Review posted.<br />Thank you!</> : <>후기를 올렸어요.<br />고마워요!</>}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">{isBuddy ? tr(`${name}의 프로필과 다른 여행자들이 버디를 고를 때 보여요.`, `It appears on ${name}'s profile and helps other travelers pick a buddy.`) : tr("다른 여행자들이 숙소를 고를 때 보여요.", "It helps other travelers pick a stay.")}</p>
          <LinkButton href="/trips" className="mt-8">{tr("내 여행으로", "Go to My trips")}</LinkButton>
        </div>
      )}

      {item && !done && state && (
        <div className="px-5 pt-8">
          <h1 className="text-[24px] font-bold leading-snug text-ink">{state === "ALREADY_REVIEWED" ? tr("이미 후기를 남겼어요", "You already left a review") : tr("아직 후기를 쓸 수 없어요", "You can't review yet")}</h1>
          <Banner variant={state === "ALREADY_REVIEWED" ? "info" : "warn"} icon={state === "ALREADY_REVIEWED" ? "check" : "clock"} className="mt-4">
            {state === "ALREADY_REVIEWED"
              ? tr("한 동행에 후기는 한 번만 쓸 수 있어요.", "You can review each walk only once.")
              : tr(`후기는 동행이 끝난 뒤에만 쓸 수 있어요. ${krDate(item.date_from)}${isBuddy ? ` ${name}${wa(name)} 걷고 나면` : " 체크인 뒤에"} 여기서 남겨 주세요.`, `Reviews open after the walk. Come back here after ${isBuddy ? `walking with ${name} on ${krDate(item.date_from)}` : `check-in on ${krDate(item.date_from)}`}.`)}
          </Banner>
          <LinkButton href="/trips" variant="secondary" className="mt-8">{tr("내 여행으로", "Go to My trips")}</LinkButton>
        </div>
      )}

      {item && !done && !state && (
        <>
          <div className="px-5">
            <h1 className="mt-7 text-[22px] font-bold leading-snug text-ink">{isBuddy ? tr(`${name}${wa(name)}의 시간은 어땠나요?`, `How was your time with ${name}?`) : tr("숙박은 어땠나요?", "How was your stay?")}</h1>
            <div className="mt-5 flex items-center gap-4">
              <StarRow value={rating} onChange={setRating} size="h-9 w-9" gap="gap-2.5" label={tr("전체 별점", "Overall rating")} />
            </div>
            <p className="mt-2 text-[14px] font-semibold text-orange-ink">{(lang === "en" ? RATING_WORD_EN : RATING_WORD)[rating]}</p>

            {isBuddy && (
              <>
                <h2 className="mt-8 text-[17px] font-bold text-ink">{tr("자세히", "Details")}</h2>
                <div className="mt-1 divide-y divide-line">
                  {keysOf(SUB_SCORES).map((k: SubScoreKey) => (
                    <div key={k} className="flex h-[52px] items-center justify-between">
                      <span className="text-[16px] text-ink">{label(SUB_SCORES, k, curLang())}</span>
                      <StarRow value={subs[k]} onChange={(v) => setSubs((s) => ({ ...s, [k]: v }))} size="h-[22px] w-[22px]" gap="gap-2" label={label(SUB_SCORES, k, curLang())} />
                    </div>
                  ))}
                </div>

                <h2 className="mt-8 text-[17px] font-bold text-ink">{tr("좋았던 점", "What you liked")}</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {keysOf(REVIEW_TAGS).map((t) => (
                    <Chip key={t} selected={tags.includes(t)} onClick={() => setTags((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]))}>{label(REVIEW_TAGS, t, curLang())}</Chip>
                  ))}
                </div>
              </>
            )}

            <textarea className={`${textareaCls} mt-6 min-h-[96px] text-[15px]`} placeholder={isBuddy ? tr("기억에 남는 순간을 적어 주세요 (선택)", "Share a moment you remember (optional)") : tr("방, 체크인, 주변은 어땠나요? (선택)", "How were the room, check-in and area? (optional)")} value={text} maxLength={500} onChange={(e) => setText(e.target.value)} aria-label={tr("후기 내용", "Review text")} />
            <ErrorBox message={err} className="mt-3" />
          </div>
          <ActionBar note={tr("후기는 동행이 끝난 뒤에만 쓸 수 있어요", "Reviews open after the walk")}>
            <Button onClick={submit} disabled={busy}>{busy ? tr("올리는 중…", "Posting…") : tr("후기 올리기", "Post review")}</Button>
          </ActionBar>
        </>
      )}
    </>
  );
}

export default function Page() {
  return <Suspense fallback={<Spinner />}><ReviewPage /></Suspense>;
}
