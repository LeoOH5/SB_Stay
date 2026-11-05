import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SB Stay — 성북 대학 기숙사에 머물며 걷는 역사 여행",
  description: "방학 중 성북 대학 기숙사 숙박 + 해설사 역사 투어 + 대학생 버디를 AI가 하나의 일정으로",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1f2a44" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
