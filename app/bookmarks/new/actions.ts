"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { bookmarks, bookmarkTags, tags } from "@/lib/db/schema";
import { fetchOgMeta } from "@/lib/og";
import { parseTagInput } from "@/lib/tags";

// NOTE: useActionState용 state 타입.
// success는 redirect로 분기되니 사실상 사용 안 됨 — error만 의미. 다만 React 19
// useActionState 시그니처가 *항상 state 반환*을 요구.
//
// 분류 원칙 (docs/15 §11.6.2 결의 다음 단계):
//   - 사용자 입력 검증 실패 → return { error } → 토스트
//   - 시스템 에러 (DB, network) → throw 유지 → error.tsx 또는 generic 화면
// 입력 검증 실패는 *예상된 사용자 행동*이라 토스트가 적합. 시스템 에러는 *예상 못 한*
// 영역이라 별도 안전망 (error boundary)으로.
export type CreateBookmarkState = { error?: string } | null;

export async function createBookmark(
  _prev: CreateBookmarkState,
  formData: FormData,
): Promise<CreateBookmarkState> {
  // NOTE: 3층 방어의 마지막 — Server Action도 직접 POST 호출 가능하므로
  // proxy/page 가드와 별개로 여기서도 세션 재검증. docs/19 §5.5.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) throw new Error("unauthorized");
  const userId = session.user.id;

  // NOTE: 5단계 서버 검증. HTML5 검증(type=url, required, maxLength)은
  // 클라이언트에서 우회 가능 (DevTools, curl, postman) → 서버 재검증 필수.
  // docs/13 §7.5, docs/16 §7.1 (함정 3 — 보안 취약 패턴).
  // throw 대신 { error } 반환 — 클라이언트가 toast로 표시.
  const rawUrl = formData.get("url");
  if (typeof rawUrl !== "string") {
    return { error: "URL을 입력해주세요." };
  }

  const url = rawUrl.trim();
  if (url.length === 0) return { error: "URL을 입력해주세요." };
  if (url.length > 2048) return { error: "URL이 너무 깁니다." };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { error: "올바른 URL 형식이 아닙니다." };
  }

  // NOTE: http/https만 허용. javascript:/file:/data: 등 차단.
  // <a href={b.url}>로 렌더되는 link이므로 javascript: 프로토콜이 저장되면 클릭 시 XSS.
  // SSRF 방어와는 별개 — 여기선 "DB에 저장될 url" 자체의 안전성.
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { error: "http/https 주소만 등록할 수 있습니다." };
  }

  // NOTE: OG 메타 추출은 best-effort. 실패해도 null 필드로 반환되어 북마크 저장은 항상 성공.
  // SSRF 방어/타임아웃/크기 제한은 fetchOgMeta 내부에서 처리. lib/og.ts 참조.
  const meta = await fetchOgMeta(url);

  const tagNames = parseTagInput(formData.get("tags") as string | null);
  const bookmarkId = crypto.randomUUID();

  // NOTE: 북마크 + 태그 연결을 트랜잭션으로 묶음. 중간 실패 시 부분 데이터 남지 않음.
  // 트랜잭션 안에선 db가 아닌 tx 사용 — db 쓰면 libsql이 즉시 거부 (docs/09 Phase 2-②).
  // 트랜잭션 자체 실패는 throw — error.tsx로 떨어짐 (시스템 에러 카테고리).
  await db.transaction(async (tx) => {
    await tx.insert(bookmarks).values({
      id: bookmarkId,
      userId,
      url,
      title: meta.title,
      description: meta.description,
      image: meta.image,
      createdAt: new Date(),
    });

    if (tagNames.length === 0) return;

    // NOTE: SELECT-then-INSERT 패턴. user_id가 NOT NULL이 되어 (user_id, name) UNIQUE가
    // 정상 작동하지만, 패턴은 그대로 유지 — onConflictDoNothing보다 의도가 명시적이고
    // race condition 방어는 DB UNIQUE가 받쳐줌 (이중 안전망). docs/08 §5.
    const existing = await tx
      .select({ id: tags.id, name: tags.name })
      .from(tags)
      .where(and(eq(tags.userId, userId), inArray(tags.name, tagNames)));

    const existingNames = new Set(existing.map((t) => t.name));
    const newNames = tagNames.filter((n) => !existingNames.has(n));

    let inserted: { id: number; name: string }[] = [];
    if (newNames.length > 0) {
      inserted = await tx
        .insert(tags)
        .values(newNames.map((name) => ({ userId, name })))
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
  // useActionState도 redirect를 *에러로 보지 않음* (Next.js framework throw).
  // docs/12 §7, docs/10 Server Action 안전 규칙.
  revalidatePath("/");
  redirect("/");
}