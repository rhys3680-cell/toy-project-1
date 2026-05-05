"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { bookmarks } from "@/lib/db/schema";

export async function createBookmark(formData: FormData) {
  // NOTE: 5단계 서버 검증. HTML5 검증(type=url, required, maxLength)은
  // 클라이언트에서 우회 가능 (DevTools, curl, postman) → 서버 재검증 필수.
  // docs/13 §7.5, docs/16 §7.1 (함정 3 — 보안 취약 패턴).
  const rawUrl = formData.get("url");

  if (typeof rawUrl !== "string") {
    throw new Error("url is required");
  }

  const url = rawUrl.trim();

  if (url.length === 0) {
    throw new Error("url cannot be empty");
  }

  if (url.length > 2048) {
    throw new Error("url is too long");
  }

  try {
    new URL(url);
  } catch {
    throw new Error("url is not a valid URL");
  }

  await db.insert(bookmarks).values({
    id: crypto.randomUUID(),
    url,
    createdAt: new Date(),
  });

  // NOTE: 순서 중요 — revalidatePath 먼저, redirect 나중.
  // redirect는 throw로 동작해서 그 뒤 코드 실행 X.
  // try/catch로 감싸지 말 것 — redirect가 잡혀버림.
  // docs/12 §7, docs/10 Server Action 안전 규칙.
  revalidatePath("/");
  redirect("/");
}