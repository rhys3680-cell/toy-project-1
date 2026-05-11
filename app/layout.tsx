import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { KeyboardShortcuts } from "./keyboard-shortcuts";
import { ThemeProvider } from "./theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bookmark Manager",
  description: "개발자용 북마크 매니저 — 링크를 태그로 정리하고 검색합니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      // NOTE: suppressHydrationWarning — next-themes가 inline script로 <html>에
      // class를 *body 렌더 전*에 적용 (FOUC 방지). 서버 HTML과 클라이언트가 잠시
      // 다른 상태가 되는데, 이 한 줄 외 다른 영역엔 영향 없음. next-themes 권장.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          {children}
          {/* NOTE: sonner Toaster — 모든 페이지에서 toast() 호출 가능.
              position 우측 하단 default 유지. richColors로 success/error 색 명시. */}
          <Toaster position="bottom-right" richColors closeButton />
          {/* NOTE: 글로벌 키보드 단축키. 자세한 건 keyboard-shortcuts.tsx 상단. */}
          <KeyboardShortcuts />
        </ThemeProvider>
      </body>
    </html>
  );
}
