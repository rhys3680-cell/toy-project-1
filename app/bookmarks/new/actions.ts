"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { bookmarks, bookmarkTags, tags } from "@/lib/db/schema";
import { fetchOgMeta } from "@/lib/og";
import { parseTagInput } from "@/lib/tags";

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

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("url is not a valid URL");
  }

  // NOTE: http/https만 허용. javascript:/file:/data: 등 차단.
  // <a href={b.url}>로 렌더되는 link이므로 javascript: 프로토콜이 저장되면 클릭 시 XSS.
  // SSRF 방어와는 별개 — 여기선 "DB에 저장될 url" 자체의 안전성.
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("only http/https urls allowed");
  }

  // NOTE: OG 메타 추출은 best-effort. 실패해도 null 필드로 반환되어 북마크 저장은 항상 성공.
  // SSRF 방어/타임아웃/크기 제한은 fetchOgMeta 내부에서 처리. lib/og.ts 참조.
  const meta = await fetchOgMeta(url);

  const tagNames = parseTagInput(formData.get("tags") as string | null);
  const bookmarkId = crypto.randomUUID();

  // NOTE: 북마크 + 태그 연결을 트랜잭션으로 묶음. 중간 실패 시 부분 데이터 남지 않음.
  // 트랜잭션 안에선 db가 아닌 tx 사용 — db 쓰면 libsql이 즉시 거부 (docs/09 Phase 2-②).
  await db.transaction(async (tx) => {
    await tx.insert(bookmarks).values({
      id: bookmarkId,
      url,
      title: meta.title,
      description: meta.description,
      image: meta.image,
      createdAt: new Date(),
    });

    if (tagNames.length === 0) return;

    // NOTE: 태그 upsert 패턴 — onConflictDoNothing으로 새 이름만 insert.
    // returning()은 충돌 행은 안 돌려주므로 회수 못 함 → 별도 SELECT로 id 일괄 조회.
    // v1 단일 사용자(userId NULL)라 (user_id, name) UNIQUE의 NULL 동작 함정 가능 —
    // parseTagInput에서 입력 단계 dedupe로 회피.
    await tx
      .insert(tags)
      .values(tagNames.map((name) => ({ userId: null, name })))
      .onConflictDoNothing();

    const existing = await tx
      .select({ id: tags.id, name: tags.name })
      .from(tags)
      .where(and(isNull(tags.userId), inArray(tags.name, tagNames)));

    if (existing.length > 0) {
      await tx
        .insert(bookmarkTags)
        .values(existing.map((t) => ({ bookmarkId, tagId: t.id })));
    }
  });

  // NOTE: 순서 중요 — revalidatePath 먼저, redirect 나중.
  // redirect는 throw로 동작해서 그 뒤 코드 실행 X.
  // try/catch로 감싸지 말 것 — redirect가 잡혀버림.
  // docs/12 §7, docs/10 Server Action 안전 규칙.
  revalidatePath("/");
  redirect("/");
}