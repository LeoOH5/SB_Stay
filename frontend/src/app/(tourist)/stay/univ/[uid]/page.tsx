"use client";
// T05 숙박 — 한 대학의 방만 (DM-02 GET /dorms 를 대학으로 거름)
import { useParams } from "next/navigation";
import { StayList } from "@/components/tourist/v3/stay-list";

export default function UnivDormsPage() {
  const { uid } = useParams<{ uid: string }>();
  return <StayList universityId={Number(uid)} />;
}
