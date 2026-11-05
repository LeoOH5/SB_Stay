"use client";
// A2 대학 / 객실 관리 + 개방 기간 — GET /admin/dorms, POST /admin/dorms (DM-04), PATCH /admin/dorms/{id} (DM-05), PATCH /admin/universities/{id} (DM-06)
import { useEffect, useState } from "react";
import { get, patch, post, won } from "@/lib/api";
import { useUser } from "@/lib/auth";
import type { DormRoom, ListResponse, University } from "@/lib/types";
import { Button, Card, Spinner } from "@/components/ui";
import { AdminGate, AdminHeader, EmptyRow, ErrorText, Note, ROOM_LABEL, SectionLabel, Table, Td, Tr, adminInput, errMsg, linkCls, smallBtn } from "@/components/admin/shell";

// DM-04/05 에는 total_rooms·active 가 있지만 DormRoom(DM-01 응답)에는 없어 어드민 화면에서만 확장한다
type AdminRoom = DormRoom & { total_rooms?: number; active?: boolean };
type RoomType = DormRoom["room_type"];
interface RoomForm { building: string; room_type: RoomType; price_per_night: string; total_rooms: string; rules: string }
const EMPTY_FORM: RoomForm = { building: "국제관", room_type: "double", price_per_night: "35000", total_rooms: "20", rules: "체크인 15:00 / 체크아웃 11:00, 취사 금지" };
const UNIV_ID = 1; // 데모 대학(A대학교). univ_admin 은 본인 university_id 로 고정

export default function AdminRoomsPage() {
  const { user } = useUser();
  const univId = user?.role === "univ_admin" && user.university_id ? user.university_id : UNIV_ID;

  const [rooms, setRooms] = useState<AdminRoom[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openFrom, setOpenFrom] = useState("2027-01-05");
  const [openTo, setOpenTo] = useState("2027-02-20");
  const [periodMsg, setPeriodMsg] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<RoomForm>(EMPTY_FORM);
  const [editId, setEditId] = useState<number | null>(null);
  const [edit, setEdit] = useState<{ price: string; total: string }>({ price: "", total: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await get<ListResponse<AdminRoom>>("/admin/dorms");
        if (!alive) return;
        const mine = r.items.filter((d) => d.university.id === univId);
        setRooms(mine);
        const u = mine[0]?.university;
        if (u?.open_from) setOpenFrom(u.open_from);
        if (u?.open_to) setOpenTo(u.open_to);
      } catch (e) { if (alive) setError(errMsg(e)); }
    })();
    return () => { alive = false; };
  }, [univId]);

  const univ: University = rooms?.[0]?.university ?? { id: univId, name: "A대학교", name_en: "A University" };

  async function savePeriod() {
    setBusy(true); setPeriodMsg(null);
    try {
      await patch<University>(`/admin/universities/${univId}`, { open_from: openFrom, open_to: openTo });
      setRooms((rs) => rs?.map((r) => ({ ...r, university: { ...r.university, open_from: openFrom, open_to: openTo } })) ?? rs);
      setPeriodMsg(`개방 기간 저장됨 · ${openFrom} ~ ${openTo}`);
    } catch (e) { setPeriodMsg(errMsg(e)); } finally { setBusy(false); }
  }

  async function addRoom() {
    setBusy(true); setError(null);
    try {
      const body = {
        university_id: univId, building: form.building.trim() || "국제관", room_type: form.room_type,
        price_per_night: Number(form.price_per_night) || 0, total_rooms: Number(form.total_rooms) || 0,
        open_from: openFrom, open_to: openTo, rules: form.rules.split(",").map((s) => s.trim()).filter(Boolean), photos: [] as string[], active: true,
      };
      const created = await post<{ id: number }>("/admin/dorms", body);
      const room: AdminRoom = { id: created.id, university: univ, building: body.building, room_type: body.room_type, price_per_night: body.price_per_night, open_from: body.open_from, open_to: body.open_to, available_rooms: body.total_rooms, photos: [], rules: body.rules, total_rooms: body.total_rooms, active: true };
      setRooms((rs) => [...(rs ?? []), room]);
      setShowAdd(false); setForm(EMPTY_FORM);
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
  async function toggleActive(r: AdminRoom) {
    const next = !(r.active ?? true);
    setBusy(true); setError(null);
    try {
      await patch(`/admin/dorms/${r.id}`, { active: next });
      setRooms((rs) => rs?.map((x) => (x.id === r.id ? { ...x, active: next } : x)) ?? rs);
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }

  const cols = [{ label: "객실 유형" }, { label: "객실 수" }, { label: "1박 가격" }, { label: "남은 객실" }, { label: "이용 규칙" }, { label: "사진" }, { label: "" }];

  return (
    <AdminGate>
      <AdminHeader
        title={`${univ.name} ${rooms?.[0]?.building ?? "국제관"} · 객실 관리`}
        right={<Button variant="primary" full={false} className="h-10 min-h-0 px-4 text-[14px]" onClick={() => setShowAdd((v) => !v)}>{showAdd ? "닫기" : "+ 객실 추가"}</Button>}
      />
      {error && <ErrorText>{error}</ErrorText>}

      {/* 개방 기간 (DM-06) */}
      <div className="text-[13px] text-muted mb-1.5">개방 기간</div>
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={openFrom} onChange={(e) => setOpenFrom(e.target.value)} className={adminInput + " w-[200px] h-10"} aria-label="개방 시작일" />
        <span className="text-[14px] text-muted">~</span>
        <input type="date" value={openTo} onChange={(e) => setOpenTo(e.target.value)} className={adminInput + " w-[200px] h-10"} aria-label="개방 종료일" />
        <Button variant="ghost" full={false} className="h-10 min-h-0 px-4 text-[14px]" disabled={busy || openTo < openFrom} onClick={savePeriod}>저장</Button>
        {periodMsg && <span className="text-[12px] text-muted">{periodMsg}</span>}
        {openTo < openFrom && <span className="text-[12px] text-orange">종료일이 시작일보다 빠릅니다</span>}
      </div>

      {/* 객실 추가 인라인 폼 (DM-04) */}
      {showAdd && (
        <Card className="mt-4">
          <div className="text-[14px] font-semibold text-ink mb-3">객실 추가 · POST /admin/dorms</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <label className="text-[12px] text-muted">건물명<input className={adminInput + " w-full mt-1"} value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })} /></label>
            <label className="text-[12px] text-muted">객실 유형
              <select className={adminInput + " w-full mt-1"} value={form.room_type} onChange={(e) => setForm({ ...form, room_type: e.target.value as RoomType })}>
                {(Object.keys(ROOM_LABEL) as RoomType[]).map((k) => <option key={k} value={k}>{ROOM_LABEL[k]}</option>)}
              </select>
            </label>
            <label className="text-[12px] text-muted">1박 가격 (원)<input type="number" min={0} className={adminInput + " w-full mt-1"} value={form.price_per_night} onChange={(e) => setForm({ ...form, price_per_night: e.target.value })} /></label>
            <label className="text-[12px] text-muted">총 객실 수<input type="number" min={0} className={adminInput + " w-full mt-1"} value={form.total_rooms} onChange={(e) => setForm({ ...form, total_rooms: e.target.value })} /></label>
            <label className="text-[12px] text-muted col-span-2 md:col-span-1">이용 규칙 (쉼표 구분)<input className={adminInput + " w-full mt-1"} value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })} /></label>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button variant="primary" full={false} className={smallBtn} disabled={busy} onClick={addRoom}>등록</Button>
            <span className="text-[12px] text-muted">개방 기간은 위 값({openFrom} ~ {openTo})을 그대로 씁니다.</span>
          </div>
        </Card>
      )}

      {/* 객실 표 */}
      <SectionLabel right="GET /admin/dorms · PATCH /admin/dorms/{id} (DM-05)">객실 목록</SectionLabel>
      {!rooms ? <Spinner /> : (
        <Table cols={cols}>
          {rooms.length === 0 && <EmptyRow cols={7}>등록된 객실이 없어요. “+ 객실 추가”로 등록하세요.</EmptyRow>}
          {rooms.map((r) => {
            const editing = editId === r.id;
            const inactive = r.active === false;
            return (
              <Tr key={r.id} dim={inactive}>
                <Td className="font-semibold">{ROOM_LABEL[r.room_type]}{inactive && <span className="ml-2 text-[11px] text-muted font-normal">비활성</span>}</Td>
                <Td>{editing ? <input type="number" min={0} className={adminInput + " w-20"} value={edit.total} placeholder="—" onChange={(e) => setEdit({ ...edit, total: e.target.value })} /> : (r.total_rooms ?? "—")}</Td>
                <Td>{editing ? <input type="number" min={0} className={adminInput + " w-28"} value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} /> : won(r.price_per_night)}</Td>
                <Td>{r.available_rooms}</Td>
                <Td className="max-w-[260px] truncate text-muted" title={r.rules.join(" · ")}>{r.rules.join(" · ")}</Td>
                <Td>{r.photos.length}장</Td>
                <Td>
                  {editing ? (
                    <div className="flex items-center gap-2">
                      <Button variant="primary" full={false} className={smallBtn} disabled={busy} onClick={() => saveEdit(r)}>저장</Button>
                      <button type="button" className={linkCls + " text-muted"} onClick={() => setEditId(null)}>취소</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <button type="button" className={linkCls} onClick={() => startEdit(r)}>수정</button>
                      <button type="button" className={linkCls + " text-muted"} disabled={busy} onClick={() => toggleActive(r)}>{inactive ? "활성" : "비활성"}</button>
                    </div>
                  )}
                </Td>
              </Tr>
            );
          })}
        </Table>
      )}
      <Note className="mt-3">객실별 수정은 1박 가격·총 객실 수·활성 여부(DM-05). 개방 기간은 대학 단위로 저장(DM-06). 남은 객실은 예약 집계값이라 수정하지 않는다.</Note>
    </AdminGate>
  );
}
