// NOTE: 통합 테스트 — FK CASCADE 동작 검증.
// docs/22 §13 우선 ★★★, docs/13 Q4·Q5 결정의 회귀 방지.
//
// CASCADE는 SQL 제약이라 코드 변경에 직접 노출 안 되지만, 마이그레이션 잘못 적용 시
// 깨질 수 있음. 회귀 안전망.
import { describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { bookmarks, bookmarkTags, tags, user } from "@/lib/db/schema";
import { createTestDb, createTestUser } from "./db";

describe("ON DELETE CASCADE", () => {
  test("bookmark 삭제 시 그 북마크의 bookmark_tags 행도 함께 삭제", async () => {
    const db = await createTestDb();
    const u = await createTestUser(db);

    const bookmarkId = crypto.randomUUID();
    await db.insert(bookmarks).values({
      id: bookmarkId,
      userId: u.id,
      url: "https://x.example.com",
      title: null,
      description: null,
      image: null,
      createdAt: new Date(),
    });

    const [t] = await db
      .insert(tags)
      .values({ userId: u.id, name: "react" })
      .returning({ id: tags.id });
    await db.insert(bookmarkTags).values({ bookmarkId, tagId: t.id });

    await db.delete(bookmarks).where(eq(bookmarks.id, bookmarkId));

    // bookmark_tags의 그 북마크 연결 자동 삭제
    const remaining = await db.select().from(bookmarkTags);
    expect(remaining).toHaveLength(0);
    // tags 자체는 안 지워짐 (다른 북마크가 같은 태그를 가질 수 있으므로)
    const remainingTags = await db.select().from(tags);
    expect(remainingTags).toHaveLength(1);
  });

  test("user 삭제 시 그 사용자의 bookmarks/tags 모두 CASCADE", async () => {
    const db = await createTestDb();
    const u = await createTestUser(db);

    const bookmarkId = crypto.randomUUID();
    await db.insert(bookmarks).values({
      id: bookmarkId,
      userId: u.id,
      url: "https://x.example.com",
      title: null,
      description: null,
      image: null,
      createdAt: new Date(),
    });
    const [t] = await db
      .insert(tags)
      .values({ userId: u.id, name: "react" })
      .returning({ id: tags.id });
    await db.insert(bookmarkTags).values({ bookmarkId, tagId: t.id });

    await db.delete(user).where(eq(user.id, u.id));

    expect(await db.select().from(bookmarks)).toHaveLength(0);
    expect(await db.select().from(tags)).toHaveLength(0);
    expect(await db.select().from(bookmarkTags)).toHaveLength(0);
  });
});