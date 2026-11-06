"use client";
// 정산 관리 섹션 (예약 관리 하단 · /admin/settlements 단독 페이지에서 재사용)
import { useEffect, useState } from "react";
import { get, won } from "@/lib/api";
import { KpiTile, Spinner } from "@/components/ui";
import { EmptyRow, ErrorText, SectionLabel, Table, Td, Tr, errMsg } from "./shell";

// 정산 응답 형태(src/lib/types.ts 에 정산 타입이 없어 여기서만 정의)
export interface SettlementRow { target: string; count: number; revenue: number; fee: number; payout: number; status: string }
export interface SettlementResponse { total: number; items: SettlementRow[] }

// KPI 요약
const KPI = [
  { label: "총 거래액", value: 3105000, sub: "확정 예약 기준", accent: true },
  { label: "대학 정산", value: 2268000, sub: "숙박 매출 − 수수료 10%" },
  { label: "해설사 정산", value: 360000, sub: "투어 18회 × ₩20,000" },
  { label: "버디 활동비", value: 240000, sub: "동행 8회" },
];

export function SettlementSection({ titleTag = true }: { titleTag?: boolean }) {
  const [data, setData] = useState<SettlementResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try { const r = await get<SettlementResponse>("/admin/settlements"); if (alive) setData(r); }
      catch (e) { if (alive) setError(errMsg(e)); }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <section>
      {titleTag && <SectionLabel>정산 관리</SectionLabel>}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-3">
        {KPI.map((k) => <KpiTile key={k.label} label={k.label} value={won(k.value)} sub={k.sub} accent={k.accent} />)}
      </div>
      {error && <ErrorText>{error}</ErrorText>}
      {!data && !error ? <Spinner /> : (
        <Table cols={[{ label: "정산 대상" }, { label: "건수" }, { label: "매출" }, { label: "수수료 10%" }, { label: "지급액" }, { label: "상태" }]}>
          {data && data.items.length === 0 && <EmptyRow cols={6}>정산 대상이 없어요.</EmptyRow>}
          {data?.items.map((r) => (
            <Tr key={r.target}>
              <Td className="font-semibold">{r.target}</Td>
              <Td>{r.count}건</Td>
              <Td>{won(r.revenue)}</Td>
              <Td>{won(r.fee)}</Td>
              <Td className="font-semibold">{won(r.payout)}</Td>
              <Td className={r.status.includes("완료") ? "text-green-dark font-medium" : "text-orange font-medium"}>{r.status}</Td>
            </Tr>
          ))}
        </Table>
      )}
    </section>
  );
}
