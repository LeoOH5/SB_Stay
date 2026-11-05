"use client";
// 회원 관리 · 소속 버디 승인
import { useCallback, useEffect, useState } from "react";
import { get, patch } from "@/lib/api";
import type { AdminBuddyRow, ListResponse, User } from "@/lib/types";
import { Button, Spinner, StatusPill } from "@/components/ui";
import { AdminGate, AdminHeader, EmptyRow, ErrorText, Note, ROLE_LABEL, SectionLabel, Table, Td, Tr, errMsg, langs, smallBtn } from "@/components/admin/shell";

const BUDDY_STATUS_LABEL: Record<AdminBuddyRow["status"], string> = { pending: "대기", approved: "승인됨", suspended: "제재" };

export default function AdminMembersPage() {
  const [buddies, setBuddies] = useState<AdminBuddyRow[] | null>(null);
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const loadBuddies = useCallback(async () => {
    const r = await get<ListResponse<AdminBuddyRow>>("/admin/buddies");
    setBuddies(r.items);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [, u] = await Promise.all([loadBuddies(), get<ListResponse<User>>("/admin/users")]);
        if (alive) setUsers(u.items.filter((x) => x.role === "tourist" || x.role === "guide"));
      } catch (e) { if (alive) setError(errMsg(e)); }
    })();
    return () => { alive = false; };
  }, [loadBuddies]);

  async function act(row: AdminBuddyRow, action: "approve" | "suspend") {
    if (action === "suspend" && !window.confirm(`${row.name} 버디를 제재(활동 정지)할까요?`)) return;
    setBusy(row.id); setError(null);
    try { await patch(`/admin/buddies/${row.id}`, { action }); await loadBuddies(); }
    catch (e) { setError(errMsg(e)); }
    finally { setBusy(null); }
  }

  return (
    <AdminGate>
      <AdminHeader title="회원 관리 · 소속 버디 승인" />
      {error && <ErrorText>{error}</ErrorText>}

      <SectionLabel className="mt-0">소속 버디</SectionLabel>
      {!buddies ? <Spinner /> : (
        <Table cols={[{ label: "이름" }, { label: "학교 이메일" }, { label: "전공" }, { label: "언어" }, { label: "상태" }, { label: "" }]}>
          {buddies.length === 0 && <EmptyRow cols={6}>소속 버디가 없어요.</EmptyRow>}
          {buddies.map((b) => (
            <Tr key={b.id}>
              <Td className="font-semibold">{b.name}</Td>
              <Td className="text-muted">{b.email}</Td>
              <Td>{b.major}</Td>
              <Td>{langs(b.languages)}</Td>
              <Td><StatusPill status={b.status} label={BUDDY_STATUS_LABEL[b.status]} /></Td>
              <Td>
                <div className="flex items-center gap-2">
                  {b.status !== "approved" && <Button variant="primary" full={false} className={smallBtn} disabled={busy === b.id} onClick={() => act(b, "approve")}>승인</Button>}
                  {b.status !== "suspended" && <Button variant="ghost" full={false} className={smallBtn} disabled={busy === b.id} onClick={() => act(b, "suspend")}>제재</Button>}
                  {b.status === "approved" && <span className="text-[12px] text-muted ml-1">승인됨</span>}
                </div>
              </Td>
            </Tr>
          ))}
        </Table>
      )}

      {/* 관광객·해설사 목록 */}
      <details className="mt-7 group">
        <summary className="cursor-pointer list-none flex items-center gap-2 text-[15px] font-bold text-ink">
          <span className="text-muted text-[12px] transition group-open:rotate-90">▶</span>
          관광객·해설사 목록
        </summary>
        <div className="mt-2">
          {!users ? <Spinner /> : (
            <Table cols={[{ label: "이름" }, { label: "이메일" }, { label: "역할" }, { label: "언어" }, { label: "소속 대학" }]}>
              {users.length === 0 && <EmptyRow cols={5}>회원이 없어요.</EmptyRow>}
              {users.map((u) => (
                <Tr key={u.id}>
                  <Td className="font-semibold">{u.name}</Td>
                  <Td className="text-muted">{u.email}</Td>
                  <Td><StatusPill status={u.role === "guide" ? "approved" : "info"} label={ROLE_LABEL[u.role]} /></Td>
                  <Td>{u.language.toUpperCase()}</Td>
                  <Td className="text-muted">{u.university_id ?? "—"}</Td>
                </Tr>
              ))}
            </Table>
          )}
        </div>
      </details>

      <Note tone="orange" className="mt-5">대학 담당자는 소속 대학의 객실·예약·버디만 조회·수정할 수 있어요. 운영자는 전체 대학을 관리해요.</Note>
    </AdminGate>
  );
}
