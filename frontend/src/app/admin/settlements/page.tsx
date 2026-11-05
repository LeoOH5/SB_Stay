"use client";
// 정산 관리 (A-04 · 목업) 단독 페이지 — GET /admin/settlements (AD-06). A3 하단 섹션과 같은 컴포넌트
import { AdminGate, AdminHeader } from "@/components/admin/shell";
import { SettlementSection } from "@/components/admin/settlement-section";

export default function AdminSettlementsPage() {
  return (
    <AdminGate>
      <AdminHeader title="정산 관리 (A-04 · 목업 숫자 · 운영자만)" sub="GET /admin/settlements (AD-06) 고정 응답 · 수수료율 10% 상수" />
      <SettlementSection titleTag={false} />
    </AdminGate>
  );
}
