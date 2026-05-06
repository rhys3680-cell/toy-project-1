import Link from "next/link";
import { listBookmarks } from "@/lib/db/queries";

export default async function Home() {
  const items = await listBookmarks();

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Bookmark Manager
          </h1>
          <Link
            href="/bookmarks/new"
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            + 추가
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12">
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <p className="text-base font-medium text-zinc-900 dark:text-zinc-100">
              아직 북마크가 없습니다.
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              상단의 + 추가 버튼으로 첫 북마크를 등록해 보세요.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((b) => (
              <li
                key={b.id}
                className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <a
                  href={b.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                >
                  {b.title ?? b.url}
                </a>
                <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
                  {b.url}
                </p>
                <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
                  {b.createdAt.toLocaleString("ko-KR")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}