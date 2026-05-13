import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import {
  countBookmarks,
  listCollections,
} from "@/lib/db/queries";
import { DeleteCollectionButton } from "./delete-collection-button";
import { NewCollectionForm } from "./new-collection-form";

export default async function CollectionsPage() {
  // NOTE: 3층 방어 — proxy 쿠키 → page 세션 → action 세션. 다른 페이지와 동일.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  // NOTE: 두 쿼리 병렬. unfiledCount는 collection_id IS NULL 필터 — 미분류 카드에 표시.
  const [collections, unfiledCount] = await Promise.all([
    listCollections(session.user.id),
    countBookmarks(session.user.id, { collectionId: null }),
  ]);

  return (
    <div className="flex flex-1 flex-col bg-background">
      <SiteHeader
        user={session.user}
        title={
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight text-foreground"
          >
            Bookmark Manager
          </Link>
        }
      />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12">
        <h1 className="mb-6 text-xl font-semibold text-foreground">컬렉션</h1>

        <NewCollectionForm />

        <ul className="flex flex-col gap-2">
          {/* NOTE: 미분류는 항상 첫 자리 — 별도 카드. collection_id IS NULL 북마크가
              0개여도 노출 (사용자가 새 북마크을 "미분류"로 저장할 가능성 인지). */}
          <li className="rounded-md border border-dashed border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex items-center justify-between">
              <Link
                href="/collections/unfiled"
                className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
              >
                미분류
              </Link>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {unfiledCount}개
              </span>
            </div>
          </li>

          {collections.length === 0 ? (
            <li className="rounded-md border border-zinc-200 bg-white p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              아직 컬렉션이 없습니다. 위 입력칸에서 만들어 보세요.
            </li>
          ) : (
            collections.map((c) => (
              <li
                key={c.id}
                className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={`/collections/${c.id}`}
                    className="min-w-0 flex-1 truncate font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                  >
                    {c.name}
                  </Link>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {c.bookmarkCount}개
                  </span>
                  <DeleteCollectionButton
                    id={c.id}
                    name={c.name}
                    bookmarkCount={c.bookmarkCount}
                  />
                </div>
                {c.description && (
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                    {c.description}
                  </p>
                )}
              </li>
            ))
          )}
        </ul>
      </main>
    </div>
  );
}