// NOTE: server-only — Client Component가 실수로 import하면 빌드 에러.
// DB 자격증명/시크릿이 클라이언트 번들에 누출되는 사고 차단 가드.
// docs/12 §7, docs/16 §7.5.
import "server-only";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Check .env.local");
}

const globalForDb = globalThis as unknown as {
  client?: Client;
};

const client =
  globalForDb.client ??
  createClient({
    url: process.env.DATABASE_URL,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.client = client;
}

// NOTE: libsql은 기본 ON이지만 명시. 드라이버/환경 변경 시 흔들림 방어.
// "이미 ON이어도 무해" — 안전벨트. scratch Phase 2-① 검증으로 확정.
// 자세한 건 docs/14 §7.6, docs/09 학습 로그.
await client.execute("PRAGMA foreign_keys = ON");

export const db = drizzle(client, {
  schema,
  logger: process.env.NODE_ENV !== "production",
});