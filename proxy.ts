// NOTE: Next.js 16의 proxy.ts (이전 middleware.ts 대체).
// 1차 가드 — 쿠키 존재만 빠르게 검증 (DB 라운드트립 없음).
// "쿠키 존재 ≠ 세션 유효" — Server Component / Action에서 auth.api.getSession 재검증 필수.
// docs/19 §5.4, §5.5 (3층 방어 패턴).
import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

// NOTE: 매처 — auth API 라우트, Next.js 정적 자원, 로그인 페이지는 통과.
// 이 정규식이 가드 받는 라우트(/, /bookmarks/*)를 결정.
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login).*)"],
};