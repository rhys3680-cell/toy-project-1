// NOTE: server-only — 쿼리 함수가 Client Component로 새는 사고 차단.
// db 클라이언트가 server-only이므로 transitively 안전하긴 하지만,
// 레이어 경계를 명시적으로 표시. AGENTS.md §Layering, docs/10.
import "server-only";
import { and, desc, eq, exists, like, or, sql, type SQL } from "drizzle-orm";
import { db } from "./client";
import { bookmarks, bookmarkTags, tags, type Bookmark } from "./schema";

// NOTE: 카드에 표시할 형태 — bookmark + 태그 이름 배열.
// DB 모델(bookmark_tags 조인 행 list)과 분리해 UI 친화적 형태로 평탄화.
export type BookmarkWithTags = Bookmark & { tags: string[] };

const SEARCH_QUERY_MAX = 100;
const TAG_NAME_MAX = 50;

export type ListBookmarksOpts = {
  query?: string;
  tag?: string;
};

// NOTE: v1 검색 정책 (docs/13 Q13) — LIKE '%q%'. 데이터 적은 v1엔 충분.
// 1000건 초과 또는 v3+에서 FTS5로 진화 (docs/13 §5.7).
// LIKE %prefix는 인덱스 못 타니 풀스캔 — 알면서 의식적으로 선택.
//
// 매치 범위 (OR): bookmarks.title, bookmarks.url, 태그 이름 (M:N 조인).
// description은 v1 명시 범위 외 (docs/04 v1 체크리스트).
//
// 태그 검색은 EXISTS 서브쿼리 — DISTINCT 없이 깔끔. M:N에 자연스러운 패턴.
function searchClause(rawQuery: string) {
  const q = `%${rawQuery}%`;
  return or(
    like(bookmarks.title, q),
    like(bookmarks.url, q),
    exists(
      db
        .select({ x: sql`1` })
        .from(bookmarkTags)
        .innerJoin(tags, eq(tags.id, bookmarkTags.tagId))
        .where(
          and(eq(bookmarkTags.bookmarkId, bookmarks.id), like(tags.name, q)),
        ),
    ),
  );
}

// NOTE: 태그 필터 — *정확 매치* (검색의 LIKE와 다름). 칩 클릭으로 들어오니
// 정확한 이름 가정. EXISTS로 M:N 조인 + user_id 명시 — 다른 사용자의 같은
// 이름 태그에 의도치 않게 매치되지 않게 (이중 안전: 우리 bookmarks도 user
// 격리되어 있어 사실상 무관하지만 의도 명시).
function tagClause(rawTag: string, userId: string) {
  return exists(
    db
      .select({ x: sql`1` })
      .from(bookmarkTags)
      .innerJoin(tags, eq(tags.id, bookmarkTags.tagId))
      .where(
        and(
          eq(bookmarkTags.bookmarkId, bookmarks.id),
          eq(tags.userId, userId),
          eq(tags.name, rawTag),
        ),
      ),
  );
}

// NOTE: 인증 도입으로 userId 필수 인자화. AGENTS.md §Server Actions
// "Filter every query by user_id (IDOR defense)" 정책 적용. 호출자(Server Component
// /Action)가 session.user.id를 명시 전달 — 실수로 누락 시 컴파일 에러.
//
// opts 객체 — v2 이후 필터 추가 시 시그니처 안정. (이전엔 query: string 단일 인자)
//
// Drizzle Relational Queries (db.query.bookmarks.findMany with: { ... }) 사용 —
// bookmarks N개에 대해 태그 N번 SELECT하지 않고 한 번에 묶어 가져옴 (N+1 회피).
// schema.ts의 relations() 정의가 이걸 가능하게 함. docs/13 §9 N+1 함정 항목 적용.
export async function listBookmarks(
  userId: string,
  opts: ListBookmarksOpts = {},
): Promise<BookmarkWithTags[]> {
  const trimmedQuery = opts.query?.trim().slice(0, SEARCH_QUERY_MAX) ?? "";
  const trimmedTag = opts.tag?.trim().slice(0, TAG_NAME_MAX).toLowerCase() ?? "";

  // NOTE: drizzle의 or/and가 빈 인자에 undefined 반환 가능 → SQL로 명시.
  // 우리 호출은 항상 인자 있어 실제론 undefined 안 됨 (! 단언 안전).
  const conditions: SQL[] = [eq(bookmarks.userId, userId)];
  if (trimmedQuery.length > 0) conditions.push(searchClause(trimmedQuery)!);
  if (trimmedTag.length > 0) conditions.push(tagClause(trimmedTag, userId));

  const rows = await db.query.bookmarks.findMany({
    where: and(...conditions),
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