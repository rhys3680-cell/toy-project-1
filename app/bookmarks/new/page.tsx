import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SignOutButton } from "@/app/sign-out-button";
import { NewBookmarkForm } from "./new-bookmark-form";

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
        <NewBookmarkForm />
      </main>
    </div>
  );
}