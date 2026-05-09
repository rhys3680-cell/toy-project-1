// NOTE: 통합 테스트 — NULL UNIQUE 함정 회귀 방지.
// docs/22 §13 우선 ★★★★★, docs/cases/null-unique-pitfall, docs/08 §5.
//
// 이 테스트가 통과하면:
//  - 같은 user의 같은 name 태그 두 번 INSERT는 *DB가 거부*
//  - 다른 user의 같은 name 태그는 *DB가 허용*
//
// 이 테스트가 깨지면 NULL 함정이 다시 발생했다는 시그널. partial unique index
// 또는 user_id NOT NULL 정책이 흔들렸다.
import { describe, expect, test } from "vitest";
import { tags } from "@/lib/db/schema";
import { createTestDb, createTestUser } from "./db";

describe("tags UNIQUE 동작 — user_id NOT NULL 이후", () => {
  test("같은 사용자의 같은 이름 태그는 두 번째 INSERT 거부", async () => {
    const db = await createTestDb();
    const u = await createTestUser(db);

    await db.insert(tags).values({ userId: u.id, name: "react" });

    await expect(
      db.insert(tags).values({ userId: u.id, name: "react" }),
    ).rejects.toThrow();
  });

  test("다른 사용자는 같은 이름 태그 가능 (user_id, name UNIQUE 의도)", async () => {
    const db = await createTestDb();
    const alice = await createTestUser(db, { name: "Alice" });
    const bob = await createTestUser(db, { name: "Bob" });

    await db.insert(tags).values({ userId: alice.id, name: "react" });
    await db.insert(tags).values({ userId: bob.id, name: "react" });

    const all = await db.select().from(tags);
    expect(all).toHaveLength(2);
    expect(all.map((t) => t.name)).toEqual(["react", "react"]);
  });

  test("같은 사용자의 다른 이름 태그는 자유롭게 추가", async () => {
    const db = await createTestDb();
    const u = await createTestUser(db);

    await db.insert(tags).values({ userId: u.id, name: "react" });
    await db.insert(tags).values({ userId: u.id, name: "typescript" });
    await db.insert(tags).values({ userId: u.id, name: "nextjs" });

    const all = await db.select().from(tags);
    expect(all).toHaveLength(3);
  });

  test("user 삭제 시 그의 태그도 CASCADE로 삭제", async () => {
    const db = await createTestDb();
    const u = await createTestUser(db);
    await db.insert(tags).values({ userId: u.id, name: "react" });

    // user 삭제는 schema의 user 테이블에서. ON DELETE CASCADE가 tags까지 따라감.
    const { user } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    await db.delete(user).where(eq(user.id, u.id));

    const remaining = await db.select().from(tags);
    expect(remaining).toHaveLength(0);
  });
});