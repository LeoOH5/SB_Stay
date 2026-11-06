import { TabBar } from "@/components/ui";

export default function TouristLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mobile-shell flex flex-col">
      <div className="flex-1 flex flex-col">{children}</div>
      <TabBar tabs={[{ href: "/home", label: "홈", icon: "home" }, { href: "/stay", label: "숙박", icon: "bed" }, { href: "/tours", label: "코스", icon: "route" }, { href: "/trips", label: "내 여행", icon: "suitcase", also: ["/me"] }]} hideOn={["/login", "/signup", "/checkout", "/pay", "/cart", "/plan", "^/stay/\\d+$", "^/tours/\\d+$", "^/buddies/\\d+", "^/trips/\\d+/"]} />
    </div>
  );
}
