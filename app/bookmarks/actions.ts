"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { bookmarks } from "@/lib/db/schema";
import { toggleRead, toggleStar } from "@/lib/db/queries";

// NOTE: 모든 Server Action은 3층 방어의 마지막 — proxy/page와 별개로 직접 POST 가능.
// 헬퍼로 공통화. docs/19 §5.5.
async function requireUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) throw new Error("unauthorized");
  return session.user.id;
}

function readId(formData: FormData) {
  const rawId = formData.get("id");
  if (typeof rawId !== "string" || rawId.length === 0) {
    throw new Error("id is required");
  }
  return rawId;
}

export async function deleteBookmark(formData: FormData) {
  const userId = await requireUserId();
  const id = readId(formData);

  // NOTE: IDOR 방어 — id 일치만이 아니라 userId까지 일치해야 삭제. 다른 사용자의
  // 북마크 id를 알아도 자기 세션으로는 못 지움. AGENTS.md §Server Actions 정책 적용.
  await db
    .delete(bookmarks)
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)));

  revalidatePath("/");
}

// NOTE: toggleStar / toggleRead — boolean 토글. queries 레이어 함수가 user_id 가드
// 포함. revalidatePath로 holistic 갱신 — 클라이언트의 useOptimistic가 즉각 UI 반영을
// 따로 처리하지만, 서버 진실은 revalidate로 동기화.
export async function toggleStarAction(formData: FormData) {
  const userId = await requireUserId();
  const id = readId(formData);
  await toggleStar(userId, id);
  revalidatePath("/");
}

export async function toggleReadAction(formData: FormData) {
  const userId = await requireUserId();
  const id = readId(formData);
  await toggleRead(userId, id);
  revalidatePath("/");
}