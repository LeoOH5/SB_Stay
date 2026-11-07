import { TouristTabBar } from "@/components/tourist/tab-bar";

export default function TouristLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mobile-shell flex flex-col">
      <div className="flex-1 flex flex-col">{children}</div>
      <TouristTabBar />
    </div>
  );
}
