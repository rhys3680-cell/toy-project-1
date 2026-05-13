import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { BookmarkCard } from "@/components/bookmark-card";
import { SiteHeader } from "@/components/site-header";
import {
  countBookmarks,
  DEFAULT_PAGE_SIZE,
  getCollection,
  listBookmarks,
  listCollections,
} from "@/lib/db/queries";
import { Button } from "@/components/ui/button";
import { RenameCollectionForm } from "./rename-collection-form";

export default async function CollectionDetailPage({
  params,
  searchParams,
}: {
  // NOTE: Next.js 16에서 params/searchParams는 Promise. App Router의 dynamic
  // 진입 의식을 강제하는 변경.
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tag?: string; page?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");
  const { id } = await params;

  // NOTE: 컬렉션 존재 + 소유 확인. getCollection이 (id, userId) 매치 → undefined면 404.
  // 다른 사용자의 컬렉션 id를 알아도 IDOR 차단 (queries.ts §getCollection).
  const collection = await getCollection(session.user.id, id);
  if (!collection) notFound();

  const { tag, page: pageParam } = await searchParams;
  const activeTag = typeof tag === "string" ? tag : "";
  const parsedPage = Number.parseInt(pageParam ?? "", 10);
  const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1;
  const filterOpts = { collectionId: id, tag: activeTag };

  const [items, total, userCollections] = await Promise.all([
    listBookmarks(session.user.id, { ...filterOpts, page }),
    countBookmarks(session.user.id, filterOpts),
    listCollections(session.user.id),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE));
  const isTagFiltering = activeTag.length > 0;

  // NOTE: 메인 페이지의 hrefForTag와 다른 모양 — 여기선 컬렉션 안에서만 필터링.
  // /collections/[id]?tag=... 형태. q는 미지원 (검색은 메인에서).
  const hrefForTag = (t: string) => {
    const params = new URLSearchParams();
    params.set("tag", t);
    return `/collections/${id}?${params.toString()}`;
  };
  const hrefWithoutTag = () => `/collections/${id}`;
  const hrefForPage = (n: number) => {
    const params = new URLSearchParams();
    if (activeTag) params.set("tag", activeTag);
    if (n > 1) params.set("page", String(n));
    const qs = params.toString();
    return qs.length > 0 ? `/collections/${id}?${qs}` : `/collections/${id}`;
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
          <RenameCollectionForm id={collection.id} initialName={collection.name} />
          {collection.description && (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              {collection.description}
            </p>
          )}
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
              {isTagFiltering
                ? "조건에 맞는 북마크가 없습니다."
                : "이 컬렉션엔 아직 북마크가 없습니다."}
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {isTagFiltering
                ? `태그: ${activeTag}`
                : "새 북마크를 만들 때 이 컬렉션을 선택하세요."}
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
                collections={userCollections}
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