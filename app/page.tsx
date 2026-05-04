import { count } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { bookmarks } from "@/lib/db/schema";

export default async function Home() {
  const [{ value: bookmarkCount }] = await db
    .select({ value: count() })
    .from(bookmarks);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Bookmark Manager
          </h1>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-base font-medium text-zinc-900 dark:text-zinc-100">
            저장된 북마크 {bookmarkCount}개
          </p>
          {bookmarkCount === 0 && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              URL을 추가하면 여기에 표시됩니다.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}