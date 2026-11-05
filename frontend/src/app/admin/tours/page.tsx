"use client";
// 투어 코스 관리 — GET /admin/tours (AD-07 · 시드 데이터 조회만)
import { useEffect, useState } from "react";
import { get, won } from "@/lib/api";
import type { ListResponse, Tour } from "@/lib/types";
import { Spinner } from "@/components/ui";
import { AdminGate, AdminHeader, EmptyRow, ErrorText, Note, Table, Td, Tr, errMsg, langs } from "@/components/admin/shell";

const THEME_LABEL: Record<string, string> = { literature: "문학", independence: "독립운동", royal: "왕릉·성곽", hanok: "한옥·사찰", history: "역사" };
const DAY_LABEL: Record<string, string> = { mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토", sun: "일" };
const hours = (min: number) => (min % 60 === 0 ? `${min / 60}h` : `${Math.floor(min / 60)}h ${min % 60}m`);

export default function AdminToursPage() {
  const [tours, setTours] = useState<Tour[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try { const r = await get<ListResponse<Tour>>("/admin/tours"); if (alive) setTours(r.items); }
      catch (e) { if (alive) setError(errMsg(e)); }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <AdminGate>
      <AdminHeader title="투어 코스 관리" sub="GET /admin/tours (AD-07) · 시드 데이터 조회만" />
      {error && <ErrorText>{error}</ErrorText>}
      {!tours ? <Spinner /> : (
        <Table cols={[{ label: "제목" }, { label: "테마" }, { label: "해설사" }, { label: "시간" }, { label: "가격" }, { label: "요일" }, { label: "언어" }]}>
          {tours.length === 0 && <EmptyRow cols={7}>등록된 코스가 없어요.</EmptyRow>}
          {tours.map((t) => (
            <Tr key={t.id}>
              <Td><div className="font-semibold">{t.title}</div><div className="text-[12px] text-muted">{t.title_en}</div></Td>
              <Td>{THEME_LABEL[t.theme] ?? t.theme}</Td>
              <Td>{t.guide.name}<span className="text-[12px] text-muted"> · {t.guide.license}</span></Td>
              <Td>{hours(t.duration_min)}</Td>
              <Td className="font-semibold">{won(t.price)}</Td>
              <Td>{t.operating_days.map((d) => DAY_LABEL[d] ?? d).join("·")}</Td>
              <Td>{langs(t.languages)}</Td>
            </Tr>
          ))}
        </Table>
      )}
      <Note className="mt-3">시드 데이터 조회만(AD-07). 등록·수정은 제외.</Note>
    </AdminGate>
  );
}
