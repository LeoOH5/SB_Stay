"use client";
// T4c 버디 상세 — BD-02 GET /buddies/{id}, 리뷰 GET /buddies/{id}/reviews, 동행 요청(장바구니)
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Card, Chip, Hero, SectionTitle, Spinner, TopBar } from "@/components/ui";
import { ErrorBox, Notice, Stars } from "@/components/tourist";
import { errMsg, interestsLabel, langsShort, md, okv } from "@/components/tourist/format";
import { get, won } from "@/lib/api";
import { useCart } from "@/lib/cart";
import type { Buddy, ListResponse, Review } from "@/lib/types";

const TIMES = ["10:00", "14:00", "17:00"];
const HOURS = 2;

export default function BuddyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const cart = useCart();
  const [buddy, setBuddy] = useState<Buddy | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState("14:00");

  useEffect(() => {
    let alive = true;
    okv(get<Buddy>(`/buddies/${id}`)).then((b) => { if (alive) { setBuddy(b); setDate(b.available_dates[0] ?? ""); } }).catch((e: unknown) => { if (alive) setErr(errMsg(e)); });
    get<ListResponse<Review>>(`/buddies/${id}/reviews`).then((r) => { if (alive) setReviews(r.items); }).catch(() => { /* 리뷰는 선택 */ });
    return () => { alive = false; };
  }, [id]);

  const fee = (buddy?.hourly_fee ?? 15000) * HOURS;
  const request = () => {
    if (!buddy || !date) return;
    cart.add({ type: "buddy", ref_id: buddy.id, title: `${buddy.name}와 동네 걷기`, meta: `${md(date)} ${time} · ${HOURS}시간`, price: fee, date, time, duration_min: HOURS * 60 });
    router.push("/cart");
  };

  return (
    <>
      <TopBar back="/buddies" title="버디 상세" />
      <Hero title={buddy ? `${buddy.name} · ${buddy.university.replace("학교", "")} ${buddy.major} ${buddy.year}학년` : "버디 상세"} sub={buddy ? `${langsShort(buddy.languages)} · ★ ${buddy.rating} (${buddy.review_count})` : undefined} />
      <div className="px-5 pb-6 pt-4 space-y-3">
        <ErrorBox message={err} />
        {!buddy && !err && <Spinner />}
        {buddy && (
          <>
            <Card accent="green">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 shrink-0 rounded-full bg-navy-bg flex items-center justify-center text-[18px] font-semibold text-navy">{buddy.name[0]}</div>
                <p className="text-[13px] text-ink leading-relaxed">&quot;{buddy.intro}&quot;</p>
              </div>
              <div className="mt-3 text-[12px] text-muted">관심사  {interestsLabel(buddy.interests)}</div>
              <div className="mt-1 text-[12px] text-muted">가능 날짜  {buddy.available_dates.map(md).join(", ")}</div>
              <div className="mt-2 flex items-center gap-2 text-[12px] text-muted"><Stars value={Math.round(buddy.rating)} size="text-[12px]" /> {buddy.rating} ({buddy.review_count})</div>
              {reviews.map((r) => <div key={r.id} className="mt-1 text-[12px] text-muted">&quot;{r.text}&quot; – {r.author}</div>)}
              <Notice className="mt-3">동행 프로그램 · {HOURS}시간 · {won(fee)} (활동비)</Notice>
              <Notice className="mt-1">버디 수락 후 확정됩니다.</Notice>
            </Card>

            <SectionTitle>날짜 선택</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {buddy.available_dates.map((d) => <Chip key={d} selected={date === d} onClick={() => setDate(d)}>{md(d)}</Chip>)}
            </div>
            <SectionTitle>시간</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {TIMES.map((t) => <Chip key={t} selected={time === t} onClick={() => setTime(t)}>{t}</Chip>)}
            </div>
            <p className="text-[12px] text-muted">버디는 &apos;가이드&apos;가 아니라 문화교류 동행이에요. 역사 해설은 해설사·AI가 해요.</p>
            <Button onClick={request} disabled={!date}>동행 요청 (장바구니)</Button>
          </>
        )}
      </div>
    </>
  );
}
