import { TabBar } from "@/components/ui";

export default function BuddyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mobile-shell flex flex-col">
      <div className="flex-1 flex flex-col">{children}</div>
      <TabBar tabs={[{ href: "/buddy", label: "홈" }, { href: "/buddy/requests", label: "요청함" }, { href: "/buddy/schedule", label: "일정" }, { href: "/buddy/activity", label: "내 활동" }]} hideOn={["/buddy/login"]} />
    </div>
  );
}
