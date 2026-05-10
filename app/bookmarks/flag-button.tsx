"use client";

import { useOptimistic, startTransition } from "react";
import {
  toggleReadAction,
  toggleStarAction,
} from "@/app/bookmarks/actions";

// NOTE: useOptimistic — React 19. 사용자 클릭 즉시 UI 반영 → Server Action 결과로
// revalidate되며 진실 동기화. Server Action이 throw하면 자동으로 원래 값으로 복원.
// docs/04 v2 학습 포인트의 핵심 패턴.
//
// 분리 안 하고 두 버튼을 한 컴포넌트로 묶을 수도 있지만, props로 *어떤 flag를*
// 다루는지 매개변수화하면 비대해짐. *얇은 두 컴포넌트*가 더 명료.

type FlagButtonProps = {
  id: string;
  initial: boolean;
};

export function StarButton({ id, initial }: FlagButtonProps) {
  const [optimistic, setOptimistic] = useOptimistic(initial);

  const onClick = () => {
    startTransition(async () => {
      setOptimistic(!optimistic);
      const fd = new FormData();
      fd.set("id", id);
      await toggleStarAction(fd);
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={optimistic ? "즐겨찾기 해제" : "즐겨찾기"}
      aria-pressed={optimistic}
      className={
        optimistic
          ? "text-base text-yellow-500 hover:text-yellow-600"
          : "text-base text-zinc-400 hover:text-yellow-500 dark:text-zinc-500 dark:hover:text-yellow-500"
      }
    >
      {optimistic ? "★" : "☆"}
    </button>
  );
}

export function ReadButton({ id, initial }: FlagButtonProps) {
  const [optimistic, setOptimistic] = useOptimistic(initial);

  const onClick = () => {
    startTransition(async () => {
      setOptimistic(!optimistic);
      const fd = new FormData();
      fd.set("id", id);
      await toggleReadAction(fd);
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={optimistic ? "읽지 않음으로 표시" : "읽음으로 표시"}
      aria-pressed={optimistic}
      className={
        optimistic
          ? "text-base text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
          : "text-base text-zinc-400 hover:text-emerald-600 dark:text-zinc-500 dark:hover:text-emerald-400"
      }
    >
      {optimistic ? "✓" : "○"}
    </button>
  );
}