// NOTE: server-only — 쿼리 함수가 Client Component로 새는 사고 차단.
// db 클라이언트가 server-only이므로 transitively 안전하긴 하지만,
// 레이어 경계를 명시적으로 표시. AGENTS.md §Layering, docs/10.
import "server-only";
import { desc } from "drizzle-orm";
import { db } from "./client";
import { bookmarks, type Bookmark } from "./schema";

// NOTE: v1엔 단일 사용자 가정이라 user_id 필터 없음.
// v3 인증 도입 시 인자로 userId 받고 where(eq(bookmarks.userId, userId)) 추가.
// AGENTS.md §Server Actions "Filter every query by user_id (IDOR defense)" 적용 시점.
export async function listBookmarks(): Promise<Bookmark[]> {
  return db.select().from(bookmarks).orderBy(desc(bookmarks.createdAt));
}