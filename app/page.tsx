import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  countBookmarks,
  DEFAULT_PAGE_SIZE,
  listBookmarks,
} from "@/lib/db/queries";
import { DeleteButton } from "./bookmarks/delete-button";
import { ReadButton, StarButton } from "./bookmarks/flag-button";
import { SignOutButton } from "./sign-out-button";

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

  // NOTE: list + count 병렬. 같은 buildWhere 절을 두 쿼리가 공유하니 정합.
  // docs/21 §3 SQL 흐름에 새 쿼리 1개 추가 (count).
  const [items, total] = await Promise.all([
    listBookmarks(session.user.id, { ...filterOpts, page }),
    countBookmarks(session.user.id, filterOpts),
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
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Bookmark Manager
          </h1>
          <div className="flex items-center gap-3">
            <Link
              href="/bookmarks/new"
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              + 추가
            </Link>
            <div className="flex items-center gap-2">
              {session.user.image && (
                // NOTE: GitHub 아바타. img 사용 이유는 OG 썸네일과 동일 — 임의 외부 도메인.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.user.image}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-7 w-7 rounded-full border border-zinc-200 dark:border-zinc-800"
                />
              )}
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                {session.user.name ?? session.user.email}
              </span>
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12">
        {/* NOTE: GET 폼 + URL 쿼리 파라미터 — JS 없이도 동작, 새로고침/공유/뒤로가기에 상태 보존.
            v2 로드맵 "URL 쿼리로 필터 상태 동기화"의 첫 적용. */}
        <form method="GET" action="/" className="mb-6 flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="제목·URL·태그로 검색"
            maxLength={100}
            className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500"
          />
          {/* NOTE: hidden tag — 검색 submit 시 활성 태그 필터 보존. page는 의도적
              으로 빠뜨림 → 검색하면 1페이지로 자연 리셋. */}
          {activeTag && <input type="hidden" name="tag" value={activeTag} />}
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            검색
          </button>
          {isFiltered && (
            <Link
              href="/"
              className="rounded-md px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              초기화
            </Link>
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
              <li
                key={b.id}
                className={
                  b.isRead
                    ? "rounded-md border border-zinc-200 bg-white p-4 opacity-60 dark:border-zinc-800 dark:bg-zinc-900"
                    : "rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                }
              >
                <div className="flex items-start gap-4">
                  {b.image && (
                    // NOTE: next/image 대신 <img> 사용. next/image는 도메인 화이트리스트가
                    // 필수인데 북마크 매니저는 임의 외부 도메인을 받음 → 화이트리스트 부적합.
                    // og:image URL은 lib/og.ts의 validateImageUrl에서 http/https 검증 끝.
                    // referrerPolicy="no-referrer" — 외부 사이트에 우리 페이지 노출 최소화.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={b.image}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-20 w-32 flex-none rounded border border-zinc-200 bg-zinc-100 object-cover dark:border-zinc-800 dark:bg-zinc-800"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <a
                      href={b.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {b.title ?? b.url}
                    </a>
                    {b.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-zinc-600 dark:text-zinc-300">
                        {b.description}
                      </p>
                    )}
                    <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {b.url}
                    </p>
                    {b.tags.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-1">
                        {b.tags.map((t) => {
                          const isActive = t === activeTag;
                          return (
                            <li key={t}>
                              <Link
                                href={hrefForTag(t)}
                                aria-current={isActive ? "true" : undefined}
                                className={
                                  isActive
                                    ? "rounded bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
                                    : "rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                                }
                              >
                                {t}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
                      {b.createdAt.toLocaleString("ko-KR")}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      <StarButton id={b.id} initial={b.isStarred} />
                      <ReadButton id={b.id} initial={b.isRead} />
                    </div>
                    <DeleteButton id={b.id} />
                  </div>
                </div>
              </li>
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
              <Link
                href={hrefForPage(page - 1)}
                className="rounded-md px-3 py-1.5 text-zinc-700 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800"
                rel="prev"
              >
                ← 이전
              </Link>
            ) : (
              <span className="rounded-md px-3 py-1.5 text-zinc-400 dark:text-zinc-600">
                ← 이전
              </span>
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
              <Link
                href={hrefForPage(page + 1)}
                className="rounded-md px-3 py-1.5 text-zinc-700 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800"
                rel="next"
              >
                다음 →
              </Link>
            ) : (
              <span className="rounded-md px-3 py-1.5 text-zinc-400 dark:text-zinc-600">
                다음 →
              </span>
            )}
          </nav>
        )}
      </main>
    </div>
  );
}