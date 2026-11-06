"use client";
// 정산 관리 단독 페이지 — 예약 관리 하단 섹션과 같은 컴포넌트
import { AdminGate, AdminHeader } from "@/components/admin/shell";
import { SettlementSection } from "@/components/admin/settlement-section";

export default function AdminSettlementsPage() {
  return (
    <AdminGate>
      <AdminHeader title="정산 관리" />
      <SettlementSection titleTag={false} />
    </AdminGate>
  );
}
