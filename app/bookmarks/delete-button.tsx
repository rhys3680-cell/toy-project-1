"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteBookmark } from "./actions";

// NOTE: form action에서 onClick + try/catch로 변경 — Server Action 호출을 감싸야
// toast.error로 잡을 수 있음. form action prop은 try/catch가 안 들어감.
// useTransition으로 *pending 상태* 추적 → 더블 클릭 차단.
// docs/12 §Server vs Client 경계 최소화 원칙은 그대로 (버튼만 Client).
export function DeleteButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    if (!confirm("이 북마크를 삭제할까요?")) return;

    const formData = new FormData();
    formData.set("id", id);

    startTransition(async () => {
      try {
        await deleteBookmark(formData);
        toast.success("북마크를 삭제했습니다");
      } catch (err) {
        // NOTE: 우리가 throw한 메시지가 영문이라 사용자엔 generic 메시지로.
        // 진짜 에러 디버깅은 console.
        console.error("delete failed", err);
        toast.error("삭제에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
    });
  };

  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={pending}
      variant="ghost"
      size="sm"
    >
      {pending ? "삭제 중…" : "삭제"}
    </Button>
  );
}