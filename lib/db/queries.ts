// NOTE: server-only — 쿼리 함수가 Client Component로 새는 사고 차단.
// db 클라이언트가 server-only이므로 transitively 안전하긴 하지만,
// 레이어 경계를 명시적으로 표시. AGENTS.md §Layering, docs/10.
import "server-only";
import { desc } from "drizzle-orm";
import { db } from "./client";
import { bookmarks, type Bookmark } from "./schema";

// NOTE: 카드에 표시할 형태 — bookmark + 태그 이름 배열.
// DB 모델(bookmark_tags 조인 행 list)과 분리해 UI 친화적 형태로 평탄화.
export type BookmarkWithTags = Bookmark & { tags: string[] };

// NOTE: v1엔 단일 사용자 가정이라 user_id 필터 없음.
// v3 인증 도입 시 인자로 userId 받고 where(eq(bookmarks.userId, userId)) 추가.
// AGENTS.md §Server Actions "Filter every query by user_id (IDOR defense)" 적용 시점.
//
// Drizzle Relational Queries (db.query.bookmarks.findMany with: { ... }) 사용 —
// bookmarks N개에 대해 태그 N번 SELECT하지 않고 한 번에 묶어 가져옴 (N+1 회피).
// schema.ts의 relations() 정의가 이걸 가능하게 함. docs/13 §9 N+1 함정 항목 적용.
export async function listBookmarks(): Promise<BookmarkWithTags[]> {
  const rows = await db.query.bookmarks.findMany({
    orderBy: [desc(bookmarks.createdAt)],
    with: {
      bookmarkTags: {
        with: {
          tag: true,
        },
      },
    },
  });

  // NOTE: 조인 결과를 카드 친화적 평탄 형태로 변환. 태그 이름만 노출.
  // 정렬은 알파벳순 — 사용자 입력 순서를 유지하지 않은 의식적 결정.
  // M:N 조인 테이블엔 입력 순서를 표현할 컬럼이 없고, 페이지 새로고침 사이
  // 표시 순서가 흔들리지 않도록 결정성 있는 정렬을 부여.
  return rows.map(({ bookmarkTags: links, ...bookmark }) => ({
    ...bookmark,
    tags: links.map((bt) => bt.tag.name).sort((a, b) => a.localeCompare(b)),
  }));
}