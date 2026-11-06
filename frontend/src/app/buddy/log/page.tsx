"use client";
// B12 활동 기록 — GET /buddy/schedule(동행), GET /tours/{course_id}(코스 장소), POST /buddy/activities {item_id, date, places, foods, note, photos}
// 사진은 실제 업로드 없이 고른 파일 이름만 기록한다 (데모). 기록은 내 프로필 '최근 활동'과 여행자 앨범(앨범 옵션)에 올라간다.
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { DEMO_TODAY, krDate } from "@/components/buddy/format";
import { LoginGate } from "@/components/buddy/login-gate";
import { BottomBar, PhotoPlaceholder, usePlaceNames } from "@/components/buddy/ui";
import { Banner, Button, Chip, Hero, Icon, LinkButton, Spinner, cn, inputCls } from "@/components/ui";
import { get, post } from "@/lib/api";
import type { Activity, BuddyRequest, ListResponse, Tour } from "@/lib/types";

const SHOWN = 4;

function LogPage() {
  const sp = useSearchParams();
  const names = usePlaceNames();
  const [items, setItems] = useState<BuddyRequest[] | null>(null);
  const [course, setCourse] = useState<Tour | null>(null);
  const [picked, setPicked] = useState<string[] | null>(null);
  const [extra, setExtra] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [newPlace, setNewPlace] = useState("");
  const [foods, setFoods] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<Activity | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    get<ListResponse<BuddyRequest>>("/buddy/schedule").then((r) => setItems(r.items)).catch(() => setItems([]));
  }, []);
  const want = Number(sp.get("item"));
  const item = items?.find((i) => i.item_id === want) ?? (want ? undefined : items?.filter((i) => i.date <= DEMO_TODAY).sort((a, b) => b.date.localeCompare(a.date))[0]);

  useEffect(() => {
    if (!item?.course_id) return;
    let alive = true;
    get<Tour>(`/tours/${item.course_id}`).then((t) => { if (alive) setCourse(t); }).catch(() => { /* 제안 장소만 줄어듦 */ });
    return () => { alive = false; };
  }, [item?.course_id]);

  const coursePlaces = course?.places.map((p) => p.name) ?? [];
  const wished = (item?.request?.places ?? []).map((id) => names[id]).filter((n): n is string => !!n);
  const options = [...new Set([...coursePlaces, ...wished, ...extra])];
  const sel = picked ?? coursePlaces; // 처음엔 코스 장소를 골라 둔다
  const toggle = (p: string) => setPicked(sel.includes(p) ? sel.filter((x) => x !== p) : [...sel, p]);
  const addPlace = () => {
    const p = newPlace.trim();
    if (p) { setExtra((e) => (e.includes(p) ? e : [...e, p])); setPicked([...sel.filter((x) => x !== p), p]); }
    setNewPlace(""); setAdding(false);
  };

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      setDone(await post<Activity>("/buddy/activities", {
        item_id: item?.item_id ?? null, date: item?.date ?? DEMO_TODAY, places: sel, foods: foods.trim() || undefined, note: note.trim() || undefined,
        photos: photos.map((f) => `uploads/${f}`),
      }));
    } catch (e) { setErr(e instanceof Error ? e.message : "올리지 못했어요"); }
    finally { setBusy(false); }
  };

  if (done) {
    return (
      <>
        <Hero back="/buddy" title={<>기록을<br />올렸어요</>} sub={`${krDate(done.date)} · ${done.places.join(", ")}${item?.album ? ` · 사진 ${done.photos.length}장이 ${item.tourist.name.split(" ")[0]}의 앨범에 들어가요` : ""}`} />
        <BottomBar><LinkButton href="/buddy">홈으로</LinkButton></BottomBar>
      </>
    );
  }

  return (
    <>
      <Hero back="/buddy" title={<>오늘 어디를<br />다녀왔나요?</>} sub="내 프로필의 ‘최근 활동’과 여행자의 앨범에 올라가요." />
      <LoginGate />
      <div className="px-5 pb-6">
        {items === null ? <Spinner /> : (
          <>
            {item && <p className="mb-5 text-[14px] text-muted">{item.tourist.name} · {krDate(item.date)}{item.course_title ? ` · ${item.course_title}` : ""}</p>}
            {want > 0 && !item && <Banner variant="warn" className="mb-5">이 동행을 찾지 못했어요. 동행 없이 기록으로 남겨요.</Banner>}

            <div className="mb-2.5 text-[14px] font-semibold text-ink">다녀온 곳</div>
            <div className="flex flex-wrap gap-2">
              {options.map((p) => <Chip key={p} selected={sel.includes(p)} onClick={() => toggle(p)}>{p}</Chip>)}
              {adding ? (
                <form onSubmit={(e) => { e.preventDefault(); addPlace(); }} className="flex items-center gap-1.5">
                  <input autoFocus className="h-10 w-36 rounded-full border border-navy px-4 text-[14px] text-ink focus:outline-none" placeholder="장소 이름" value={newPlace} onChange={(e) => setNewPlace(e.target.value)} onBlur={addPlace} maxLength={40} />
                </form>
              ) : (
                <Chip onClick={() => setAdding(true)} className="text-muted">+ 추가</Chip>
              )}
            </div>

            <label className="mt-6 block">
              <span className="mb-2 block text-[14px] font-semibold text-ink">먹은 것</span>
              <input className={cn(inputCls, "h-[52px] text-[16px]")} value={foods} onChange={(e) => setFoods(e.target.value)} placeholder="예: 대추차, 단팥죽" maxLength={200} />
            </label>

            <div className="mb-2.5 mt-6 text-[14px] font-semibold text-ink">사진 <span className="font-normal text-muted">{item?.album ? "앨범 옵션 · " : ""}{photos.length}장</span></div>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { const fs = [...(e.target.files ?? [])].map((f) => f.name); setPhotos((p) => [...p, ...fs].slice(0, 20)); e.target.value = ""; }} />
            <div className="grid grid-cols-5 gap-1.5">
              {photos.slice(0, SHOWN).map((f, i) => (
                <PhotoPlaceholder key={f + i} className="aspect-square overflow-hidden rounded-[8px]">
                  <button type="button" onClick={() => setPhotos((p) => p.filter((_, k) => k !== i))} aria-label={`${f} 빼기`} className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/45 text-white"><Icon name="x" className="h-3 w-3" strokeWidth={2.4} /></button>
                </PhotoPlaceholder>
              ))}
              <button type="button" onClick={() => fileRef.current?.click()} aria-label="사진 더하기"
                className="flex aspect-square items-center justify-center rounded-[8px] border-[1.5px] border-dashed border-[#C9CED3] text-[15px] text-muted hover:bg-gray-bg">
                {photos.length > SHOWN ? `+${photos.length - SHOWN}` : <Icon name="plus" className="h-5 w-5" />}
              </button>
            </div>

            <label className="mt-6 block">
              <span className="mb-2 block text-[14px] font-semibold text-ink">여행자에게 한마디 <span className="font-normal text-muted">선택</span></span>
              <textarea className="min-h-[88px] w-full rounded-[12px] border border-line bg-white px-4 py-3 text-[16px] leading-relaxed text-ink placeholder:text-muted focus:border-navy focus:outline-none" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="함께 걸은 소감을 남겨 주세요" />
            </label>
            {err && <Banner variant="warn" className="mt-4">{err}</Banner>}
          </>
        )}
      </div>
      <BottomBar note={sel.length === 0 ? "다녀온 곳을 하나 이상 골라 주세요" : undefined}>
        <Button onClick={submit} disabled={busy || items === null || sel.length === 0}>{busy ? "올리는 중…" : "기록 올리기"}</Button>
      </BottomBar>
    </>
  );
}

export default function Page() {
  return <Suspense fallback={<Spinner />}><LogPage /></Suspense>;
}
