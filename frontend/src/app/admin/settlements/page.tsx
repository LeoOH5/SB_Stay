"use client";
// A05 정산 (운영팀 전용)
import { useState } from "react";
import { AdminHeader, OperatorOnly, Select } from "@/components/admin/shell";
import { SettlementSection } from "@/components/admin/settlement-section";

const MONTHS = ["2026-12", "2027-01", "2027-02"].map((m) => ({ value: m, label: `${m.slice(0, 4)}년 ${Number(m.slice(5))}월` }));

export default function AdminSettlementsPage() {
  const [month, setMonth] = useState("2027-01");
  return (
    <OperatorOnly title="정산">
      <AdminHeader
        title="정산"
        sub="확정된 예약 기준, 수수료율 10% · 식비는 수수료 없음"
        right={<Select label="정산 월" value={month} onChange={setMonth} options={MONTHS} className="w-[146px]" />}
      />
      <SettlementSection month={month} />
    </OperatorOnly>
  );
}
