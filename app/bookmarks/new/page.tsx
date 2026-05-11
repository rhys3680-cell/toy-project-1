import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listCollections } from "@/lib/db/queries";
import { SiteHeader } from "@/components/site-header";
import { NewBookmarkForm } from "./new-bookmark-form";

export default async function NewBookmarkPage() {
  // NOTE: 페이지/액션 두 곳 모두 인증 재검증 (3층 방어 — proxy 쿠키 → page → action).
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  // NOTE: 드롭다운 옵션. 폼은 Client Component라 직접 DB를 못 부르고 props로 받음
  // (AGENTS.md §Layering — 역방향 import 금지). 카운트는 v3 PR2에선 안 쓰지만
  // listCollections가 한 모양으로 묶어 반환하므로 그대로 전달.
  const userCollections = await listCollections(session.user.id);

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
        <h1 className="mb-6 text-xl font-semibold text-foreground">
          새 북마크 추가
        </h1>
        <NewBookmarkForm collections={userCollections} />
      </main>
    </div>
  );
}