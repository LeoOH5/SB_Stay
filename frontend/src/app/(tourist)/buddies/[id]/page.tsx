"use client";
// T10 버디 상세 — BD-02 GET /buddies/{id} (성격·스타일·도와줄 수 있어요, 후기 세부 점수, 최근 활동), GET /buddies/{id}/activities
// 운전 가능은 표시만 (자가용 유상 운송 금지 — 차량 이동 서비스 없음).
// 날짜는 장바구니 숙박(또는 ?from&to) 기간 안에서만. "이 버디로 정하기" → 요청 단계(/buddies/[id]/request)
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button, Chip, DormPhoto, GradeBadge, Icon, PhotoTile, ScoreBar, Spinner, TagChip, TopBar } from "@/components/ui";
import { ErrorBox } from "@/components/tourist";
import { errMsg, INTEREST_LABEL, okv, parseDate } from "@/components/tourist/format";
import { Avatar, BottomBar, InfoRow, SectionHead, TotalLine } from "@/components/tourist/v3";
import { EMPTY_REQUEST, allLangs, buddiesIn, isBuddyRequest, koDay, koDuration, koMD, koRange, readDraft, saveDraft, stayIn } from "@/components/tourist/v3/flow";
import { get, won } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { CAN_HELP, PERSONALITY, REVIEW_TAGS, STYLE, SUB_SCORES, buddyItemPrice, keysOf, label, labels } from "@/lib/codes";
import { mediaSrc } from "@/lib/uploads";
import type { BuddyDetail, ListResponse, PublicActivity, Review } from "@/lib/types";

const TIMES = ["10:00", "14:00", "17:00"];
const DURATION = 120;

function TagGroup({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-3">
      <div className="text-[13.5px] text-muted">{title}</div>
      <div className="mt-2 flex flex-wrap gap-2">{items.map((t) => <TagChip key={t} variant="navy">{t}</TagChip>)}</div>
    </div>
  );
}

function ActivityRow({ a }: { a: PublicActivity }) {
  const photo = mediaSrc(a.photos?.[0]);
  return (
    <div className="flex items-center gap-4 py-4">
      {photo ? <DormPhoto src={photo} className="h-[52px] w-[52px] shrink-0 rounded-[10px] [&_svg]:hidden" /> : <PhotoTile className="h-[52px] w-[52px] shrink-0 rounded-[10px] [&_svg]:hidden" />}
      <div className="min-w-0 flex-1">
        <div className="text-[16px] font-semibold text-ink">{a.places.join(" → ")}</div>
        <div className="mt-1 text-[14px] text-muted">{koMD(a.date)}{a.foods ? ` · ${a.foods}` : ""}</div>
      </div>
    </div>
  );
}

function Detail() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const cart = useCart();
  const cartStay = stayIn(cart.items);
  const from = params.get("from") ?? cartStay?.date_from ?? undefined;
  const to = params.get("to") ?? cartStay?.date_to ?? undefined;
  const [buddy, setBuddy] = useState<BuddyDetail | null>(null);
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [allActs, setAllActs] = useState<PublicActivity[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState("14:00");

  useEffect(() => {
    let alive = true;
    okv(get<BuddyDetail>(`/buddies/${id}`)).then((b) => { if (alive) { setBuddy(b); if (b.reviews) setReviews(b.reviews); } }).catch((e: unknown) => { if (alive) setErr(errMsg(e)); });
    get<ListResponse<Review>>(`/buddies/${id}/reviews`).then((r) => { if (alive) setReviews(r.items); }).catch(() => { /* 후기는 보조 */ });
    return () => { alive = false; };
  }, [id]);

  const loadAll = () => {
    get<ListResponse<PublicActivity>>(`/buddies/${id}/activities`).then((r) => setAllActs(r.items)).catch(() => setAllActs([]));
  };

  const choices = buddy ? buddy.available_dates.filter((d) => !from || !to || (from <= d && d <= to)).slice(0, 8) : [];
  const wanted = params.get("date");
  const picked = date ?? (wanted && choices.includes(wanted) ? wanted : choices[0] ?? null);
  const fee = buddy?.hourly_fee ?? 15000;
  const price = buddyItemPrice(fee, DURATION);

  const choose = () => {
    if (!buddy || !picked) return;
    const prev = readDraft(buddy.id);
    const cartBuddy = buddiesIn(cart.items)[0];
    const courseParam = params.get("course");
    saveDraft({
      buddy_id: buddy.id, date: picked, time,
      course_id: courseParam ? Number(courseParam) : prev?.course_id ?? cartBuddy?.course_id ?? null,
      request: prev?.request ?? (cartBuddy && isBuddyRequest(cartBuddy.request) ? cartBuddy.request : EMPTY_REQUEST),
      meal_count: prev?.meal_count ?? cartBuddy?.meal_count ?? 0,
      album: prev?.album ?? cartBuddy?.album ?? false,
    });
    router.push(`/buddies/${buddy.id}/request`);
  };

  const review = reviews?.[0];
  const acts = allActs ?? buddy?.recent_activities ?? [];
  const reviewDate = review ? `${parseDate(review.created_at.slice(0, 10)).getFullYear()}년 ${parseDate(review.created_at.slice(0, 10)).getMonth() + 1}월` : "";

  return (
    <>
      <TopBar back="/buddies" title="버디" />
      <div className="px-5">
        <ErrorBox message={err} />
        {!buddy && !err && <Spinner />}
      </div>
      {buddy && (
        <div className="px-5">
          <div className="flex items-center gap-5 pt-2">
            <Avatar name={buddy.name} size="lg" />
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-[24px] font-bold leading-tight text-ink">{buddy.name}<GradeBadge grade={buddy.grade} /></h1>
              <div className="mt-1 text-[14.5px] text-muted">{buddy.university} {buddy.major} {buddy.year}학년</div>
              {(buddy.verified.school_email || buddy.verified.residence || buddy.verified.trained) && (
                <div className="mt-1 flex items-center gap-1.5 text-[13.5px] font-semibold text-navy">
                  <span className="h-1.5 w-1.5 rounded-full bg-navy" />
                  {[buddy.verified.school_email && "학교 인증", buddy.verified.residence && "성북구 거주 확인", buddy.verified.trained && "교육 이수"].filter(Boolean).join(" · ")}
                </div>
              )}
            </div>
          </div>
          <p className="mt-5 text-[16px] leading-relaxed text-ink">“{buddy.intro}”</p>

          <SectionHead className="mt-8" title="이런 친구예요" />
          <TagGroup title="성격" items={labels(PERSONALITY, buddy.personality)} />
          <TagGroup title="같이 다니는 스타일" items={labels(STYLE, buddy.style)} />
          <TagGroup title="도와줄 수 있어요" items={labels(CAN_HELP, buddy.can_help)} />
          <div className="mt-4 divide-y divide-line">
            <InfoRow label="쓰는 말">{allLangs(buddy.languages)}</InfoRow>
            {buddy.interests.length > 0 && <InfoRow label="좋아하는 것">{buddy.interests.map((i) => INTEREST_LABEL[i] ?? i).join(", ")}</InfoRow>}
            <InfoRow label="동행">{buddy.walk_count}회</InfoRow>
            {buddy.can_drive && (
              <InfoRow label="운전">
                <TagChip variant="outline">운전 가능</TagChip>
                <span className="mt-1 block text-[13px] font-normal text-muted">차량 이동 서비스는 제공하지 않아요</span>
              </InfoRow>
            )}
          </div>

          <div className="mt-8 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-[18px] font-bold text-ink">후기
              {buddy.review_count > 0 && <><Icon name="star" className="h-[18px] w-[18px] fill-orange text-orange" />{buddy.rating.toFixed(1)}</>}
            </h2>
            <span className="text-[14px] text-muted">{buddy.review_count}개</span>
          </div>
          {buddy.review_count === 0 && <p className="mt-2 text-[14.5px] text-muted">아직 후기가 없는 새 버디예요.</p>}
          {buddy.sub_scores && (
            <div className="mt-3 space-y-3">
              {keysOf(SUB_SCORES).map((k) => <ScoreBar key={k} label={label(SUB_SCORES, k)} value={buddy.sub_scores![k]} />)}
            </div>
          )}
          {review && (
            <div className="mt-5">
              <p className="text-[15.5px] leading-relaxed text-ink">“{review.text}”</p>
              {(review.tags?.length ?? 0) > 0 && <div className="mt-2.5 flex flex-wrap gap-2">{labels(REVIEW_TAGS, review.tags).map((t) => <TagChip key={t}>{t}</TagChip>)}</div>}
              <p className="mt-2 text-[13.5px] text-muted">{review.author} · {reviewDate}</p>
            </div>
          )}

          {acts.length > 0 && (
            <>
              <SectionHead className="mt-9" title="최근 활동" right={allActs ? undefined : <button type="button" onClick={loadAll} className="font-semibold text-ink">전체</button>} />
              <div className="mt-1 divide-y divide-line">{acts.map((a, i) => <ActivityRow key={`${a.date}-${i}`} a={a} />)}</div>
            </>
          )}

          <SectionHead className="mt-8" title="언제 만날까요" right={from && to ? `숙박 ${koRange(from, to)} 안에서` : undefined} />
          {choices.length === 0 ? (
            <p className="mt-3 text-[14.5px] text-orange-ink">{from && to ? "이 버디는 숙박 기간에 시간이 없어요. 다른 버디를 골라 주세요." : "지금 비어 있는 날이 없어요."}</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">{choices.map((d) => <Chip key={d} selected={picked === d} onClick={() => setDate(d)}>{koDay(d)}</Chip>)}</div>
          )}
          <div className="mb-6 mt-3 flex flex-wrap gap-2">{TIMES.map((t) => <Chip key={t} selected={time === t} onClick={() => setTime(t)}>{t}</Chip>)}</div>

          <BottomBar>
            <TotalLine label={`${koDuration(DURATION)} 동행`} amount={won(price)} />
            <p className="mt-1 text-[13px] text-muted">다음 단계에서 요청 사항과 식사·사진 옵션을 골라요</p>
            <Button className="mt-3" onClick={choose} disabled={!picked}>이 버디로 정하기</Button>
          </BottomBar>
        </div>
      )}
    </>
  );
}

export default function BuddyDetailPage() {
  return <Suspense fallback={<Spinner />}><Detail /></Suspense>;
}
