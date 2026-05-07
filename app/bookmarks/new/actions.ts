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

    // NOTE: SELECT-then-INSERT 패턴. onConflictDoNothing은 NULL UNIQUE 함정으로
    // v1 환경(user_id 항상 NULL)에선 무용지물이라 의식적으로 안 씀.
    // DB 레벨엔 partial unique index(tags_null_user_name_unique)가 동시성 안전망.
    // docs/08 §5, docs/09 (2026-05-06) 참조.
    const existing = await tx
      .select({ id: tags.id, name: tags.name })
      .from(tags)
      .where(and(isNull(tags.userId), inArray(tags.name, tagNames)));

    const existingNames = new Set(existing.map((t) => t.name));
    const newNames = tagNames.filter((n) => !existingNames.has(n));

    let inserted: { id: number; name: string }[] = [];
    if (newNames.length > 0) {
      inserted = await tx
        .insert(tags)
        .values(newNames.map((name) => ({ userId: null, name })))
        .returning({ id: tags.id, name: tags.name });
    }

    const allIds = [...existing, ...inserted].map((t) => t.id);
    await tx
      .insert(bookmarkTags)
      .values(allIds.map((tagId) => ({ bookmarkId, tagId })));
  });

  // NOTE: 순서 중요 — revalidatePath 먼저, redirect 나중.
  // redirect는 throw로 동작해서 그 뒤 코드 실행 X.
  // try/catch로 감싸지 말 것 — redirect가 잡혀버림.
  // docs/12 §7, docs/10 Server Action 안전 규칙.
  revalidatePath("/");
  redirect("/");
}