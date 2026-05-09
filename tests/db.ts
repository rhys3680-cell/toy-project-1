// NOTE: 통합 테스트용 in-memory libsql DB 빌더.
// 매 테스트마다 createTestDb() 호출 → 새 격리 DB + 마이그레이션 적용.
// 테스트 간 격리 완벽 (FIRST 원칙의 Isolated). docs/22 §8.

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "@/lib/db/schema";

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

export async function createTestDb(): Promise<TestDb> {
  // NOTE: ":memory:" — 프로세스 메모리에만 존재. 파일 X. 매번 깔끔.
  const client = createClient({ url: ":memory:" });
  // NOTE: PRAGMA foreign_keys = ON — docs/09 Phase 2-① 학습 그대로.
  // 운영 코드(lib/db/client.ts)와 동일 정책 유지.
  await client.execute("PRAGMA foreign_keys = ON");
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}

// NOTE: Better Auth user 행 fixture. 실제 OAuth 흐름 거치지 않고 직접 INSERT.
// FK 만족이 목적 — 인증 자체를 테스트하는 게 아니라 *우리 비즈니스 로직*이 user_id로
// 격리되는지 검증. docs/22 §3.3 (Better Auth 처리: 3-2 직접 INSERT).
export async function createTestUser(
  db: TestDb,
  overrides: { id?: string; name?: string; email?: string } = {},
): Promise<{ id: string; email: string; name: string }> {
  const id = overrides.id ?? crypto.randomUUID();
  const email = overrides.email ?? `${id}@test.example.com`;
  const name = overrides.name ?? "Test User";
  const now = new Date();

  await db.insert(schema.user).values({
    id,
    email,
    name,
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  });

  return { id, email, name };
}