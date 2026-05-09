import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SignOutButton } from "@/app/sign-out-button";
import { createBookmark } from "./actions";

export default async function NewBookmarkPage() {
  // NOTE: 페이지/액션 두 곳 모두 인증 재검증 (3층 방어 — proxy 쿠키 → page → action).
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
          >
            Bookmark Manager
          </Link>
          <div className="flex items-center gap-2">
            {session.user.image && (
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
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12">
        <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          새 북마크 추가
        </h1>

        <form action={createBookmark} className="flex flex-col gap-3">
          <label
            htmlFor="url"
            className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
          >
            URL
          </label>
          <input
            id="url"
            name="url"
            type="url"
            required
            placeholder="https://example.com"
            maxLength={2048}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500"
          />

          <label
            htmlFor="tags"
            className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100"
          >
            태그
          </label>
          <input
            id="tags"
            name="tags"
            type="text"
            placeholder="react, typescript, nextjs"
            maxLength={500}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            쉼표로 구분. 비워둬도 됩니다.
          </p>

          <div className="mt-2 flex gap-2">
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              저장
            </button>
            <Link
              href="/"
              className="rounded-md px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              취소
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}