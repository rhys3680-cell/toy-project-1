"use client";

import { deleteBookmark } from "./actions";

// NOTE: window.confirm을 위해 Client Component로 분리.
// 카드 전체를 Client로 만들지 않고 버튼만 분리해 서버 렌더 범위 유지.
// docs/12 §Server vs Client 경계 최소화 원칙.
export function DeleteButton({ id }: { id: string }) {
  return (
    <form
      action={deleteBookmark}
      onSubmit={(e) => {
        if (!confirm("이 북마크를 삭제할까요?")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="text-xs text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
      >
        삭제
      </button>
    </form>
  );
}