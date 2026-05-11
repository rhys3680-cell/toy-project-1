"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  assignBookmarkCollection,
  createCollection as createCollectionQuery,
  deleteCollection as deleteCollectionQuery,
  renameCollection as renameCollectionQuery,
} from "@/lib/db/queries";

// NOTE: 3층 방어의 마지막 — proxy/page 가드와 별개로 Server Action도 세션 재검증.
// 같은 헬퍼 패턴이 app/bookmarks/actions.ts에도 있음 (docs/19 §5.5). 도메인이 늘어나
// 같은 헬퍼가 3+ 곳이면 lib/auth-helpers.ts로 추출 검토.
async function requireUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) throw new Error("unauthorized");
  return session.user.id;
}

function readString(formData: FormData, key: string): string {
  const v = formData.get(key);
  if (typeof v !== "string") return "";
  return v;
}

function readId(formData: FormData, key = "id") {
  const id = readString(formData, key);
  if (id.length === 0) throw new Error(`${key} is required`);
  return id;
}

// NOTE: useActionState용 state — createBookmark과 같은 분류 원칙.
//   사용자 입력 검증 실패 → return { error } → 토스트 (예상된 사용자 행동)
//   시스템 에러 (DB UNIQUE 외 등) → throw → error.tsx
// 단 UNIQUE 위반(같은 이름 중복)은 시스템 에러처럼 보이지만 사실은 *사용자 입력 문제*
// (이름 중복) → 토스트로 변환. SQLite의 UNIQUE constraint failed 메시지를 잡아
// 사용자 친화 메시지로 매핑.
export type CreateCollectionState = { error?: string } | null;

const NAME_MAX = 80;
const DESC_MAX = 500;

function isUniqueViolation(err: unknown): boolean {
  // NOTE: libsql/sqlite의 UNIQUE 위반 에러 메시지는 "UNIQUE constraint failed: ..." 형태.
  // SqliteError 타입을 직접 import하지 않고 메시지 매칭 — 드라이버 의존성 줄이고 텍스트로
  // 분기. message가 없거나 다른 텍스트면 false → 다시 throw.
  if (err instanceof Error) {
    return err.message.includes("UNIQUE constraint failed");
  }
  return false;
}

export async function createCollection(
  _prev: CreateCollectionState,
  formData: FormData,
): Promise<CreateCollectionState> {
  const userId = await requireUserId();

  const name = readString(formData, "name").trim();
  if (name.length === 0) return { error: "이름을 입력해주세요." };
  if (name.length > NAME_MAX) return { error: "이름이 너무 깁니다." };

  const description = readString(formData, "description").trim();
  if (description.length > DESC_MAX) {
    return { error: "설명이 너무 깁니다." };
  }

  try {
    await createCollectionQuery(userId, {
      name,
      description: description.length > 0 ? description : null,
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { error: "같은 이름의 컬렉션이 이미 있습니다." };
    }
    throw err;
  }

  // NOTE: 컬렉션 목록이 노출되는 모든 경로 갱신. 새 컬렉션이 드롭다운에도
  // 즉시 반영되어야 하므로 / 와 /bookmarks/new도 함께. PR3에서 /collections
  // 페이지가 들어오면 그 경로도 추가.
  revalidatePath("/");
  revalidatePath("/bookmarks/new");
  return null;
}

export type RenameCollectionState = { error?: string } | null;

export async function renameCollection(
  _prev: RenameCollectionState,
  formData: FormData,
): Promise<RenameCollectionState> {
  const userId = await requireUserId();
  const id = readId(formData);
  const name = readString(formData, "name").trim();
  if (name.length === 0) return { error: "이름을 입력해주세요." };
  if (name.length > NAME_MAX) return { error: "이름이 너무 깁니다." };

  try {
    await renameCollectionQuery(userId, id, name);
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { error: "같은 이름의 컬렉션이 이미 있습니다." };
    }
    throw err;
  }

  revalidatePath("/");
  revalidatePath("/bookmarks/new");
  return null;
}

// NOTE: 삭제는 form action (state 불필요) — 컬렉션 카드의 X 버튼 같은 패턴.
// 안의 북마크는 ON DELETE SET NULL로 살아남아 "미분류"로 이동. 사용자에게
// 별도 확인 다이얼로그는 클라이언트 측에서.
export async function deleteCollection(formData: FormData) {
  const userId = await requireUserId();
  const id = readId(formData);
  await deleteCollectionQuery(userId, id);
  revalidatePath("/");
  revalidatePath("/bookmarks/new");
}

// NOTE: 북마크의 컬렉션 소속 변경. PR2에선 새 북마크 폼에서 *생성 시* collectionId를
// 직접 INSERT (createBookmark이 처리). 이 액션은 PR3에서 "기존 북마크의 폴더 이동"
// 메뉴가 등장할 때 form action으로 사용. collectionId === "" 또는 누락 → 미분류로.
export async function assignCollectionAction(formData: FormData) {
  const userId = await requireUserId();
  const bookmarkId = readId(formData, "bookmarkId");
  const raw = readString(formData, "collectionId").trim();
  const collectionId = raw.length > 0 ? raw : null;
  await assignBookmarkCollection(userId, bookmarkId, collectionId);
  revalidatePath("/");
}