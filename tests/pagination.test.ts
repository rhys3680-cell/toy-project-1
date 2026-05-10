// NOTE: 통합 테스트 — listBookmarks(page) + countBookmarks 페이징 정합성.
// docs/22 §13 우선순위 추가. 함정: list와 count의 WHERE 절이 어긋나면 페이지 수와
// 페이지 행이 맞지 않음 → buildWhere 헬퍼 공유로 차단.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { bookmarks } from "@/lib/db/schema";
import { createTestDb, createTestUser, type TestDb } from "./db";

let testDb: TestDb;

vi.mock("@/lib/db/client", () => ({
  get db() {
    return testDb;
  },
}));

const { listBookmarks, countBookmarks } = await import("@/lib/db/queries");

beforeEach(async () => {
  testDb = await createTestDb();
});

afterEach(() => {
  vi.clearAllMocks();
});

async function seedBookmarks(userId: string, n: number) {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const id = crypto.randomUUID();
    await testDb.insert(bookmarks).values({
      id,
      userId,
      url: `https://x${i}.example.com`,
      title: `bookmark ${i}`,
      description: null,
      image: null,
      // NOTE: createdAt 명시 — Drizzle mode "timestamp"는 *초 단위* 저장이라
      // ms 차이는 사라짐. 초 단위로 분리해야 정렬 결정성 보장. i가 클수록 최신.
      createdAt: new Date(2026, 0, 1, 0, 0, i),
    });
    ids.push(id);
  }
  return ids;
}

describe("페이지네이션 — listBookmarks(page, pageSize)", () => {
  test("page 1 — 첫 N개 (DESC 정렬상 가장 최신)", async () => {
    const u = await createTestUser(testDb);
    const ids = await seedBookmarks(u.id, 25);

    const items = await listBookmarks(u.id, { page: 1, pageSize: 10 });
    expect(items).toHaveLength(10);
    // 가장 최신(마지막 insert)이 첫 번째
    expect(items[0].id).toBe(ids[24]);
    expect(items[9].id).toBe(ids[15]);
  });

  test("page 2 — 다음 N개", async () => {
    const u = await createTestUser(testDb);
    const ids = await seedBookmarks(u.id, 25);

    const items = await listBookmarks(u.id, { page: 2, pageSize: 10 });
    expect(items).toHaveLength(10);
    expect(items[0].id).toBe(ids[14]);
    expect(items[9].id).toBe(ids[5]);
  });

  test("마지막 page — 부분 페이지", async () => {
    const u = await createTestUser(testDb);
    await seedBookmarks(u.id, 25);

    const items = await listBookmarks(u.id, { page: 3, pageSize: 10 });
    expect(items).toHaveLength(5); // 25 % 10 = 5
  });

  test("범위 초과 page — 빈 배열", async () => {
    const u = await createTestUser(testDb);
    await seedBookmarks(u.id, 25);

    const items = await listBookmarks(u.id, { page: 10, pageSize: 10 });
    expect(items).toEqual([]);
  });

  test("default pageSize는 20", async () => {
    const u = await createTestUser(testDb);
    await seedBookmarks(u.id, 25);

    const items = await listBookmarks(u.id, { page: 1 });
    expect(items).toHaveLength(20);
  });

  test("page 미지정 — 1로 처리", async () => {
    const u = await createTestUser(testDb);
    await seedBookmarks(u.id, 5);

    const items = await listBookmarks(u.id);
    expect(items).toHaveLength(5);
  });
});

describe("countBookmarks — 총 개수", () => {
  test("필터 없으면 사용자 전체 개수", async () => {
    const u = await createTestUser(testDb);
    await seedBookmarks(u.id, 17);

    const total = await countBookmarks(u.id);
    expect(total).toBe(17);
  });

  test("user 격리 — 다른 사용자 데이터 안 셈", async () => {
    const alice = await createTestUser(testDb, { name: "Alice" });
    const bob = await createTestUser(testDb, { name: "Bob" });
    await seedBookmarks(alice.id, 5);
    await seedBookmarks(bob.id, 3);

    expect(await countBookmarks(alice.id)).toBe(5);
    expect(await countBookmarks(bob.id)).toBe(3);
  });

  test("검색 키워드 적용 시 일치 개수만", async () => {
    const u = await createTestUser(testDb);
    // seedBookmarks의 title은 "bookmark 0", "bookmark 1", ... — 모두 "bookmark" 매치
    await seedBookmarks(u.id, 7);

    const total = await countBookmarks(u.id, { query: "bookmark" });
    expect(total).toBe(7);

    const none = await countBookmarks(u.id, { query: "nonexistent" });
    expect(none).toBe(0);
  });

  test("list와 count의 WHERE 정합 — 같은 필터로 같은 결과 셀 수", async () => {
    const u = await createTestUser(testDb);
    await seedBookmarks(u.id, 30);

    const total = await countBookmarks(u.id, { query: "bookmark 1" });
    // "bookmark 1", "bookmark 10"~"bookmark 19" — 11개 매치
    expect(total).toBe(11);

    // 같은 필터로 list 다 받아서 합치면 total과 일치
    const page1 = await listBookmarks(u.id, {
      query: "bookmark 1",
      page: 1,
      pageSize: 10,
    });
    const page2 = await listBookmarks(u.id, {
      query: "bookmark 1",
      page: 2,
      pageSize: 10,
    });
    expect(page1.length + page2.length).toBe(total);
  });
});