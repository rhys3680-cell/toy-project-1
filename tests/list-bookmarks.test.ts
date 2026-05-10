// NOTE: 통합 테스트 — listBookmarks가 user 격리 정확히 지키는지.
// docs/22 §13 우선 ★★★★, IDOR 회귀 방지.
//
// 이 테스트가 통과하면 listBookmarks(userIdA)가 userB의 데이터를 절대 안 돌려줌.
// 깨지면 IDOR — 다른 사용자 데이터 접근 가능.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { bookmarks, bookmarkTags, tags } from "@/lib/db/schema";
import { createTestDb, createTestUser, type TestDb } from "./db";

// NOTE: lib/db/queries는 lib/db/client의 db를 import. 테스트에선 우리 testDb로 교체.
// vi.mock으로 db export를 가짜로 바꿈.
let testDb: TestDb;

vi.mock("@/lib/db/client", () => ({
  get db() {
    return testDb;
  },
}));

const { listBookmarks } = await import("@/lib/db/queries");

beforeEach(async () => {
  testDb = await createTestDb();
});

afterEach(() => {
  vi.clearAllMocks();
});

async function insertBookmark(
  db: TestDb,
  userId: string,
  url: string,
  title?: string,
) {
  const id = crypto.randomUUID();
  await db.insert(bookmarks).values({
    id,
    userId,
    url,
    title: title ?? null,
    description: null,
    image: null,
    createdAt: new Date(),
  });
  return id;
}

describe("listBookmarks — user 격리", () => {
  test("자기 사용자 북마크만 반환", async () => {
    const alice = await createTestUser(testDb, { name: "Alice" });
    const bob = await createTestUser(testDb, { name: "Bob" });

    await insertBookmark(testDb, alice.id, "https://alice-1.example.com");
    await insertBookmark(testDb, alice.id, "https://alice-2.example.com");
    await insertBookmark(testDb, bob.id, "https://bob-1.example.com");

    const aliceItems = await listBookmarks(alice.id);
    expect(aliceItems).toHaveLength(2);
    expect(aliceItems.every((b) => b.userId === alice.id)).toBe(true);

    const bobItems = await listBookmarks(bob.id);
    expect(bobItems).toHaveLength(1);
    expect(bobItems[0].url).toBe("https://bob-1.example.com");
  });

  test("존재하지 않는 user_id는 빈 배열", async () => {
    const u = await createTestUser(testDb);
    await insertBookmark(testDb, u.id, "https://x.example.com");

    const items = await listBookmarks("non-existent-user-id");
    expect(items).toEqual([]);
  });

  test("검색 키워드 — title 매치 (자기 범위 안에서만)", async () => {
    const alice = await createTestUser(testDb, { name: "Alice" });
    const bob = await createTestUser(testDb, { name: "Bob" });

    await insertBookmark(testDb, alice.id, "https://x1.example.com", "react guide");
    await insertBookmark(testDb, alice.id, "https://x2.example.com", "vue guide");
    await insertBookmark(testDb, bob.id, "https://b1.example.com", "react patterns");

    const aliceReact = await listBookmarks(alice.id, { query: "react" });
    expect(aliceReact).toHaveLength(1);
    expect(aliceReact[0].title).toBe("react guide");
    // ↑ Bob의 "react patterns"는 안 나옴. user 격리 + 검색 동시.
  });

  test("검색 키워드 — 태그 매치 (M:N + EXISTS 서브쿼리)", async () => {
    const u = await createTestUser(testDb);
    const bid = await insertBookmark(testDb, u.id, "https://x.example.com");

    const [tagRow] = await testDb
      .insert(tags)
      .values({ userId: u.id, name: "typescript" })
      .returning({ id: tags.id });
    await testDb.insert(bookmarkTags).values({ bookmarkId: bid, tagId: tagRow.id });

    const items = await listBookmarks(u.id, { query: "typescript" });
    expect(items).toHaveLength(1);
    expect(items[0].tags).toEqual(["typescript"]);
  });

  test("태그는 알파벳순 정렬 (입력 순서 무관)", async () => {
    const u = await createTestUser(testDb);
    const bid = await insertBookmark(testDb, u.id, "https://x.example.com");

    const tagRows = await testDb
      .insert(tags)
      .values([
        { userId: u.id, name: "zebra" },
        { userId: u.id, name: "apple" },
        { userId: u.id, name: "monkey" },
      ])
      .returning({ id: tags.id });
    await testDb.insert(bookmarkTags).values(
      tagRows.map((t) => ({ bookmarkId: bid, tagId: t.id })),
    );

    const items = await listBookmarks(u.id);
    expect(items[0].tags).toEqual(["apple", "monkey", "zebra"]);
  });

  test("createdAt DESC 정렬", async () => {
    const u = await createTestUser(testDb);
    // createTestDb 안 createdAt이 모두 new Date()라 ms 차이만 있음. 강제 분리.
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const id = crypto.randomUUID();
      await testDb.insert(bookmarks).values({
        id,
        userId: u.id,
        url: `https://x${i}.example.com`,
        title: null,
        description: null,
        image: null,
        createdAt: new Date(2026, 4, i + 1),
      });
      ids.push(id);
    }

    const items = await listBookmarks(u.id);
    // 마지막 추가(2026-05-03)가 첫 번째
    expect(items[0].id).toBe(ids[2]);
    expect(items[2].id).toBe(ids[0]);
  });
});

describe("listBookmarks — tag 필터 (정확 매치)", () => {
  // 헬퍼 — bookmark + tag 한 줄에 만들기. 같은 (user, name) 태그가 이미 있으면 재사용.
  async function bookmarkWithTags(userId: string, url: string, tagNames: string[]) {
    const bid = await insertBookmark(testDb, userId, url);
    if (tagNames.length === 0) return bid;

    const { inArray, eq, and } = await import("drizzle-orm");
    const existing = await testDb
      .select({ id: tags.id, name: tags.name })
      .from(tags)
      .where(and(eq(tags.userId, userId), inArray(tags.name, tagNames)));
    const existingNames = new Set(existing.map((t) => t.name));
    const newNames = tagNames.filter((n) => !existingNames.has(n));

    let inserted: { id: number; name: string }[] = [];
    if (newNames.length > 0) {
      inserted = await testDb
        .insert(tags)
        .values(newNames.map((name) => ({ userId, name })))
        .returning({ id: tags.id, name: tags.name });
    }

    const allIds = [...existing, ...inserted].map((t) => t.id);
    await testDb
      .insert(bookmarkTags)
      .values(allIds.map((tagId) => ({ bookmarkId: bid, tagId })));
    return bid;
  }

  test("tag 필터로 해당 태그 가진 북마크만 반환", async () => {
    const u = await createTestUser(testDb);
    await bookmarkWithTags(u.id, "https://r1.example.com", ["react", "typescript"]);
    await bookmarkWithTags(u.id, "https://r2.example.com", ["react"]);
    await bookmarkWithTags(u.id, "https://v.example.com", ["vue"]);

    const items = await listBookmarks(u.id, { tag: "react" });
    expect(items).toHaveLength(2);
    expect(items.every((b) => b.tags.includes("react"))).toBe(true);
  });

  test("tag 필터는 정확 매치 — 부분 매치 X", async () => {
    const u = await createTestUser(testDb);
    await bookmarkWithTags(u.id, "https://x.example.com", ["react"]);
    await bookmarkWithTags(u.id, "https://y.example.com", ["reactive"]);

    const items = await listBookmarks(u.id, { tag: "react" });
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe("https://x.example.com");
  });

  test("tag 필터 — user 격리", async () => {
    const alice = await createTestUser(testDb, { name: "Alice" });
    const bob = await createTestUser(testDb, { name: "Bob" });
    await bookmarkWithTags(alice.id, "https://a.example.com", ["react"]);
    await bookmarkWithTags(bob.id, "https://b.example.com", ["react"]);

    const aliceItems = await listBookmarks(alice.id, { tag: "react" });
    expect(aliceItems).toHaveLength(1);
    expect(aliceItems[0].url).toBe("https://a.example.com");
    // Bob의 같은 이름 태그는 *별개 행*이고 user_id로 필터링됨.
  });

  test("query + tag 동시 — AND 결합", async () => {
    const u = await createTestUser(testDb);
    // 1: 태그만 react, title 없음 → tag만 매치
    await bookmarkWithTags(u.id, "https://x.example.com", ["react"]);
    // 2: 태그 react + title "react guide" → 둘 다 매치 (이게 결과여야)
    const matchedId = await bookmarkWithTags(
      u.id,
      "https://r.example.com",
      ["react"],
    );
    await testDb
      .update(bookmarks)
      .set({ title: "react guide" })
      .where(eq(bookmarks.id, matchedId));

    const items = await listBookmarks(u.id, { query: "guide", tag: "react" });
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(matchedId);
  });

  test("tag 필터 trim + lowercase 정규화", async () => {
    const u = await createTestUser(testDb);
    await bookmarkWithTags(u.id, "https://x.example.com", ["react"]);

    // 입력에 공백/대문자 섞여도 매치 (사용자가 직접 URL 친 케이스 방어)
    const items = await listBookmarks(u.id, { tag: "  REACT  " });
    expect(items).toHaveLength(1);
  });

  test("존재하지 않는 tag — 빈 배열", async () => {
    const u = await createTestUser(testDb);
    await bookmarkWithTags(u.id, "https://x.example.com", ["react"]);

    const items = await listBookmarks(u.id, { tag: "nonexistent" });
    expect(items).toEqual([]);
  });
});