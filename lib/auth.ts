// NOTE: server-only — Better Auth secret과 OAuth credential이 클라이언트로 새지 않게.
// docs/19 §5.1 (nextCookies 플러그인은 Server Action 안에서 쿠키 설정 가능하게).
import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db/client";

if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error("BETTER_AUTH_SECRET is not set. Check .env.local");
}

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "sqlite" }),
  // NOTE: GitHub OAuth만 v1. 다중 provider는 v3+ 학습 영역. docs/19 §2.
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
  // NOTE: nextCookies 누락 시 Server Action 안에서 쿠키 설정 실패 → 세션 영속 안 됨.
  // docs/18 §7.9 함정 항목.
  plugins: [nextCookies()],
});