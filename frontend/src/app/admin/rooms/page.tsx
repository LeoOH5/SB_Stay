"use client";
// A04 대학·객실 — 객실 표(판매 켜고 끄기·수정), 개방 기간, 체크인 안내, 숙소 규칙
import { useEffect, useMemo, useState } from "react";
import { get, patch, post, won } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { useLS, writeLS } from "@/lib/store";
import type { AdminBookingRow, DormRoom, ListResponse, University } from "@/lib/types";
import { Button, Icon, Spinner } from "@/components/ui";
import {
  AdminGate, AdminHeader, EmptyRow, ErrorText, KeyValues, Note, ROOM_LABEL, SectionLabel, Select, Table, Td, Toggle, Tr, adminInput, errMsg, linkCls, mdKo, smallBtn, Pager, usePaged } from "@/components/admin/shell";

// 어드민 응답에는 total_rooms·active 가 있지만 DormRoom 에는 없어 어드민 화면에서만 확장한다
type AdminRoom = DormRoom & { total_rooms?: number; active?: boolean };
type RoomType = DormRoom["room_type"];
interface RoomForm { building: string; room_type: RoomType; price_per_night: string; total_rooms: string; rules: string }
interface CheckinInfo { times: string; desk: string; wifi: string; emergency: string }
const DEFAULT_UNIV = 1; // 운영자 첫 화면: 1번 대학. univ_admin 은 본인 university_id 로 고정
const CHECKIN_RE = /체크인\s*(\d{1,2}:\d{2})\s*\/\s*체크아웃\s*(\d{1,2}:\d{2})/;

export default function AdminRoomsPage() {
  const { user } = useUser();
  const isUnivAdmin = user?.role === "univ_admin" && !!user.university_id;
  const [pickedUniv, setPickedUniv] = useState(DEFAULT_UNIV);
  const univId = isUnivAdmin ? user!.university_id! : pickedUniv;

  const [all, setAll] = useState<AdminRoom[] | null>(null);
  const [rooms, setRooms] = useState<AdminRoom[] | null>(null);
  const pgRooms = usePaged(rooms);
  const [bookings, setBookings] = useState<AdminBookingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<{ from: string; to: string } | null>(null);
  const [editPeriod, setEditPeriod] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<RoomForm | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [edit, setEdit] = useState<{ price: string; total: string }>({ price: "", total: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [d, b] = await Promise.all([get<ListResponse<AdminRoom>>("/admin/dorms"), get<ListResponse<AdminBookingRow>>("/admin/bookings", { type: "dorm" })]);
        if (!alive) return;
        setAll(d.items);
        setBookings(b.items);
      } catch (e) { if (alive) setError(errMsg(e)); }
    })();
    return () => { alive = false; };
  }, []);

  // 대학이 바뀌면 그 대학 객실만
  const [shownUniv, setShownUniv] = useState<number | null>(null);
  if (all && shownUniv !== univId) {
    const mine = all.filter((d) => d.university.id === univId);
    setShownUniv(univId);
    setRooms(mine);
    const u = mine[0]?.university;
    setPeriod({ from: u?.open_from ?? "2027-01-05", to: u?.open_to ?? "2027-02-20" });
    setEditId(null); setShowAdd(false);
  }

  const univs = useMemo(() => {
    const m = new Map<number, University>();
    for (const d of all ?? []) m.set(d.university.id, d.university);
    return [...m.values()];
  }, [all]);
  const univ: University = rooms?.[0]?.university ?? univs.find((u) => u.id === univId) ?? { id: univId, name: "대학", name_en: "" };
  const buildings = [...new Set((rooms ?? []).map((r) => r.building))];
  const title = buildings.length === 1 ? `${univ.name} ${buildings[0]}` : univ.name;
  const rules = [...new Set((rooms ?? []).flatMap((r) => r.rules).filter((r) => !CHECKIN_RE.test(r)))];
  const bookedCount = (r: AdminRoom) => bookings.filter((b) => b.title === `${r.university.name} ${r.building} ${ROOM_LABEL[r.room_type]}` && b.status !== "cancelled" && b.status !== "rejected").length;

  async function savePeriod() {
    if (!period) return;
    setBusy(true); setError(null);
    try {
      await patch<University>(`/admin/universities/${univId}`, { open_from: period.from, open_to: period.to });
      setRooms((rs) => rs?.map((r) => ({ ...r, university: { ...r.university, open_from: period.from, open_to: period.to } })) ?? rs);
      setEditPeriod(false);
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }

  async function addRoom(f: RoomForm) {
    if (!period) return;
    setBusy(true); setError(null);
    try {
      const body = {
        university_id: univId, building: f.building.trim() || buildings[0] || "생활관", room_type: f.room_type,
        price_per_night: Number(f.price_per_night) || 0, total_rooms: Number(f.total_rooms) || 0,
        open_from: period.from, open_to: period.to, rules: f.rules.split(",").map((s) => s.trim()).filter(Boolean), photos: [] as string[], active: true,
      };
      const created = await post<{ id: number }>("/admin/dorms", body);
      const room: AdminRoom = { id: created.id, university: univ, building: body.building, room_type: body.room_type, price_per_night: body.price_per_night, open_from: body.open_from, open_to: body.open_to, available_rooms: body.total_rooms, photos: [], rules: body.rules, total_rooms: body.total_rooms, active: true };
      setRooms((rs) => [...(rs ?? []), room]);
      setShowAdd(false); setForm(null);
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }

  function startEdit(r: AdminRoom) { setEditId(r.id); setEdit({ price: String(r.price_per_night), total: r.total_rooms !== undefined ? String(r.total_rooms) : "" }); }
  async function saveEdit(r: AdminRoom) {
    setBusy(true); setError(null);
    try {
      const body: { price_per_night: number; total_rooms?: number } = { price_per_night: Number(edit.price) || r.price_per_night };
      if (edit.total !== "") body.total_rooms = Number(edit.total);
      await patch(`/admin/dorms/${r.id}`, body);
      setRooms((rs) => rs?.map((x) => (x.id === r.id ? { ...x, ...body } : x)) ?? rs);
      setEditId(null);
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }
  async function setActive(r: AdminRoom, next: boolean) {
    setBusy(true); setError(null);
    try {
      await patch(`/admin/dorms/${r.id}`, { active: next });
      setRooms((rs) => rs?.map((x) => (x.id === r.id ? { ...x, active: next } : x)) ?? rs);
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }

  function openAdd() {
    setForm({ building: buildings[0] ?? "", room_type: "double", price_per_night: "35000", total_rooms: "20", rules: rules.join(", ") });
    setShowAdd(true);
  }

  return (
    <AdminGate>
      <AdminHeader
        title={title}
        sub={period && (
          <span className="inline-flex flex-wrap items-center gap-x-3">
            <span>서울 성북구, 방학 개방 {mdKo(period.from)} – {mdKo(period.to)}</span>
            {!editPeriod && <button type="button" className="text-[13px] font-semibold text-navy underline underline-offset-2" onClick={() => setEditPeriod(true)}>기간 수정</button>}
          </span>
        )}
        right={
          <>
            {!isUnivAdmin && univs.length > 0 && <Select label="대학" value={String(univId)} onChange={(v) => setPickedUniv(Number(v))} options={univs.map((u) => ({ value: String(u.id), label: u.name }))} className="w-[180px]" />}
            <Button variant="primary" full={false} className={smallBtn + " px-5"} onClick={() => (showAdd ? setShowAdd(false) : openAdd())} aria-expanded={showAdd}>
              <Icon name={showAdd ? "x" : "plus"} className="h-[18px] w-[18px]" strokeWidth={2.2} />{showAdd ? "닫기" : "객실 추가"}
            </Button>
          </>
        }
      />
      {error && <ErrorText>{error}</ErrorText>}

      {/* 개방 기간 수정 */}
      {editPeriod && period && (
        <div className="-mt-3 mb-7 flex flex-wrap items-center gap-2">
          <input type="date" value={period.from} onChange={(e) => setPeriod({ ...period, from: e.target.value })} className={adminInput + " w-[180px]"} aria-label="개방 시작일" />
          <span className="text-[14px] text-muted">–</span>
          <input type="date" value={period.to} onChange={(e) => setPeriod({ ...period, to: e.target.value })} className={adminInput + " w-[180px]"} aria-label="개방 종료일" />
          <Button variant="primary" full={false} className={smallBtn} disabled={busy || period.to < period.from} onClick={savePeriod}>저장</Button>
          <Button variant="ghost" full={false} className={smallBtn} onClick={() => setEditPeriod(false)}>취소</Button>
          {period.to < period.from && <span className="text-[13px] font-semibold text-red">끝나는 날이 시작일보다 빨라요</span>}
        </div>
      )}

      {/* 객실 추가 */}
      {showAdd && form && (
        <section className="mb-8 border-y border-line py-5">
          <SectionLabel className="mb-4">객실 추가</SectionLabel>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <label className="text-[13px] text-muted">건물<input className={adminInput + " mt-1.5 w-full"} value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })} /></label>
            <label className="text-[13px] text-muted">유형
              <select className={adminInput + " mt-1.5 w-full"} value={form.room_type} onChange={(e) => setForm({ ...form, room_type: e.target.value as RoomType })}>
                {(Object.keys(ROOM_LABEL) as RoomType[]).map((k) => <option key={k} value={k}>{ROOM_LABEL[k]}</option>)}
              </select>
            </label>
            <label className="text-[13px] text-muted">1박 가격 (원)<input type="number" min={0} className={adminInput + " mt-1.5 w-full"} value={form.price_per_night} onChange={(e) => setForm({ ...form, price_per_night: e.target.value })} /></label>
            <label className="text-[13px] text-muted">객실 수<input type="number" min={0} className={adminInput + " mt-1.5 w-full"} value={form.total_rooms} onChange={(e) => setForm({ ...form, total_rooms: e.target.value })} /></label>
            <label className="text-[13px] text-muted">이용 규칙 (쉼표로 구분)<input className={adminInput + " mt-1.5 w-full"} value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })} /></label>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button variant="primary" full={false} className={smallBtn} disabled={busy} onClick={() => addRoom(form)}>등록</Button>
            <Note>개방 기간은 {period && `${mdKo(period.from)} – ${mdKo(period.to)}`}을 그대로 써요.</Note>
          </div>
        </section>
      )}

      <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,1fr)_440px]">
        <div className="min-w-0">
          <SectionLabel>객실</SectionLabel>
          {!rooms ? <Spinner /> : (
            <><Table cols={[{ label: "건물" }, { label: "유형" }, { label: "1박" }, { label: "객실 수" }, { label: "예약" }, { label: "판매" }, { label: "", className: "w-[64px]" }]}>
              {rooms.length === 0 && <EmptyRow cols={7}>등록된 객실이 없어요. 객실 추가로 등록하세요.</EmptyRow>}
              {pgRooms.items.map((r) => {
                const editing = editId === r.id;
                const on = r.active !== false;
                return (
                  <Tr key={r.id} className="h-[61px]">
                    <Td className="font-semibold">{r.building}</Td>
                    <Td>{ROOM_LABEL[r.room_type]}</Td>
                    <Td>{editing ? <input type="number" min={0} className={adminInput + " h-9 w-28"} value={edit.price} aria-label="1박 가격" onChange={(e) => setEdit({ ...edit, price: e.target.value })} /> : won(r.price_per_night)}</Td>
                    <Td>
                      {editing ? <input type="number" min={0} className={adminInput + " h-9 w-20"} value={edit.total} placeholder="—" aria-label="객실 수" onChange={(e) => setEdit({ ...edit, total: e.target.value })} />
                        : r.total_rooms != null ? `${r.total_rooms}실` : <span title="남은 방">{r.available_rooms}실 남음</span>}
                    </Td>
                    <Td>{bookedCount(r)}건</Td>
                    <Td><Toggle on={on} onChange={(v) => setActive(r, v)} disabled={busy} label={`${r.building} ${ROOM_LABEL[r.room_type]} 판매`} /></Td>
                    <Td className="text-right">
                      {editing ? (
                        <span className="inline-flex gap-3">
                          <button type="button" className={linkCls} disabled={busy} onClick={() => saveEdit(r)}>저장</button>
                          <button type="button" className={linkCls + " text-muted"} onClick={() => setEditId(null)}>취소</button>
                        </span>
                      ) : <button type="button" className={linkCls + " text-muted"} onClick={() => startEdit(r)}>수정</button>}
                    </Td>
                  </Tr>
                );
              })}
            </Table>
            <Pager {...pgRooms} /></>
          )}

          <SectionLabel className="mt-14">숙소 규칙</SectionLabel>
          {rules.length === 0 ? <Note>등록된 규칙이 없어요.</Note> : (
            <ul className="mt-3 space-y-2.5">
              {rules.map((r) => <li key={r} className="flex items-start gap-2.5 text-[14px] text-ink"><span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-muted" />{r}</li>)}
            </ul>
          )}
        </div>

        <CheckinPanel univId={univId} rooms={rooms ?? []} building={buildings[0]} />
      </div>
    </AdminGate>
  );
}

/** 체크인 안내 — 체크인·체크아웃은 객실 규칙에서, 나머지는 이 브라우저에 저장(백엔드 필드 없음) */
function CheckinPanel({ univId, rooms, building }: { univId: number; rooms: AdminRoom[]; building?: string }) {
  const key = `sbstay.admin.checkin.${univId}`;
  const saved = useLS<CheckinInfo | null>(key, null);
  const times = rooms.map((r) => r.rules.map((x) => x.match(CHECKIN_RE)).find(Boolean)).find(Boolean);
  const info: CheckinInfo = saved ?? { times: times ? `${times[1]} / ${times[2]}` : "—", desk: building ? `${building} 안내데스크` : "—", wifi: "—", emergency: "—" };
  const [draft, setDraft] = useState<CheckinInfo | null>(null);

  const fields: { k: keyof CheckinInfo; label: string }[] = [
    { k: "times", label: "체크인 / 체크아웃" }, { k: "desk", label: "받는 곳" }, { k: "wifi", label: "와이파이" }, { k: "emergency", label: "비상 연락" },
  ];
  return (
    <aside>
      <SectionLabel>체크인 안내</SectionLabel>
      {draft ? (
        <div className="space-y-3 pt-2">
          {fields.map((f) => (
            <label key={f.k} className="flex items-center justify-between gap-4 text-[14px] text-muted">
              {f.label}
              <input className={adminInput + " h-9 w-[240px] text-right"} value={draft[f.k]} onChange={(e) => setDraft({ ...draft, [f.k]: e.target.value })} />
            </label>
          ))}
          <div className="flex gap-2 pt-2">
            <Button variant="primary" full={false} className={smallBtn} onClick={() => { try { writeLS(key, draft); } catch { /* 저장 안 돼도 화면은 그대로 */ } setDraft(null); }}>저장</Button>
            <Button variant="ghost" full={false} className={smallBtn} onClick={() => setDraft(null)}>취소</Button>
          </div>
        </div>
      ) : (
        <>
          <KeyValues rows={fields.map((f) => ({ label: f.label, value: info[f.k] }))} />
          <Button variant="ghost" full={false} className={smallBtn + " mt-4"} onClick={() => setDraft(info)}>안내 수정</Button>
        </>
      )}
      {!draft && <Note className="mt-4">체크인·체크아웃 시각은 객실 규칙에서 가져와요. 다른 안내는 지금은 이 브라우저에만 저장돼요.</Note>}
    </aside>
  );
}
