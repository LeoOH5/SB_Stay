"use client";
// 관광객 하단 탭 — 언어 설정(useLang)을 따른다
import { TabBar } from "@/components/ui";
import { useLang } from "@/lib/i18n";

export function TouristTabBar() {
  const { t } = useLang();
  return (
    <TabBar tabs={[{ href: "/home", label: t.home, icon: "home" }, { href: "/stay", label: t.stay, icon: "bed" }, { href: "/tours", label: t.tour, icon: "route" }, { href: "/trips", label: t.trips, icon: "suitcase", also: ["/me"] }]} hideOn={["/login", "/signup", "/checkout", "/pay", "/cart", "/plan", "^/stay/\\d+$", "^/tours/\\d+$", "^/buddies/\\d+", "^/trips/\\d+/"]} />
  );
}
