import type { Metadata, Viewport } from "next";
import "@fontsource/ibm-plex-sans-kr/400.css";
import "@fontsource/ibm-plex-sans-kr/600.css";
import "@fontsource/ibm-plex-sans-kr/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "성북스테이 SB Stay",
  description: "방학 중 성북 대학 기숙사에 머물며 같은 학교 대학생 버디와 동네를 걷는 여행. AI가 숙소·버디·무료 산책 코스를 한 일정으로 묶어 드려요.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1E3A5F" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
