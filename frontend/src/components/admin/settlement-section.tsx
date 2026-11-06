"use client";
// A05 정산 본문 — KPI 줄(총 거래액·대학 지급·버디 지급·여행자 식비 환불) + 지급 대상 표 (식비 열 포함)
import { useEffect, useState } from "react";
import { get, won } from "@/lib/api";
import type { AdminMealClaimRow, ListResponse, SettlementRow, Settlements } from "@/lib/types";
import { Spinner, StatusPill } from "@/components/ui";
import { EmptyRow, ErrorText, KpiStrip, Note, Table, Td, Tr, errMsg } from "./shell";

const sumBy = (rows: SettlementRow[], t: SettlementRow["party_type"], k: "payout" | "revenue" | "meals" | "fee") => rows.filter((r) => r.party_type === t).reduce((s, r) => s + r[k], 0);

/** "2027-01" → 다음 달 말일 "2월 28일" (지급일) */
function payDay(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m + 1, 0));
  return `${last.getUTCMonth() + 1}월 ${last.getUTCDate()}일`;
}

export function SettlementSection({ month }: { month: string }) {
  const [data, setData] = useState<Settlements | null>(null);
  const [pendingMeals, setPendingMeals] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [loadedMonth, setLoadedMonth] = useState<string | null>(null);

  if (loadedMonth !== month) { setLoadedMonth(month); setData(null); setError(null); }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, claims] = await Promise.all([
          get<Settlements>("/admin/settlements", { month }),
          // 버디별 '식비 N건 확인 중' 표시용 (정산 행에는 건수가 없다)
          get<ListResponse<AdminMealClaimRow>>("/admin/meal-claims", { status: "requested" }).catch(() => ({ items: [] as AdminMealClaimRow[], next_cursor: null })),
        ]);
        if (!alive) return;
        setData(s);
        const counts: Record<string, number> = {};
        for (const c of claims.items) if (c.date.startsWith(month)) counts[c.buddy_name] = (counts[c.buddy_name] ?? 0) + 1;
        setPendingMeals(counts);
      } catch (e) { if (alive) setError(errMsg(e)); }
    })();
    return () => { alive = false; };
  }, [month]);

  const items = data?.items ?? [];
  const buddyMeals = sumBy(items, "buddy", "meals");
  const buddyPayout = sumBy(items, "buddy", "payout");

  function statusOf(r: SettlementRow) {
    if (r.status === "settled") return <StatusPill status="settled" label="지급 완료" />;
    if (r.status === "meal_pending") {
      const n = pendingMeals[r.target.replace(/^버디\s*/, "")];
      return <StatusPill status="meal_pending" label={n ? `식비 ${n}건 확인 중` : "식비 확인 중"} />;
    }
    return <StatusPill status="pending" label={`${payDay(month)} 지급 예정`} />;
  }

  return (
    <section>
      {error && <ErrorText>{error}</ErrorText>}
      <KpiStrip items={[
        { label: "총 거래액", value: data ? won(data.total) : "—" },
        { label: "대학 지급", value: data ? won(sumBy(items, "university", "payout")) : "—", sub: "숙박 매출에서 수수료 제외" },
        { label: "버디 지급", value: data ? won(buddyPayout) : "—", sub: data ? `활동비 ${won(buddyPayout - buddyMeals)} + 식비 ${won(buddyMeals)}` : undefined },
        { label: "여행자 식비 환불", value: data ? won(data.meal_refund_total) : "—", sub: "쓰고 남은 보증금" },
      ]} />

      {!data && !error ? <Spinner /> : (
        <Table cols={[{ label: "지급 대상" }, { label: "건수" }, { label: "매출" }, { label: "수수료" }, { label: "식비 환급" }, { label: "지급액" }, { label: "상태" }]}>
          {items.length === 0 && <EmptyRow cols={7}>정산할 내역이 없어요.</EmptyRow>}
          {items.map((r) => (
            <Tr key={`${r.party_type}-${r.party_id}`}>
              <Td className="font-semibold">{r.target}</Td>
              <Td>{r.count}</Td>
              <Td>{won(r.revenue)}</Td>
              <Td className="text-muted">{won(r.fee)}</Td>
              <Td>{r.meals ? won(r.meals) : <span className="text-muted">–</span>}</Td>
              <Td>{won(r.payout)}</Td>
              <Td>{statusOf(r)}</Td>
            </Tr>
          ))}
        </Table>
      )}
      <Note className="mt-9">버디 지급액은 활동비에서 수수료 10%를 뺀 금액에 승인된 식비를 더해요. 외국인 숙박 신고용 내보내기는 운영 단계에서 열려요.</Note>
    </section>
  );
}
