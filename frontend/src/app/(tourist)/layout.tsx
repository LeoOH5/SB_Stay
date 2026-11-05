import { TabBar } from "@/components/ui";

export default function TouristLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mobile-shell flex flex-col">
      <div className="flex-1 flex flex-col">{children}</div>
      <TabBar tabs={[{ href: "/home", label: "홈" }, { href: "/stay", label: "숙박" }, { href: "/tours", label: "투어" }, { href: "/trips", label: "내 여행" }, { href: "/me", label: "마이" }]} hideOn={["/login", "/signup", "/checkout", "/pay"]} />
    </div>
  );
}
