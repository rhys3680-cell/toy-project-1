"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const [pending, setPending] = useState(false);

  // NOTE: authClient.signOut() — 서버에 세션 row 삭제 요청 → 쿠키 삭제 응답.
  // fetchOptions.onSuccess로 redirect 처리. docs/19 §1.5 (revocation).
  const onSignOut = async () => {
    setPending(true);
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = "/login";
        },
      },
    });
    setPending(false);
  };

  return (
    <button
      type="button"
      onClick={onSignOut}
      disabled={pending}
      className="text-sm text-zinc-600 hover:text-zinc-900 disabled:opacity-60 dark:text-zinc-400 dark:hover:text-zinc-50"
    >
      {pending ? "…" : "로그아웃"}
    </button>
  );
}