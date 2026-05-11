"use client";

// NOTE: next-themes 얇은 wrapper. Server Component인 layout에서 직접 import 못 함
// (next-themes의 Provider가 Client). 한 자리에서 Client 경계 명시.
//
// 설정:
//   attribute="class"        — <html>에 "dark" class 토글 (Tailwind v4 + shadcn 표준)
//   defaultTheme="system"    — OS 설정 따라감 (docs/01 v1 정책)
//   enableSystem             — system 모드 활성
//   disableTransitionOnChange — 전환 깜빡임 차단
//
// 토글 UI는 도입 안 함 (v1 정책 그대로 — 시스템 따라감). v3+에 사용자 토글 추가 시
// next-themes의 useTheme()으로 자연 확장 가능.
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}