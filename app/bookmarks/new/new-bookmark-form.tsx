"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createBookmark, type CreateBookmarkState } from "./actions";

// NOTE: 새 북마크 폼 — Server Action을 useActionState로 감쌈.
// state.error 변할 때 toast.error로 표시. 성공 시엔 redirect되어 이 컴포넌트 자체가
// 사라지므로 success toast는 필요 없음.
//
// useFormStatus를 사용한 SubmitButton 별도 — useActionState의 isPending과 같은
// 효과지만 *form 안에 있는 버튼*이 form 상태를 바로 잡는다는 패턴 학습.

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "저장 중…" : "저장"}
    </Button>
  );
}

export function NewBookmarkForm() {
  const [state, formAction] = useActionState<CreateBookmarkState, FormData>(
    createBookmark,
    null,
  );

  // NOTE: state가 새로 들어올 때마다 toast. 같은 에러 두 번 보이려면 reset 필요하지만
  // 여기선 새 제출이 새 state를 만드니 자연스럽게 새 toast.
  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label
        htmlFor="url"
        className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
      >
        URL
      </label>
      <input
        id="url"
        name="url"
        type="url"
        required
        placeholder="https://example.com"
        maxLength={2048}
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500"
      />

      <label
        htmlFor="tags"
        className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100"
      >
        태그
      </label>
      <input
        id="tags"
        name="tags"
        type="text"
        placeholder="react, typescript, nextjs"
        maxLength={500}
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500"
      />
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        쉼표로 구분. 비워둬도 됩니다.
      </p>

      <div className="mt-2 flex gap-2">
        <SubmitButton />
        <Button asChild variant="ghost">
          <Link href="/">취소</Link>
        </Button>
      </div>
    </form>
  );
}