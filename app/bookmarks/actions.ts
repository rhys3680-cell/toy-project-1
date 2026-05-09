"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { bookmarks } from "@/lib/db/schema";

export async function deleteBookmark(formData: FormData) {
  // NOTE: 3층 방어 — proxy/page와 별개로 Server Action도 직접 POST 가능. docs/19 §5.5.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) throw new Error("unauthorized");

  // NOTE: HTML5 검증 우회 가능 — 직접 POST로도 호출되니 서버에서 재검증.
  // docs/16 §7.1 (함정 3 — 보안 취약 패턴), Next.js docs/07-mutating-data §Warning.
  const rawId = formData.get("id");

  if (typeof rawId !== "string" || rawId.length === 0) {
    throw new Error("id is required");
  }

  // NOTE: IDOR 방어 — id 일치만이 아니라 userId까지 일치해야 삭제. 다른 사용자의
  // 북마크 id를 알아도 자기 세션으로는 못 지움. AGENTS.md §Server Actions 정책 적용.
  await db
    .delete(bookmarks)
    .where(and(eq(bookmarks.id, rawId), eq(bookmarks.userId, session.user.id)));

  revalidatePath("/");
}