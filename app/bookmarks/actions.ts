"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { bookmarks } from "@/lib/db/schema";

export async function deleteBookmark(formData: FormData) {
  // NOTE: HTML5 검증 우회 가능 — 직접 POST로도 호출되니 서버에서 재검증.
  // docs/16 §7.1 (함정 3 — 보안 취약 패턴), Next.js docs/07-mutating-data §Warning.
  const rawId = formData.get("id");

  if (typeof rawId !== "string" || rawId.length === 0) {
    throw new Error("id is required");
  }

  // NOTE: v1엔 단일 사용자 가정. v3 인증 시 where(eq(id) AND eq(userId, session.userId)) 강제.
  // 현재는 IDOR 무방비 — AGENTS.md §Server Actions 정책의 v3 적용 항목.
  await db.delete(bookmarks).where(eq(bookmarks.id, rawId));

  revalidatePath("/");
}