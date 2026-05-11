"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
    <Button
      type="button"
      onClick={onSignOut}
      disabled={pending}
      variant="ghost"
      size="sm"
    >
      {pending ? "…" : "로그아웃"}
    </Button>
  );
}