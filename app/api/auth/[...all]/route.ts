// NOTE: Better Auth의 catch-all handler. /api/auth/* 모든 경로를 받음
// (signin, signout, callback/github, get-session 등).
// docs/18 §2 handler 라우트.
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);