"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-6">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-6 p-8">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Bookmark Manager
          </h1>
          <p className="text-center text-sm text-muted-foreground">
            GitHub 계정으로 로그인하면 자기 북마크만 보입니다.
          </p>
          <Button
            type="button"
            onClick={onSignIn}
            disabled={pending}
            className="w-full"
          >
            {pending ? "이동 중…" : "GitHub으로 로그인"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}