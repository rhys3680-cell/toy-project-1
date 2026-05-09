"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const [pending, setPending] = useState(false);

  // NOTE: authClient.signIn.social 호출 시 내부적으로
  // POST /api/auth/sign-in/social → 서버가 GitHub authorize URL 반환 →
  // 라이브러리가 window.location 이동. callbackURL로 콜백 후 도착 페이지 지정.
  // docs/19 §2 (OAuth flow), docs/20 §5.
  const onSignIn = async () => {
    setPending(true);
    await authClient.signIn.social({ provider: "github", callbackURL: "/" });
    // 정상 흐름엔 위에서 redirect되어 여기 도달 안 함. 에러 시만 도달.
    setPending(false);
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 dark:bg-zinc-950">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-md border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Bookmark Manager
        </h1>
        <p className="text-center text-sm text-zinc-600 dark:text-zinc-300">
          GitHub 계정으로 로그인하면 자기 북마크만 보입니다.
        </p>
        <button
          type="button"
          onClick={onSignIn}
          disabled={pending}
          className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? "이동 중…" : "GitHub으로 로그인"}
        </button>
      </div>
    </div>
  );
}