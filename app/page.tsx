import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SiteHeader } from "@/components/site-header";
import { BookmarkCard } from "@/components/bookmark-card";
import {
  countBookmarks,
  DEFAULT_PAGE_SIZE,
  listBookmarks,
  listCollections,
} from "@/lib/db/queries";

export default async function Home({
  searchParams,
}: {
  // NOTE: Next.js 16에서 searchParams는 Promise — await 필수.
  // Server Component가 dynamic 진입점 의식하게 하는 의도적 변경.
  searchParams: Promise<{ q?: string; tag?: string; page?: string }>;
}) {
  // NOTE: proxy.ts의 쿠키 가드는 1차 방어. 여기서 Server 측 재검증 (DB 조회).
  // docs/19 §5.5 3층 방어 패턴의 2층. 쿠키 존재 ≠ 세션 유효라 재검증 필수.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const { q, tag, page: pageParam } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const activeTag = typeof tag === "string" ? tag : "";
  // NOTE: page 파싱. 잘못된 입력(`abc`, `0`, `-1`)은 1로 fallback.
  const parsedPage = Number.parseInt(pageParam ?? "", 10);
  const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1;
  const filterOpts = { query, tag: activeTag };

  // NOTE: list + count + collections 병렬. 같은 buildWhere 절을 list/count가 공유하니 정합.
  // collections는 카드의 picker 옵션 — 본인 컬렉션만 (queries.ts §listCollections).
  const [items, total, userCollections] = await Promise.all([
    listBookmarks(session.user.id, { ...filterOpts, page }),
    countBookmarks(session.user.id, filterOpts),
    listCollections(session.user.id),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE));
  const isSearching = query.trim().length > 0;
  const isTagFiltering = activeTag.trim().length > 0;
  const isFiltered = isSearching || isTagFiltering;

  // NOTE: 카드 칩 클릭 시 *현재 검색어 보존하며 태그만 추가*. 태그 해제 시도 같음.
  // tag만 있는 URL과 q+tag 동시 URL 둘 다 자연스러움.
  // 필터 변경 시 page는 *명시적으로 1로 리셋* — 다른 필터의 page=2가 의미 안 가짐.
  const hrefForTag = (t: string) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    params.set("tag", t);
    return `/?${params.toString()}`;
  };
  const hrefWithoutTag = () => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    const qs = params.toString();
    return qs.length > 0 ? `/?${qs}` : "/";
  };
  // NOTE: 페이지 이동 href — 현재 필터 보존, page만 변경. page=1은 생략 (canonical URL).
  const hrefForPage = (n: number) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (activeTag) params.set("tag", activeTag);
    if (n > 1) params.set("page", String(n));
    const qs = params.toString();
    return qs.length > 0 ? `/?${qs}` : "/";
  };

  return (
    <div className="flex flex-1 flex-col bg-background">
      <SiteHeader
        user={session.user}
        title={
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Bookmark Manager
          </h1>
        }
        actions={
          <Button asChild>
            <Link href="/bookmarks/new">+ 추가</Link>
          </Button>
        }
      />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12">
        {/* NOTE: GET 폼 + URL 쿼리 파라미터 — JS 없이도 동작, 새로고침/공유/뒤로가기에 상태 보존.
            v2 로드맵 "URL 쿼리로 필터 상태 동기화"의 첫 적용. */}
        <form method="GET" action="/" className="mb-6 flex gap-2">
          <Input
            id="search"
            type="search"
            name="q"
            defaultValue={query}
            placeholder="제목·URL·태그로 검색"
            maxLength={100}
            className="flex-1"
          />
          {/* NOTE: hidden tag — 검색 submit 시 활성 태그 필터 보존. page는 의도적
              으로 빠뜨림 → 검색하면 1페이지로 자연 리셋. */}
          {activeTag && <input type="hidden" name="tag" value={activeTag} />}
          <Button type="submit">검색</Button>
          {isFiltered && (
            <Button asChild variant="ghost">
              <Link href="/">초기화</Link>
            </Button>
          )}
        </form>

        {isTagFiltering && (
          <div className="mb-4 flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <span>태그 필터:</span>
            <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-900 dark:bg-zinc-700 dark:text-zinc-50">
              {activeTag}
            </span>
            <Link
              href={hrefWithoutTag()}
              className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
              aria-label="태그 필터 해제"
            >
              ✕
            </Link>
          </div>
        )}

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            {isFiltered ? (
              <>
                <p className="text-base font-medium text-zinc-900 dark:text-zinc-100">
                  조건에 맞는 북마크가 없습니다.
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {isSearching && `키워드: ${query}`}
                  {isSearching && isTagFiltering && " · "}
                  {isTagFiltering && `태그: ${activeTag}`}
                </p>
              </>
            ) : (
              <>
                <p className="text-base font-medium text-zinc-900 dark:text-zinc-100">
                  아직 북마크가 없습니다.
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  상단의 + 추가 버튼으로 첫 북마크를 등록해 보세요.
                </p>
              </>
            )}
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((b) => (
              <BookmarkCard
                key={b.id}
                bookmark={b}
                activeTag={activeTag}
                hrefForTag={hrefForTag}
                collections={userCollections}
              />
            ))}
          </ul>
        )}

        {/* NOTE: 페이지네이션 — 결과 1개 페이지 이하면 표시 X. 이전/다음 + N/M 표기.
            Server Component라 Link 클릭이 곧 새 요청. 스크롤 자동 상단. */}
        {totalPages > 1 && (
          <nav
            aria-label="페이지네이션"
            className="mt-6 flex items-center justify-center gap-3 text-sm"
          >
            {page > 1 ? (
              <Button asChild variant="ghost">
                <Link href={hrefForPage(page - 1)} rel="prev">
                  ← 이전
                </Link>
              </Button>
            ) : (
              <Button variant="ghost" disabled>
                ← 이전
              </Button>
            )}
            <span
              className="text-zinc-700 dark:text-zinc-300"
              aria-current="page"
            >
              {page} / {totalPages}
              <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                (전체 {total}개)
              </span>
            </span>
            {page < totalPages ? (
              <Button asChild variant="ghost">
                <Link href={hrefForPage(page + 1)} rel="next">
                  다음 →
                </Link>
              </Button>
            ) : (
              <Button variant="ghost" disabled>
                다음 →
              </Button>
            )}
          </nav>
        )}
      </main>
    </div>
  );
}
