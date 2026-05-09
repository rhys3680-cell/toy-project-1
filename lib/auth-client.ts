// NOTE: 이 파일은 Client Component에서 import 가능. server-only 가드 없음.
// 다만 secret은 노출 안 됨 — baseURL 외엔 클라이언트 단에서 fetch만 함.
import { createAuthClient } from "better-auth/react";

// NOTE: NEXT_PUBLIC_BETTER_AUTH_URL 미설정 시 환경별 함정 — prod 도메인에서
// localhost로 fetch 시도 → CORS. fallback 두지 않고 fail-fast로 환경변수 강제.
// dev/prod 양쪽 .env에 명시. docs/15 §11.4, §11.6.
if (!process.env.NEXT_PUBLIC_BETTER_AUTH_URL) {
  throw new Error(
    "NEXT_PUBLIC_BETTER_AUTH_URL is not set. Check .env.local or Vercel env.",
  );
}

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
});