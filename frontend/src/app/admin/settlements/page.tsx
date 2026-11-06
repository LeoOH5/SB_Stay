"use client";
// A05 정산 — 운영자: 대학·버디 전체 + 수익 구조 / 대학 담당자: 자기 학교 숙박 정산만
import { useState } from "react";
import { AdminGate, AdminHeader, Select } from "@/components/admin/shell";
import { useUser } from "@/lib/auth";
import { SettlementSection } from "@/components/admin/settlement-section";

const MONTHS = ["2026-12", "2027-01", "2027-02"].map((m) => ({ value: m, label: `${m.slice(0, 4)}년 ${Number(m.slice(5))}월` }));

export default function AdminSettlementsPage() {
  const [month, setMonth] = useState("2027-01");
  const { user } = useUser();
  const univ = user?.role === "univ_admin";
  return (
    <AdminGate>
      <AdminHeader
        title="정산"
        sub={univ ? "우리 학교 숙박 정산 · 확정된 예약 기준 · 숙박비의 90%를 대학에 지급" : "확정된 예약 기준 · 숙박 수수료 10% · 버디는 등급 정산율(70~80%) · 식비는 수수료 없음"}
        right={<Select label="정산 월" value={month} onChange={setMonth} options={MONTHS} className="w-[146px]" />}
      />
      <SettlementSection month={month} />
    </AdminGate>
  );
}
