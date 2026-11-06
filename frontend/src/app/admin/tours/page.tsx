"use client";
// A06 산책 코스 — AD-07 GET /admin/tours → AdminCourseRow (무료 코스, 예약·정산 대상 아님). v3.5 걸리는 시간은 서버 계산값
import { useEffect, useState } from "react";
import { get } from "@/lib/api";
import type { AdminCourseRow, ListResponse } from "@/lib/types";
import { Button, Icon, Spinner, StatusPill } from "@/components/ui";
import { OperatorOnly, AdminHeader, EmptyRow, ErrorText, Note, Table, Td, Tr, errMsg, smallBtn } from "@/components/admin/shell";

const THEME_LABEL: Record<string, string> = { literature: "문학", independence: "독립운동", royal: "왕릉·성곽", hanok: "한옥·사찰", history: "역사", temple: "사찰" };
const walkTime = (min: number) => (min % 60 === 0 ? `${min / 60}시간` : min < 60 ? `${min}분` : `${Math.floor(min / 60)}시간 ${min % 60}분`);

export default function AdminToursPage() {
  const [courses, setCourses] = useState<AdminCourseRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [askAdd, setAskAdd] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try { const r = await get<ListResponse<AdminCourseRow>>("/admin/tours"); if (alive) setCourses(r.items); }
      catch (e) { if (alive) setError(errMsg(e)); }
    })();
    return () => { alive = false; };
  }, []);

  const placeCount = new Set((courses ?? []).flatMap((c) => c.places)).size;

  return (
    <OperatorOnly title="산책 코스">
      <AdminHeader
        title="산책 코스"
        sub={`무료 코스${courses ? ` ${courses.length}개` : ""}. 장소마다 AI 이야기 자료(출처 포함)가 붙어 있어요.`}
        right={<Button variant="ghost" full={false} className={smallBtn + " px-5"} onClick={() => setAskAdd((v) => !v)} aria-expanded={askAdd}><Icon name="plus" className="h-[18px] w-[18px]" strokeWidth={2.2} />코스 추가</Button>}
      />
      {askAdd && <Note tone="orange" className="-mt-3 mb-6">코스 추가는 운영 단계에서 열려요. 새 코스가 필요하면 장소 목록과 이야기 자료 출처를 운영팀에 보내 주세요.</Note>}
      {error && <ErrorText>{error}</ErrorText>}

      {!courses ? <Spinner /> : (
        <Table cols={[{ label: "코스" }, { label: "테마" }, { label: "경로" }, { label: "걸리는 시간" }, { label: "AI 이야기 자료" }, { label: "버디와 함께" }]}>
          {courses.length === 0 && <EmptyRow cols={6}>등록된 코스가 없어요.</EmptyRow>}
          {courses.map((c) => {
            const ready = c.story_ready >= c.place_count;
            return (
              <Tr key={c.id}>
                <Td className="font-semibold">{c.title}</Td>
                <Td className="text-muted">{THEME_LABEL[c.theme] ?? c.theme}</Td>
                <Td className="whitespace-normal">{c.places.join(", ")}</Td>
                <Td>{walkTime(c.duration_min)}{!c.walk_complete && <span className="block text-[12px] text-orange-ink">걷는 시간 일부 빠짐</span>}</Td>
                <Td><StatusPill status={ready ? "confirmed" : "pending"} label={`${c.story_ready} / ${c.place_count}곳`} /></Td>
                <Td>{c.buddy_walks}회</Td>
              </Tr>
            );
          })}
        </Table>
      )}
      {courses && <Note className="mt-9">코스에 나오는 장소 {placeCount}곳의 이야기 자료는 성북구청·국가유산청·서울시 자료에서 가져왔어요. 코스는 무료라 결제와 정산이 없어요. 걸리는 시간은 장소마다 머무는 시간 + 장소 사이 걷는 시간(직선거리 × 1.3, 시속 4km 어림)으로 계산해요.</Note>}
    </OperatorOnly>
  );
}
