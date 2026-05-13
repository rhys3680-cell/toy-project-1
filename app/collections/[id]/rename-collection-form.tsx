"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  renameCollection,
  type RenameCollectionState,
} from "../actions";

// NOTE: 인라인 rename — 기본은 제목만, "이름 변경" 클릭 시 입력 모드로. ESC/취소로
// 닫기. Server Action은 useActionState로 감싸 에러 토스트.
//
// 같은 useActionState 패턴: 성공 시 state가 null이라 입력 모드를 닫고 폼은 unmount되므로
// 별도 reset 불필요. 단 부모가 revalidatePath로 새 이름을 받아오니 표시 갱신은 자동.

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "저장 중…" : "저장"}
    </Button>
  );
}

export function RenameCollectionForm({
  id,
  initialName,
}: {
  id: string;
  initialName: string;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useActionState<RenameCollectionState, FormData>(
    renameCollection,
    null,
  );
  const submittedRef = useRef(false);

  useEffect(() => {
    if (state?.error) {
      toast.error(state.error);
      return;
    }
    if (state === null && submittedRef.current) {
      // 성공 — edit 모드 닫기
      toast.success("이름을 변경했습니다");
      setEditing(false);
      submittedRef.current = false;
    }
  }, [state]);

  if (!editing) {
    return (
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-foreground">{initialName}</h1>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setEditing(true)}
        >
          이름 변경
        </Button>
      </div>
    );
  }

  return (
    <form
      action={(fd) => {
        submittedRef.current = true;
        formAction(fd);
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="id" value={id} />
      <Input
        name="name"
        type="text"
        required
        defaultValue={initialName}
        maxLength={80}
        autoFocus
        className="max-w-sm"
      />
      <SaveButton />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setEditing(false)}
      >
        취소
      </Button>
    </form>
  );
}