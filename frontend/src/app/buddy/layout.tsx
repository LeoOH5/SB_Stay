import { TabBar } from "@/components/ui";

// 버디 앱 — 탭: 홈 · 요청함 · 일정 · 내 활동. 로그인·지원·식비 청구·활동 기록 화면은 탭바 없이 아래 버튼 줄을 쓴다.
export default function BuddyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mobile-shell flex flex-col">
      <div className="flex flex-1 flex-col">{children}</div>
      <TabBar tabs={[{ href: "/buddy", label: "홈", icon: "home" }, { href: "/buddy/requests", label: "요청함", icon: "inbox" }, { href: "/buddy/schedule", label: "일정", icon: "calendar" }, { href: "/buddy/activity", label: "내 활동", icon: "user", also: ["/buddy/settlement", "/buddy/me"] }]} hideOn={["/buddy/login", "/buddy/apply", "/buddy/meals", "/buddy/log"]} />
    </div>
  );
}
