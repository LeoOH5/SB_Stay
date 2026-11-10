"use client";
// T14 여행자 정보 → BK-01 예약 신청 → 결제. 요청 사항은 항목마다 따로 적었으므로 여기서는 받지 않는다
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Banner, Button, Chip, Icon, TopBar, inputCls } from "@/components/ui";
import { ErrorBox } from "@/components/tourist";
import { submitBooking } from "@/components/tourist/booking";
import { loginHref, SS_TRAVELER } from "@/components/tourist/format";
import { readSS, writeSS } from "@/components/tourist/session";
import { BottomBar, FieldLabel, Headline, TotalLine } from "@/components/tourist/v3";
import { bookingErr, isBuddyRequest, isDormRequest } from "@/components/tourist/v3/flow";
import { curLang, money, tr, useLang } from "@/lib/i18n";
import { useUser } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { DORM_REQUEST, keysOf, label, requestChips } from "@/lib/codes";
import type { Traveler } from "@/lib/types";

const NATIONS: { code: string; label: string; en: string }[] = [
  { code: "US", label: "미국", en: "United States" }, { code: "JP", label: "일본", en: "Japan" }, { code: "CN", label: "중국", en: "China" }, { code: "GB", label: "영국", en: "United Kingdom" }, { code: "FR", label: "프랑스", en: "France" },
  { code: "DE", label: "독일", en: "Germany" }, { code: "AU", label: "호주", en: "Australia" }, { code: "KR", label: "한국", en: "Korea" }, { code: "OTHER", label: "기타", en: "Other" },
];
const EMPTY: Traveler = { name: "", nationality: "US", email: "", passport_no: "", emergency_contact: "", guests: 1 };

export default function CheckoutPage() {
  useLang();
  const router = useRouter();
  const cart = useCart();
  const { user } = useUser();
  const [form, setForm] = useState<Traveler>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const hasDorm = cart.items.some((i) => i.type === "dorm");

  const prefill = () => {
    const saved = readSS<Traveler | null>(SS_TRAVELER, null);
    // 데모 계정은 비상 연락처까지 채워 두어 바로 다음 단계로 넘어갈 수 있게
    const demo = user?.is_demo ? { emergency_contact: "+1 555 0100" } : {};
    setForm(saved ? { ...EMPTY, ...saved } : { ...EMPTY, ...demo, name: user?.name ?? "", email: user?.email ?? "" });
  };
  const set = <K extends keyof Traveler>(k: K, v: Traveler[K]) => setForm((f) => ({ ...f, [k]: v }));

  // 항목별 요청 요약 — 숙박: 조용한 방 / 버디: 비건, 버섯 알레르기
  const reqSummary = cart.items.map((i) => {
    if (i.type === "dorm" && isDormRequest(i.request)) return keysOf(DORM_REQUEST).filter((k) => (i.request as Record<string, boolean>)[k]).map((k) => label(DORM_REQUEST, k, curLang())).join(", ");
    if (i.type === "buddy" && isBuddyRequest(i.request)) return requestChips(i.request, curLang()).join(", ");
    return "";
  }).filter(Boolean);

  const submit = async () => {
    setErr(null);
    if (!form.name.trim() || !form.email.trim()) { setErr(tr("이름과 이메일은 꼭 적어 주세요", "Please enter your name and email")); return; }
    const traveler: Traveler = { ...form, name: form.name.trim(), email: form.email.trim(), passport_no: form.passport_no?.trim() || undefined, emergency_contact: form.emergency_contact?.trim() || undefined, note: undefined };
    writeSS(SS_TRAVELER, traveler);
    if (cart.items.length === 0) { router.push("/cart"); return; }
    if (!user) { router.push(loginHref("/checkout")); return; }
    setBusy(true);
    try {
      const { booking, needsPayment } = await submitBooking(traveler, cart.items);
      router.push(needsPayment ? `/pay?booking=${booking.id}` : `/cart/done?id=${booking.id}`);
    } catch (e) { setErr(bookingErr(e)); setBusy(false); }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <TopBar back="/cart" right={<span className="text-muted">1 / 2</span>} />
      <Headline className="pt-2" title={tr("여행자 정보", "Traveler info")} sub={tr("숙박 승인과 체크인에 필요한 정보를 한 번만 받아요.", "We ask once for what's needed for stay approval and check-in.")} />
      <div className="space-y-5 px-5 pb-4 pt-6">
        <button type="button" onClick={prefill} className="flex h-[52px] w-full items-center justify-between rounded-[14px] border border-line px-4 text-[15px] font-semibold text-ink">
          {tr("계정 정보로 채우기", "Fill from my account")}<Icon name="chevron-right" className="h-5 w-5" />
        </button>
        <label className="block"><FieldLabel>{tr("이름 (여권과 같게)", "Name (as on passport)")}</FieldLabel><input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Emma Clark" autoComplete="name" /></label>
        <label className="block"><FieldLabel>{tr("국적", "Nationality")}</FieldLabel>
          <div className="relative">
            <select className={`${inputCls} appearance-none`} value={form.nationality} onChange={(e) => set("nationality", e.target.value)}>
              {NATIONS.map((n) => <option key={n.code} value={n.code}>{tr(n.label, n.en)}</option>)}
            </select>
            <Icon name="chevron-down" className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink" />
          </div>
        </label>
        <label className="block"><FieldLabel>{tr("이메일", "Email")}</FieldLabel><input className={inputCls} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="emma@example.com" autoComplete="email" /></label>
        <label className="block"><FieldLabel extra={hasDorm ? undefined : tr("선택", "Optional")}>{tr("여권번호", "Passport number")}</FieldLabel>
          <input className={inputCls} value={form.passport_no ?? ""} onChange={(e) => set("passport_no", e.target.value)} placeholder="C12345678" autoComplete="off" />
          <span className="mt-2 block text-[13.5px] leading-relaxed text-muted">{tr("숙박을 승인하는 대학 담당자만 볼 수 있어요. 버디에게는 이름과 국적만 보여요", "Only the university staff approving your stay can see this. Your buddy sees only your name and nationality")}</span>
        </label>
        <label className="block"><FieldLabel>{tr("긴급 연락처", "Emergency contact")}</FieldLabel><input className={inputCls} value={form.emergency_contact ?? ""} onChange={(e) => set("emergency_contact", e.target.value)} placeholder="+1 555 0100 (Mother)" /></label>
        <div>
          <FieldLabel>{tr("인원", "Guests")}</FieldLabel>
          <div className="flex gap-2">{[1, 2, 3].map((n) => <Chip key={n} selected={(form.guests ?? 1) === n} onClick={() => set("guests", n)}>{n === 3 ? tr("3명 이상", "3+") : tr(`${n}명`, `${n}`)}</Chip>)}</div>
        </div>
        <Banner variant="soft" icon="list"><span className="font-normal">{tr("요청 사항은 숙박과 버디마다 따로 적었어요", "Requests were added for each stay and buddy")}{reqSummary.length ? ` · ${reqSummary.join(" / ")}` : ""}</span></Banner>
        <ErrorBox message={err} />
        {cart.items.length === 0 && <p className="text-center text-[13px] text-muted">{tr("장바구니가 비어 있어요. 정보만 저장돼요.", "Your cart is empty. Only your info will be saved.")} <Link href="/cart" className="font-semibold text-navy">{tr("장바구니", "Cart")}</Link></p>}
      </div>

      <BottomBar>
        <TotalLine label={tr(`합계 ${cart.items.length}개`, `Total · ${cart.items.length} item${cart.items.length > 1 ? "s" : ""}`)} amount={money(cart.total)} />
        <Button type="submit" className="mt-3" disabled={busy}>{busy ? tr("신청 중…", "Booking…") : tr("다음: 결제", "Next: payment")}</Button>
      </BottomBar>
    </form>
  );
}
