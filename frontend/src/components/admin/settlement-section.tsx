"use client";
// A05 정산 본문 — KPI 줄(총 거래액·대학 지급·버디 지급·여행자 식비 환불) + 지급 대상 표 (식비 열 포함)
// + 수익 구조 (판매가 − 원가 = 이익, 식사 보증금은 통과 금액이라 뺀다)
// v3.2: 버디 지급 = Σ 활동비 × 항목별 정산율(예약 확정 때 고정, 기본 70% · 성장 75% · 우수 80%) + 승인 식비
import { useEffect, useState } from "react";
import { get, won } from "@/lib/api";
import type { AdminMealClaimRow, ListResponse, SettlementProfit, SettlementRow, Settlements } from "@/lib/types";
import { Spinner, StatusPill } from "@/components/ui";
import { EmptyRow, ErrorText, KpiStrip, Note, SectionLabel, Table, Td, Tr, errMsg } from "./shell";
import { useUser } from "@/lib/auth";

const sumBy = (rows: SettlementRow[], t: SettlementRow["party_type"], k: "payout" | "revenue" | "meals" | "fee") => rows.filter((r) => r.party_type === t).reduce((s, r) => s + r[k], 0);

/** "2027-01" → 다음 달 말일 "2월 28일" (지급일) */
function payDay(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m + 1, 0));
  return `${last.getUTCMonth() + 1}월 ${last.getUTCDate()}일`;
}

const pct = (r: number) => `${(r * 100).toFixed(1)}%`;
/** 정산율 0.75 → "75%", 섞여 있으면 소수 한 자리 (평균) */
const rate = (r: number) => (Math.abs(r * 100 - Math.round(r * 100)) < 0.05 ? `${Math.round(r * 100)}%` : `평균 ${pct(r)}`);

/** 수익 구조: 줄마다 판매가 − 원가 = 이익 */
function ProfitTable({ p }: { p: SettlementProfit }) {
  const rows = [
    { label: "숙소비", sub: "대학 지급 90%", sales: p.sales_dorm, cost: p.cost_university },
    { label: "버디비", sub: `버디 지급료 ${p.sales_buddy ? rate(p.cost_buddy / p.sales_buddy) : "70~80%"} (항목별 정산율) · 식비 제외`, sales: p.sales_buddy, cost: p.cost_buddy },
    { label: "앨범", sub: "전액 플랫폼", sales: p.sales_album, cost: 0 },
    { label: "기타 원가", sub: "카드 수수료 등", sales: 0, cost: p.cost_other },
  ];
  const cost = p.cost_university + p.cost_buddy + p.cost_other;
  return (
    <>
      <SectionLabel className="mt-10" right={`이익률 ${pct(p.margin)}`}>수익 구조</SectionLabel>
      <p className="mb-1 text-[13px] text-muted">이익 = (숙소비 + 버디비 + 앨범) − (숙소 원가 + 버디 지급료 + 기타 원가)</p>
      <Table cols={[{ label: "항목" }, { label: "판매가", className: "text-right" }, { label: "원가", className: "text-right" }, { label: "이익", className: "text-right" }]}>
        {rows.map((r) => (
          <Tr key={r.label}>
            <Td><span className="font-semibold">{r.label}</span> <span className="ml-1.5 text-[13px] text-muted">{r.sub}</span></Td>
            <Td className="text-right">{r.sales ? won(r.sales) : <span className="text-muted">–</span>}</Td>
            <Td className="text-right text-muted">{r.cost ? won(r.cost) : "–"}</Td>
            <Td className="text-right">{won(r.sales - r.cost)}</Td>
          </Tr>
        ))}
        <Tr className="border-b-0 font-semibold">
          <Td>합계</Td>
          <Td className="text-right">{won(p.sales)}</Td>
          <Td className="text-right">{won(cost)}</Td>
          <Td className="text-right text-navy">{won(p.profit)}</Td>
        </Tr>
      </Table>
    </>
  );
}

export function SettlementSection({ month }: { month: string }) {
  const [data, setData] = useState<Settlements | null>(null);
  const [pendingMeals, setPendingMeals] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [loadedMonth, setLoadedMonth] = useState<string | null>(null);
  const { user } = useUser();
  const univ = user?.role === "univ_admin"; // 대학 담당자: 자기 학교 숙박 행만 (버디·식비·수익 구조 없음)

  if (loadedMonth !== month) { setLoadedMonth(month); setData(null); setError(null); }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, claims] = await Promise.all([
          get<Settlements>("/admin/settlements", { month }),
          // 버디별 '식비 N건 확인 중' 표시용 (정산 행에는 건수가 없다)
          univ ? Promise.resolve({ items: [] as AdminMealClaimRow[], next_cursor: null }) : get<ListResponse<AdminMealClaimRow>>("/admin/meal-claims", { status: "requested" }).catch(() => ({ items: [] as AdminMealClaimRow[], next_cursor: null })),
        ]);
        if (!alive) return;
        setData(s);
        const counts: Record<string, number> = {};
        for (const c of claims.items) if (c.date.startsWith(month)) counts[c.buddy_name] = (counts[c.buddy_name] ?? 0) + 1;
        setPendingMeals(counts);
      } catch (e) { if (alive) setError(errMsg(e)); }
    })();
    return () => { alive = false; };
  }, [month, univ]);

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
      <KpiStrip items={univ ? [
        { label: "숙박 매출", value: data ? won(data.total) : "—", sub: "확정된 우리 학교 숙박" },
        { label: "플랫폼 수수료", value: data ? won(sumBy(items, "university", "fee")) : "—", sub: "숙박비의 10%" },
        { label: "대학 지급", value: data ? won(sumBy(items, "university", "payout")) : "—", sub: `${payDay(month)} 지급 예정` },
      ] : [
        { label: "총 거래액", value: data ? won(data.total) : "—" },
        { label: "대학 지급", value: data ? won(sumBy(items, "university", "payout")) : "—", sub: "숙박 매출에서 수수료 제외" },
        { label: "버디 지급", value: data ? won(buddyPayout) : "—", sub: data ? `활동비 × 정산율 ${won(buddyPayout - buddyMeals)} + 식비 ${won(buddyMeals)}` : undefined },
        { label: "여행자 식비 환불", value: data ? won(data.meal_refund_total) : "—", sub: "쓰고 남은 보증금" },
      ]} />

      {!data && !error ? <Spinner /> : (
        <Table cols={[{ label: "지급 대상" }, { label: "건수" }, { label: "매출" }, { label: "지급률" }, { label: "플랫폼 몫" }, { label: "식비 환급" }, { label: "지급액" }, { label: "상태" }]}>
          {items.length === 0 && <EmptyRow cols={8}>정산할 내역이 없어요.</EmptyRow>}
          {items.map((r) => (
            <Tr key={`${r.party_type}-${r.party_id}`}>
              <Td className="font-semibold">{r.target}</Td>
              <Td>{r.count}</Td>
              <Td>{won(r.revenue)}</Td>
              <Td title={r.party_type === "buddy" ? "버디 정산율 (예약 확정 때 고정)" : "대학 지급 90%"}>{r.party_type === "buddy" ? (r.payout_rate != null ? rate(r.payout_rate) : "—") : "90%"}</Td>
              <Td className="text-muted">{won(r.fee)}</Td>
              <Td>{r.meals ? won(r.meals) : <span className="text-muted">–</span>}</Td>
              <Td>{won(r.payout)}</Td>
              <Td>{statusOf(r)}</Td>
            </Tr>
          ))}
        </Table>
      )}
      {data?.profit && <ProfitTable p={data.profit} />}
      {univ ? <Note className="mt-9">대학은 확정된 숙박비의 90%를 받아요. 버디 활동비·식비·수익 구조는 성북스테이 운영팀이 관리해요.</Note> : <Note className="mt-9">식사 보증금과 승인 식비는 여행자 돈을 대신 전하는 금액이라 판매가·원가에 넣지 않아요. 대학은 숙박비의 90%, 버디는 활동비에 동행마다 예약 확정 때 고정한 정산율(기본 70% · 성장 75% · 우수 80%)을 곱한 금액에 승인된 식비를 더해 받아요. 앨범 요금은 전액 플랫폼 수입이에요. 외국인 숙박 신고용 내보내기는 운영 단계에서 열려요.</Note>}
    </section>
  );
}
