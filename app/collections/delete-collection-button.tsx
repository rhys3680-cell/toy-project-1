"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteCollection } from "./actions";

// NOTE: app/bookmarks/delete-button.tsx와 같은 패턴 — Server Action을 try/catch로
// 감싸 toast.error 가능하게. confirm 메시지에 *안의 북마크는 미분류로 이동*을 명시 —
// 사용자가 자료 손실을 두려워하지 않도록 (docs/13 Q2 정책의 가시화).
export function DeleteCollectionButton({
  id,
  name,
  bookmarkCount,
}: {
  id: string;
  name: string;
  bookmarkCount: number;
}) {
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    const message =
      bookmarkCount > 0
        ? `"${name}" 컬렉션을 삭제할까요?\n안의 북마크 ${bookmarkCount}개는 미분류로 이동합니다.`
        : `"${name}" 컬렉션을 삭제할까요?`;
    if (!confirm(message)) return;

    const fd = new FormData();
    fd.set("id", id);

    startTransition(async () => {
      try {
        await deleteCollection(fd);
        toast.success("컬렉션을 삭제했습니다");
      } catch (err) {
        console.error("delete collection failed", err);
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