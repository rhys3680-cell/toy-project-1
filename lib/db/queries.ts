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
import {
  bookmarks,
  bookmarkTags,
  collections,
  tags,
  type Bookmark,
  type Collection,
} from "./schema";
// NOTE: drizzle의 isNull은 NULL 매치 전용 헬퍼. eq(col, null)은 SQL 표준상
// 항상 false (NULL ≠ NULL — docs/08 §5)이므로 isNull/isNotNull로 명시.
import { isNull } from "drizzle-orm";

// NOTE: 카드에 표시할 형태 — bookmark + 태그 이름 배열.
// DB 모델(bookmark_tags 조인 행 list)과 분리해 UI 친화적 형태로 평탄화.
export type BookmarkWithTags = Bookmark & { tags: string[] };

const SEARCH_QUERY_MAX = 100;
const TAG_NAME_MAX = 50;

export const DEFAULT_PAGE_SIZE = 20;

export type ListBookmarksOpts = {
  query?: string;
  tag?: string;
  // NOTE: 컬렉션 필터 — v3 PR3에서 /collections/[id] 페이지가 사용.
  //   undefined: 필터 없음 (모든 북마크)
  //   string  : 해당 컬렉션 소속만
  //   null    : 미분류 (collection_id IS NULL) — eq(col, null)은 SQL 표준상
  //             항상 false라 isNull()로 명시. docs/08 §5.
  collectionId?: string | null;
  page?: number;
  pageSize?: number;
};

export type FilterOpts = Pick<ListBookmarksOpts, "query" | "tag" | "collectionId">;

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
  // NOTE: collectionId === null → "미분류"만, string → 그 컬렉션 소속만.
  // undefined일 땐 분기 안 함 = 컬렉션 필터 미적용.
  if (opts.collectionId === null) {
    conditions.push(isNull(bookmarks.collectionId));
  } else if (typeof opts.collectionId === "string") {
    conditions.push(eq(bookmarks.collectionId, opts.collectionId));
  }

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

// === Collections (v3 PR2) =====================================================

const COLLECTION_NAME_MAX = 80;
const COLLECTION_DESC_MAX = 500;

export type CollectionWithCount = Collection & { bookmarkCount: number };

// NOTE: 사용자 컬렉션 목록 — 북마크 수 포함. 드롭다운/페이지 둘 다에서 쓸 수 있게
// count를 한 번에 묶음. LEFT JOIN + GROUP BY로 빈 컬렉션도 count=0으로 등장.
// 정렬: 최신 생성순 (createdAt DESC) — 사용자가 방금 만든 폴더를 위에 보고 싶을 가능성.
// 미래에 사용자별 정렬 (`sort_order` 컬럼) 도입 시 ORDER BY 교체.
export async function listCollections(
  userId: string,
): Promise<CollectionWithCount[]> {
  const rows = await db
    .select({
      id: collections.id,
      userId: collections.userId,
      name: collections.name,
      description: collections.description,
      createdAt: collections.createdAt,
      bookmarkCount: count(bookmarks.id),
    })
    .from(collections)
    .leftJoin(bookmarks, eq(bookmarks.collectionId, collections.id))
    .where(eq(collections.userId, userId))
    .groupBy(collections.id)
    .orderBy(desc(collections.createdAt));
  return rows;
}

// NOTE: 컬렉션 단건 조회 — /collections/[id] 페이지가 PR3에서 쓸 예정.
// IDOR 방어: id + userId 동시 매치. 다른 사용자의 컬렉션 id를 알아도 못 봄.
export async function getCollection(
  userId: string,
  collectionId: string,
): Promise<Collection | undefined> {
  const [row] = await db
    .select()
    .from(collections)
    .where(
      and(eq(collections.id, collectionId), eq(collections.userId, userId)),
    )
    .limit(1);
  return row;
}

export type CreateCollectionInput = {
  name: string;
  description?: string | null;
};

// NOTE: 컬렉션 생성. name은 trim + 길이 검증. UNIQUE(user_id, name) 위반 시
// DB가 거부 → 호출자가 사용자 메시지로 변환. INTEGRITY는 DB가 마지막 진실.
// description은 nullable — 빈 문자열은 null로 정규화 (DB에 의미 없는 빈 문자열 안 박힘).
export async function createCollection(
  userId: string,
  input: CreateCollectionInput,
): Promise<Collection> {
  const name = input.name.trim().slice(0, COLLECTION_NAME_MAX);
  if (name.length === 0) {
    throw new Error("collection name is required");
  }
  const description = input.description?.trim().slice(0, COLLECTION_DESC_MAX);
  const id = crypto.randomUUID();
  const [row] = await db
    .insert(collections)
    .values({
      id,
      userId,
      name,
      description: description && description.length > 0 ? description : null,
      createdAt: new Date(),
    })
    .returning();
  return row!;
}

// NOTE: 이름 변경. UNIQUE 위반 → DB throw → 호출자가 사용자 메시지로 변환.
// returning으로 갱신된 행 반환, 다른 사용자의 컬렉션이거나 존재 X면 undefined.
export async function renameCollection(
  userId: string,
  collectionId: string,
  rawName: string,
): Promise<Collection | undefined> {
  const name = rawName.trim().slice(0, COLLECTION_NAME_MAX);
  if (name.length === 0) {
    throw new Error("collection name is required");
  }
  const [row] = await db
    .update(collections)
    .set({ name })
    .where(
      and(eq(collections.id, collectionId), eq(collections.userId, userId)),
    )
    .returning();
  return row;
}

// NOTE: 컬렉션 삭제. ON DELETE SET NULL이라 안에 있던 북마크은 살아남아 "미분류"로
// 이동. docs/13 §1.3 Q2 / §6 외래키 매트릭스. WHERE에 userId 명시 (IDOR 방어).
// returning으로 *실제 삭제 행 수*를 알 수 있으나, Server Action에선 단순히
// revalidatePath만 하면 되니 반환값 활용은 호출자 재량.
export async function deleteCollection(
  userId: string,
  collectionId: string,
): Promise<boolean> {
  const rows = await db
    .delete(collections)
    .where(
      and(eq(collections.id, collectionId), eq(collections.userId, userId)),
    )
    .returning({ id: collections.id });
  return rows.length > 0;
}

// NOTE: 북마크의 컬렉션 소속 변경. collectionId === null이면 "미분류"로 이동.
// IDOR 방어 두 층:
//   1) bookmark가 userId 소유여야 함 (UPDATE WHERE)
//   2) collectionId가 주어졌으면 그 컬렉션도 userId 소유여야 함 — 별도 SELECT로 확인.
// 두 번째 가드가 없으면 자기 북마크을 *남의 컬렉션 id*에 박을 수 있음. FK는 막아주지만
// 같은 사용자 가정만 깨지면 안 됨. 작은 비용으로 의도 명시.
export async function assignBookmarkCollection(
  userId: string,
  bookmarkId: string,
  collectionId: string | null,
): Promise<boolean> {
  if (collectionId !== null) {
    const owner = await getCollection(userId, collectionId);
    if (!owner) return false;
  }
  const rows = await db
    .update(bookmarks)
    .set({ collectionId })
    .where(and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId)))
    .returning({ id: bookmarks.id });
  return rows.length > 0;
}
