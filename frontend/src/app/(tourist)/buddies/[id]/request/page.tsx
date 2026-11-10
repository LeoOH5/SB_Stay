"use client";
// T18 버디에게 미리 알릴 요청 — 식단·알레르기(각각 '기타' 직접 입력 40자)·걷는 속도·같이 걸을 코스(TR-01)·더 가 보고 싶은 곳(최대 3, GET /places)·메모(300자)
// 상태는 sessionStorage 초안(버디 상세에서 시작)에 두고 다음 단계(식사·사진)로 넘긴다
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Chip, Icon, Spinner, TopBar, inputCls } from "@/components/ui";
import { BottomSheet, ErrorBox, textareaCls } from "@/components/tourist";
import { errMsg, okv } from "@/components/tourist/format";
import { useSS } from "@/components/tourist/session";
import { BottomBar, FieldLabel, Headline, Segmented, useHydrated } from "@/components/tourist/v3";
import { SS_BUDDY_DRAFT, koMD, saveDraft, wa, type BuddyDraft } from "@/components/tourist/v3/flow";
import { get } from "@/lib/api";
import { ALLERGIES, DIET, PACE, REQUEST_NOTE_MAX, REQUEST_OTHER_MAX, REQUEST_PLACES_MAX, keysOf, label } from "@/lib/codes";
import { tr, useLang } from "@/lib/i18n";
import { personName } from "@/lib/i18n-data";
import type { Allergy, Buddy, BuddyRequestBody, Diet, ListResponse, Pace, Place, Tour } from "@/lib/types";

const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((v) => v !== x) : [...xs, x]);

/** '기타' 직접 입력 한 줄 — 칩을 누르면 열리고(값 "" 부터), 다시 누르면 닫히며 지운다(null) */
function OtherInput({ value, onChange, placeholder, label: aria }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  return (
    <input className={`${inputCls} mt-2.5`} value={value} maxLength={REQUEST_OTHER_MAX} placeholder={placeholder} aria-label={aria} autoFocus={!value}
      onChange={(e) => onChange(e.target.value.replace(/[\r\n]/g, " ").slice(0, REQUEST_OTHER_MAX))} />
  );
}

export default function BuddyRequestPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { lang } = useLang();
  const stored = useSS<BuddyDraft | null>(SS_BUDDY_DRAFT, null);
  const draft = stored && stored.buddy_id === Number(id) ? stored : null;
  const [buddy, setBuddy] = useState<Buddy | null>(null);
  const [courses, setCourses] = useState<Tour[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [placeSheet, setPlaceSheet] = useState(false);
  const hydrated = useHydrated();

  useEffect(() => {
    let alive = true;
    okv(get<Buddy>(`/buddies/${id}`)).then((b) => { if (alive) setBuddy(b); }).catch((e: unknown) => { if (alive) setErr(errMsg(e)); });
    get<ListResponse<Tour>>("/tours").then((r) => { if (alive) setCourses(r.items); }).catch(() => { /* 코스 없이도 진행 */ });
    get<ListResponse<Place>>("/places").then((r) => { if (alive) setPlaces(r.items); }).catch(() => { /* 장소 없이도 진행 */ });
    return () => { alive = false; };
  }, [id]);

  if (!hydrated) return <Spinner />;
  if (!draft) {
    return (
      <>
        <TopBar back={`/buddies/${id}`} />
        <div className="px-5 py-10 text-center">
          <p className="text-[15px] text-muted">{tr("버디와 만날 날짜를 먼저 골라 주세요.", "Please pick a date with your buddy first.")}</p>
          <Link href={`/buddies/${id}`} className="mt-3 inline-flex items-center gap-0.5 text-[15px] font-semibold text-navy">{tr("버디 보러 가기", "Go to buddy")}<Icon name="chevron-right" className="h-4 w-4" strokeWidth={2.4} /></Link>
        </div>
      </>
    );
  }

  const r = draft.request;
  const setReq = (patch: Partial<BuddyRequestBody>) => saveDraft({ ...draft, request: { ...r, ...patch } });
  const setCourse = (course_id: number | null) => saveDraft({ ...draft, course_id });
  const placeName = (pid: number) => { const p = places.find((x) => x.id === pid); return p ? (lang === "en" ? p.name_en : p.name) : ""; };
  const course = courses.find((c) => c.id === draft.course_id);
  // 고른 코스를 맨 앞에, 나머지 코스 둘까지
  const courseChips = [...(course ? [course] : []), ...courses.filter((c) => c.id !== draft.course_id)].slice(0, 3);
  // 더 가 보고 싶은 곳 제안: 고른 코스에 없는 장소
  const suggest = places.filter((p) => !r.places.includes(p.id) && !course?.places.some((cp) => cp.id === p.id)).slice(0, r.places.length >= REQUEST_PLACES_MAX ? 0 : 1);
  const full = r.places.length >= REQUEST_PLACES_MAX;
  // '기타' 칩: 값이 문자열이면(빈 칸 포함) 입력란이 열려 있다
  const dietOtherOpen = typeof r.diet_other === "string";
  const allergyOtherOpen = typeof r.allergy_other === "string";
  const otherLabel = lang === "en" ? "Other" : "기타";

  return (
    <>
      <TopBar back={`/buddies/${id}`} right={buddy ? <span className="text-muted">{tr(`${personName(buddy.name)}${wa(buddy.name)} ${koMD(draft.date)}`, `${personName(buddy.name)} · ${koMD(draft.date)}`)}</span> : undefined} />
      <Headline className="pt-2" title={buddy ? tr(`${personName(buddy.name)}에게\n미리 알려 주세요`, `Tell ${personName(buddy.name)}\nin advance`) : tr("버디에게\n미리 알려 주세요", "Tell your buddy\nin advance")} sub={tr("버디와 운영팀만 봐요. 식당과 길을 고를 때 써요.", "Only your buddy and our team see this. It helps them pick places to eat and routes.")} />
      <div className="px-5 pb-6 pt-6">
        <ErrorBox message={err} />
        {!buddy && !err && <Spinner />}

        <FieldLabel>{tr("먹지 않는 것", "Foods I don't eat")}</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {keysOf(DIET).map((k) => <Chip key={k} selected={r.diet.includes(k)} onClick={() => setReq({ diet: toggle<Diet>(r.diet, k) })}>{label(DIET, k, lang)}</Chip>)}
          <Chip selected={dietOtherOpen} onClick={() => setReq({ diet_other: dietOtherOpen ? null : "" })}>{otherLabel}</Chip>
        </div>
        {dietOtherOpen && <OtherInput value={r.diet_other ?? ""} onChange={(v) => setReq({ diet_other: v })} placeholder={lang === "en" ? "e.g. cilantro, sesame" : "예: 고수, 참깨"} label={lang === "en" ? "Other foods to avoid" : "먹지 않는 것 기타"} />}

        <FieldLabel className="mt-6">{tr("알레르기", "Allergies")}</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {keysOf(ALLERGIES).map((k) => <Chip key={k} selected={r.allergies.includes(k)} onClick={() => setReq({ allergies: toggle<Allergy>(r.allergies, k) })}>{label(ALLERGIES, k, lang)}</Chip>)}
          <Chip selected={allergyOtherOpen} onClick={() => setReq({ allergy_other: allergyOtherOpen ? null : "" })}>{otherLabel}</Chip>
        </div>
        {allergyOtherOpen && <OtherInput value={r.allergy_other ?? ""} onChange={(v) => setReq({ allergy_other: v })} placeholder={lang === "en" ? "e.g. peach" : "예: 복숭아"} label={lang === "en" ? "Other allergies" : "알레르기 기타"} />}

        <FieldLabel className="mt-6">{tr("걷는 속도", "Walking pace")}</FieldLabel>
        <Segmented<Pace> value={r.pace} onChange={(pace) => setReq({ pace })} options={keysOf(PACE).map((k) => ({ value: k, label: label(PACE, k, lang) }))} />

        <FieldLabel className="mt-6" extra={tr("선택", "Optional")}>{tr("같이 걸을 코스", "Walk to do together")}</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {courseChips.map((c) => <Chip key={c.id} selected={draft.course_id === c.id} onClick={() => setCourse(draft.course_id === c.id ? null : c.id)}>{lang === "en" ? c.title_en : c.title}</Chip>)}
          <Chip selected={draft.course_id === null} onClick={() => setCourse(null)}>{tr("코스 없이", "No walk")}</Chip>
        </div>

        <FieldLabel className="mt-6" extra={tr(`${REQUEST_PLACES_MAX}곳까지`, `Up to ${REQUEST_PLACES_MAX}`)}>{tr("더 가 보고 싶은 곳", "Other places I'd like to visit")}</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {r.places.map((pid) => <Chip key={pid} selected onClick={() => setReq({ places: r.places.filter((x) => x !== pid) })}>{placeName(pid)}</Chip>)}
          {suggest.map((p) => <Chip key={p.id} onClick={() => setReq({ places: [...r.places, p.id] })}>{lang === "en" ? p.name_en : p.name}</Chip>)}
          {!full && <Chip onClick={() => setPlaceSheet(true)}>{tr("+ 추가", "+ Add")}</Chip>}
        </div>

        <FieldLabel className="mt-6" extra={tr("선택", "Optional")}>{tr("더 알려 줄 것", "Anything else")}</FieldLabel>
        <textarea className={`${textareaCls} min-h-[88px] text-[15px]`} maxLength={REQUEST_NOTE_MAX} value={r.note} placeholder={tr("예: 무릎이 안 좋아서 언덕은 천천히 가고 싶어요.", "e.g. My knees are weak, so I'd like to take hills slowly.")}
          onChange={(e) => setReq({ note: e.target.value.slice(0, REQUEST_NOTE_MAX) })} />
        <div className="mt-1 text-right text-[13px] text-muted">{r.note.length} / {REQUEST_NOTE_MAX}</div>
      </div>

      <BottomBar>
        <Button onClick={() => router.push(`/buddies/${id}/options`)}>{tr("다음: 식사·사진 옵션", "Next: meal & photo options")}</Button>
      </BottomBar>

      <BottomSheet open={placeSheet} onClose={() => setPlaceSheet(false)} title={`${tr("더 가 보고 싶은 곳", "Places to visit")} (${r.places.length}/${REQUEST_PLACES_MAX})`}>
        <div className="flex flex-wrap gap-2">
          {places.map((p) => {
            const on = r.places.includes(p.id);
            return <Chip key={p.id} selected={on} disabled={!on && full} onClick={() => setReq({ places: on ? r.places.filter((x) => x !== p.id) : [...r.places, p.id] })}>{lang === "en" ? p.name_en : p.name}</Chip>;
          })}
        </div>
        <Button className="mt-5" onClick={() => setPlaceSheet(false)}>{tr("다 골랐어요", "Done")}</Button>
      </BottomSheet>
    </>
  );
}
