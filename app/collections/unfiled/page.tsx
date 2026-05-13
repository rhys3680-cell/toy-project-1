import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { BookmarkCard } from "@/components/bookmark-card";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import {
  countBookmarks,
  DEFAULT_PAGE_SIZE,
  listBookmarks,
} from "@/lib/db/queries";

// NOTE: collection_id IS NULL 북마크만 조회. /collections/[id]와 거의 같은 레이아웃이지만
// 컬렉션 메타(이름/설명/rename)는 없음. unfiled 라우트는 정적이라 [id]보다 우선
// 매치되어 충돌 없음 (Next.js App Router 라우팅 규칙).
export default async function UnfiledCollectionPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; page?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const { tag, page: pageParam } = await searchParams;
  const activeTag = typeof tag === "string" ? tag : "";
  const parsedPage = Number.parseInt(pageParam ?? "", 10);
  const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1;
  const filterOpts = { collectionId: null, tag: activeTag };

  const [items, total] = await Promise.all([
    listBookmarks(session.user.id, { ...filterOpts, page }),
    countBookmarks(session.user.id, filterOpts),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE));
  const isTagFiltering = activeTag.length > 0;

  const hrefForTag = (t: string) => {
    const params = new URLSearchParams();
    params.set("tag", t);
    return `/collections/unfiled?${params.toString()}`;
  };
  const hrefWithoutTag = () => `/collections/unfiled`;
  const hrefForPage = (n: number) => {
    const params = new URLSearchParams();
    if (activeTag) params.set("tag", activeTag);
    if (n > 1) params.set("page", String(n));
    const qs = params.toString();
    return qs.length > 0
      ? `/collections/unfiled?${qs}`
      : `/collections/unfiled`;
  };

  return (
    <div className="flex flex-1 flex-col bg-background">
      <SiteHeader
        user={session.user}
        title={
          <Link
            href="/collections"
            className="text-lg font-semibold tracking-tight text-foreground"
          >
            컬렉션
          </Link>
        }
      />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-foreground">미분류</h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            전체 {total}개
          </p>
        </div>

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
            <p className="text-base font-medium text-zinc-900 dark:text-zinc-100">
              미분류 북마크가 없습니다.
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {isTagFiltering
                ? `태그: ${activeTag}`
                : "새 북마크에 컬렉션을 지정하지 않으면 여기로 모입니다."}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((b) => (
              <BookmarkCard
                key={b.id}
                bookmark={b}
                activeTag={activeTag}
                hrefForTag={hrefForTag}
              />
            ))}
          </ul>
        )}

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