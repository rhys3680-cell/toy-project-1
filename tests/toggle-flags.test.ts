// NOTE: 통합 테스트 — toggleStar/toggleRead의 user 격리 + 토글 동작.
// IDOR 회귀 방지: 다른 사용자의 북마크는 토글 안 됨.
// docs/22 §13 우선 ★★★★, docs/cases/dev-prod-asymmetry와 결이 같은 *상태 침묵* 영역.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { bookmarks } from "@/lib/db/schema";
import { createTestDb, createTestUser, type TestDb } from "./db";

let testDb: TestDb;

vi.mock("@/lib/db/client", () => ({
  get db() {
    return testDb;
  },
}));

const { toggleStar, toggleRead } = await import("@/lib/db/queries");

beforeEach(async () => {
  testDb = await createTestDb();
});

afterEach(() => {
  vi.clearAllMocks();
});

async function insertBookmark(userId: string, url = "https://x.example.com") {
  const id = crypto.randomUUID();
  await testDb.insert(bookmarks).values({
    id,
    userId,
    url,
    title: null,
    description: null,
    image: null,
    createdAt: new Date(),
  });
  return id;
}

async function getRow(id: string) {
  const [row] = await testDb
    .select()
    .from(bookmarks)
    .where(eq(bookmarks.id, id));
  return row;
}

describe("toggleStar / toggleRead — 토글 동작", () => {
  test("초기 false → true → false", async () => {
    const u = await createTestUser(testDb);
    const id = await insertBookmark(u.id);

    expect((await getRow(id)).isStarred).toBe(false);

    const after1 = await toggleStar(u.id, id);
    expect(after1).toBe(true);
    expect((await getRow(id)).isStarred).toBe(true);

    const after2 = await toggleStar(u.id, id);
    expect(after2).toBe(false);
    expect((await getRow(id)).isStarred).toBe(false);
  });

  test("toggleStar는 isRead를 안 건드림 (반대도 마찬가지)", async () => {
    const u = await createTestUser(testDb);
    const id = await insertBookmark(u.id);

    await toggleStar(u.id, id);
    const row = await getRow(id);
    expect(row.isStarred).toBe(true);
    expect(row.isRead).toBe(false);

    await toggleRead(u.id, id);
    const row2 = await getRow(id);
    expect(row2.isStarred).toBe(true);
    expect(row2.isRead).toBe(true);
  });
});

describe("toggleStar / toggleRead — IDOR 방어", () => {
  test("다른 사용자의 북마크 id로 토글 시도 → 변경 안 됨", async () => {
    const alice = await createTestUser(testDb, { name: "Alice" });
    const bob = await createTestUser(testDb, { name: "Bob" });

    const aliceBid = await insertBookmark(alice.id);

    // Bob이 Alice의 북마크 id로 toggle 시도
    const result = await toggleStar(bob.id, aliceBid);

    // returning이 빈 배열 → undefined
    expect(result).toBeUndefined();
    // Alice의 북마크는 그대로 false
    expect((await getRow(aliceBid)).isStarred).toBe(false);
  });

  test("존재하지 않는 bookmark id → undefined, 다른 행 영향 없음", async () => {
    const u = await createTestUser(testDb);
    const realId = await insertBookmark(u.id);

    const result = await toggleStar(u.id, "non-existent-id");
    expect(result).toBeUndefined();
    expect((await getRow(realId)).isStarred).toBe(false);
  });
});