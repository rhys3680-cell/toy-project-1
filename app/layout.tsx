import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/* NOTE: sonner Toaster — 모든 페이지에서 toast() 호출 가능.
            position 우측 하단 default 유지. richColors로 success/error 색 명시. */}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
