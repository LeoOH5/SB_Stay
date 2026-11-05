"use client";
// 여행자 정보 입력 → 예약 신청 · 결제
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Chip, Field, Hero, inputCls, TopBar } from "@/components/ui";
import { ErrorBox, Notice, selectCls, textareaCls } from "@/components/tourist";
import { submitBooking } from "@/components/tourist/booking";
import { errMsg, SS_TRAVELER } from "@/components/tourist/format";
import { readSS, writeSS } from "@/components/tourist/session";
import { won } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import type { Traveler } from "@/lib/types";

const NATIONS: { code: string; label: string }[] = [
  { code: "US", label: "United States" }, { code: "JP", label: "Japan" }, { code: "KR", label: "Korea" }, { code: "FR", label: "France" },
  { code: "DE", label: "Germany" }, { code: "AU", label: "Australia" }, { code: "CN", label: "China" }, { code: "GB", label: "United Kingdom" }, { code: "OTHER", label: "Other" },
];

export default function CheckoutPage() {
  const router = useRouter();
  const cart = useCart();
  const { user } = useUser();
  // 이전에 입력한 값이 있으면 채운다 (lazy init은 클라이언트 전용 페이지라 하이드레이션 후 값이 다르면 경고만 날 수 있어, 핸들러에서 읽는다)
  const [form, setForm] = useState<Traveler>({ name: "", nationality: "US", email: "", passport_no: "", emergency_contact: "", guests: 1, note: "" });
  const [filled, setFilled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const hasDorm = cart.items.some((i) => i.type === "dorm");

  const prefill = () => {
    const saved = readSS<Traveler | null>(SS_TRAVELER, null);
    setForm(saved ?? { name: user?.name ?? "", nationality: "US", email: user?.email ?? "", passport_no: "", emergency_contact: "", guests: 1, note: "" });
    setFilled(true);
  };
  const set = <K extends keyof Traveler>(k: K, v: Traveler[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setErr(null);
    if (!form.name.trim() || !form.email.trim()) { setErr("이름과 이메일은 필수예요"); return; }
    const traveler: Traveler = { ...form, name: form.name.trim(), email: form.email.trim(), passport_no: form.passport_no?.trim() || undefined, emergency_contact: form.emergency_contact?.trim() || undefined, note: form.note?.trim() || undefined };
    writeSS(SS_TRAVELER, traveler);
    if (cart.items.length === 0) { router.push("/cart"); return; }
    if (!user) { router.push("/login"); return; }
    setBusy(true);
    try {
      const b = await submitBooking(traveler, cart.items);
      router.push(`/cart/done?id=${b.id}`);
    } catch (e) { setErr(errMsg(e)); setBusy(false); }
  };

  return (
    <>
      <TopBar back="/cart" title="여행자 정보" />
      <Hero title="Traveler info" sub="숙박 승인·체크인에 필요한 정보를 한 번만 입력해요." right={<span className="rounded-lg bg-green px-2.5 py-1 text-[12px] font-semibold text-navy">1 / 2</span>} />
      <form className="px-5 pb-6 pt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        {!filled && (
          <Card tint className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-navy">이전 입력값·계정 정보로 채울까요?</span>
            <Button full={false} variant="ghost" className="h-9 min-h-[36px] px-3 text-[13px]" onClick={prefill}>불러오기</Button>
          </Card>
        )}
        <Field label="이름 (여권과 동일)"><input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Emma Clark" required /></Field>
        <Field label="국적">
          <select className={selectCls} value={form.nationality} onChange={(e) => set("nationality", e.target.value)}>
            {NATIONS.map((n) => <option key={n.code} value={n.code}>{n.label}</option>)}
          </select>
        </Field>
        <Field label="이메일"><input className={inputCls} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="emma@example.com" required /></Field>
        <Field label={`여권번호 (선택${hasDorm ? " · 숙박 항목이 있을 때만" : ""})`}>
          <input className={inputCls} value={form.passport_no ?? ""} onChange={(e) => set("passport_no", e.target.value)} placeholder="C12345678" />
        </Field>
        <Notice>승인 후 대학 담당자에게만 전달돼요. (최소 수집 원칙)</Notice>
        <Field label="긴급연락처"><input className={inputCls} value={form.emergency_contact ?? ""} onChange={(e) => set("emergency_contact", e.target.value)} placeholder="+1 555 0100 (Mother)" /></Field>
        <div>
          <span className="block text-[12px] text-muted mb-1.5">동행 인원</span>
          <div className="flex gap-2">
            {[1, 2, 3].map((n) => <Chip key={n} selected={(form.guests ?? 1) === n} onClick={() => set("guests", n)}>{n === 3 ? "3명+" : `${n}명`}</Chip>)}
          </div>
        </div>
        <Field label="특이사항 (선택)"><textarea className={textareaCls} value={form.note ?? ""} onChange={(e) => set("note", e.target.value)} placeholder="Vegetarian, late check-in…" /></Field>
        <div className="flex items-end justify-between pt-1"><span className="text-[13px] text-muted">합계 ({cart.items.length}개)</span><span className="text-[22px] font-bold text-navy">{won(cart.total)}</span></div>
        <ErrorBox message={err} />
        <Button type="submit" disabled={busy}>{busy ? "신청 중…" : "다음 → 결제"}</Button>
        {cart.items.length === 0 && <p className="text-[12px] text-muted text-center">장바구니가 비어 있어요. 정보만 저장돼요. <Link href="/cart" className="text-navy">장바구니</Link></p>}
      </form>
    </>
  );
}
