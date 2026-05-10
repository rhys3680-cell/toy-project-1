"use client";

// NOTE: 전역 error boundary. Server Component / Server Action에서 throw된
// *예상 못 한* 시스템 에러를 잡음 (DB 다운, 외부 fetch 폭주 등).
// *사용자 입력 검증 실패*는 여기 안 옴 — 그건 useActionState로 toast 처리
// (createBookmark 패턴, docs/15 §11.6.2).
//
// "use client" 필수: error boundary는 React Client Component만.
// Next.js docs/01-app/01-getting-started/10-error-handling 참조.
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // NOTE: dev 콘솔에 에러 + digest. prod에선 Sentry 등 외부 도구로 보낼 자리.
    console.error("[error.tsx]", error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-6 dark:bg-zinc-950">
      <div className="flex max-w-md flex-col items-center gap-4 rounded-md border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          잠시 문제가 있었어요
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          예기치 않은 오류가 발생했습니다. 다시 시도해 보세요.
        </p>
        {error.digest && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            error id: {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}