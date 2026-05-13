"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  updateNoteAction,
  type UpdateNoteState,
} from "@/app/bookmarks/actions";

// NOTE: 카드 본문 안 메모 자리 (Q10, v4). 두 모드:
//   - view: note 있으면 plain text로 렌더 (white-space pre-wrap 줄바꿈 보존),
//     없으면 "메모 추가" 작은 버튼. 호버/클릭으로 edit 진입.
//   - edit: textarea + 저장/취소. useActionState로 Server Action 결과 받음.
// rename-collection-form과 같은 *submittedRef + state null 감지* 패턴.
//
// 메모 없을 때도 "추가" 진입점이 있어야 큐레이션 흐름이 닫힘 — 카드 1건씩 본인이
// 읽고 한 줄 쓰는 작업이 자연스럽게 카드 자리에서 일어남.

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "저장 중…" : "저장"}
    </Button>
  );
}

type Props = {
  bookmarkId: string;
  initialNote: string | null;
};

export function BookmarkNote({ bookmarkId, initialNote }: Props) {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useActionState<UpdateNoteState, FormData>(
    updateNoteAction,
    null,
  );
  const submittedRef = useRef(false);

  useEffect(() => {
    if (state?.error) {
      toast.error(state.error);
      return;
    }
    if (state === null && submittedRef.current) {
      toast.success("메모를 저장했습니다");
      setEditing(false);
      submittedRef.current = false;
    }
  }, [state]);

  if (!editing) {
    if (initialNote) {
      return (
        <div className="mt-2 rounded border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-800/50">
          <p className="text-xs whitespace-pre-wrap text-zinc-700 dark:text-zinc-200">
            {initialNote}
          </p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-1 text-[10px] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            메모 수정
          </button>
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-2 text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        + 메모 추가
      </button>
    );
  }

  return (
    <form
      action={(fd) => {
        submittedRef.current = true;
        formAction(fd);
      }}
      className="mt-2 flex flex-col gap-2"
    >
      <input type="hidden" name="id" value={bookmarkId} />
      <textarea
        name="note"
        defaultValue={initialNote ?? ""}
        rows={4}
        maxLength={2000}
        autoFocus
        placeholder="왜 저장했나, 한국어 요약, 한 줄 평…"
        className="border-input bg-transparent focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border px-2 py-1 text-xs shadow-xs outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
      />
      <div className="flex items-center gap-2">
        <SaveButton />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setEditing(false)}
        >
          취소
        </Button>
        <p className="ml-auto text-[10px] text-muted-foreground">
          빈 메모는 자동 제거
        </p>
      </div>
    </form>
  );
}