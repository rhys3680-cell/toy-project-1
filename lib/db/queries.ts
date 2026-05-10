// NOTE: server-only — 쿼리 함수가 Client Component로 새는 사고 차단.
// db 클라이언트가 server-only이므로 transitively 안전하긴 하지만,
// 레이어 경계를 명시적으로 표시. AGENTS.md §Layering, docs/10.
import "server-only";
import {
  and,
  count,
  desc,
  eq,
  exists,
  like,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "./client";
import { bookmarks, bookmarkTags, tags, type Bookmark } from "./schema";

// NOTE: 카드에 표시할 형태 — bookmark + 태그 이름 배열.
// DB 모델(bookmark_tags 조인 행 list)과 분리해 UI 친화적 형태로 평탄화.
export type BookmarkWithTags = Bookmark & { tags: string[] };

const SEARCH_QUERY_MAX = 100;
const TAG_NAME_MAX = 50;

export const DEFAULT_PAGE_SIZE = 20;

export type ListBookmarksOpts = {
  query?: string;
  tag?: string;
  page?: number;
  pageSize?: number;
};

export type FilterOpts = Pick<ListBookmarksOpts, "query" | "tag">;

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

// NOTE: WHERE 절 빌드를 listBookmarks/countBookmarks 둘 다에서 재사용.
// 같은 필터 적용해야 페이지 수와 페이지 행이 정합. 분리 시 미세 함정 (필터 누락
// 등) 차단.
function buildWhere(userId: string, opts: FilterOpts): SQL {
  const trimmedQuery = opts.query?.trim().slice(0, SEARCH_QUERY_MAX) ?? "";
  const trimmedTag =
    opts.tag?.trim().slice(0, TAG_NAME_MAX).toLowerCase() ?? "";

  // NOTE: drizzle의 or/and가 빈 인자에 undefined 반환 가능 → SQL로 명시.
  // 우리 호출은 항상 인자 있어 실제론 undefined 안 됨 (! 단언 안전).
  const conditions: SQL[] = [eq(bookmarks.userId, userId)];
  if (trimmedQuery.length > 0) conditions.push(searchClause(trimmedQuery)!);
  if (trimmedTag.length > 0) conditions.push(tagClause(trimmedTag, userId));

  return and(...conditions)!;
}

// NOTE: 인증 도입으로 userId 필수 인자화. AGENTS.md §Server Actions
// "Filter every query by user_id (IDOR defense)" 정책 적용. 호출자(Server Component
// /Action)가 session.user.id를 명시 전달 — 실수로 누락 시 컴파일 에러.
//
// opts 객체 — v2 이후 필터 추가 시 시그니처 안정. (이전엔 query: string 단일 인자)
//
// 페이징: page는 1부터, pageSize는 한 페이지 행 수. OFFSET/LIMIT 패턴.
// docs/13 §5.7 — 데이터 적은 v1엔 OFFSET 충분. 1만 행 넘으면 cursor (v3+).
//
// Drizzle Relational Queries (db.query.bookmarks.findMany with: { ... }) 사용 —
// bookmarks N개에 대해 태그 N번 SELECT하지 않고 한 번에 묶어 가져옴 (N+1 회피).
// schema.ts의 relations() 정의가 이걸 가능하게 함. docs/13 §9 N+1 함정 항목 적용.
export async function listBookmarks(
  userId: string,
  opts: ListBookmarksOpts = {},
): Promise<BookmarkWithTags[]> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.max(1, opts.pageSize ?? DEFAULT_PAGE_SIZE);

  const rows = await db.query.bookmarks.findMany({
    where: buildWhere(userId, opts),
    orderBy: [desc(bookmarks.createdAt)],
    limit: pageSize,
    offset: (page - 1) * pageSize,
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

// NOTE: 페이징 UI에 필요한 *총 개수*. listBookmarks와 같은 WHERE 절 재사용.
// 별도 함수 — 호출자가 Promise.all로 list/count 병렬 가능. 리턴 타입 단순화.
//
// SQL: `SELECT count(*) FROM bookmarks WHERE ...`. 우리 v1엔 데이터 적어 부담 없음.
// 1만 행 + 깊은 페이지에서 count 자체가 비싸지면 운영 단계에 캐싱/근사값 검토.
export async function countBookmarks(
  userId: string,
  opts: FilterOpts = {},
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(bookmarks)
    .where(buildWhere(userId, opts));
  return row?.value ?? 0;
}

// NOTE: boolean 필드 토글. WHERE에 user_id 명시 (IDOR 방어, delete와 같은 패턴).
// 반환값은 새 상태 — Server Action에서 클라이언트 응답에 활용 가능.
// 행이 없으면 (다른 사용자 북마크 또는 존재 X) returning이 빈 배열, undefined 반환.
async function toggleBookmarkFlag(
  userId: string,
  bookmarkId: string,
  field: "isStarred" | "isRead",
): Promise<boolean | undefined> {
  const column = bookmarks[field];
  const [row] = await db
    .update(bookmarks)
    .set({ [field]: sql`NOT ${column}` })
    .where(and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId)))
    .returning({ value: column });
  return row?.value;
}

export function toggleStar(userId: string, bookmarkId: string) {
  return toggleBookmarkFlag(userId, bookmarkId, "isStarred");
}

export function toggleRead(userId: string, bookmarkId: string) {
  return toggleBookmarkFlag(userId, bookmarkId, "isRead");
}
