"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createCollection,
  type CreateCollectionState,
} from "./actions";

// NOTE: createBookmark 폼과 같은 useActionState + useFormStatus 패턴. 차이:
// 이 액션은 redirect하지 않으므로 *성공 시에도 state가 null로 반환*. 같은 페이지에
// 머무르며 또 만들 수 있도록 성공 후 입력값을 비움 (formRef.reset).
//
// state 분기:
//   - { error: "..." } → toast.error, 입력값 유지 (사용자 수정 가능)
//   - null + 직전 액션이 있었음 → 성공 → 입력값 reset
//   - null + 초기 → 아무 효과 없음

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "만드는 중…" : "만들기"}
    </Button>
  );
}

export function NewCollectionForm() {
  const [state, formAction] = useActionState<CreateCollectionState, FormData>(
    createCollection,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  // NOTE: 초기 마운트의 null과 성공 후의 null을 구분하기 위해 *액션이 한 번이라도 돈 적 있나*를
  // 별도로 추적. submitted=true이고 state===null이면 → 직전 액션이 성공한 직후.
  const submittedRef = useRef(false);

  useEffect(() => {
    if (state?.error) {
      toast.error(state.error);
      return;
    }
    if (state === null && submittedRef.current) {
      // 성공한 액션 직후 — 폼 리셋
      formRef.current?.reset();
      submittedRef.current = false;
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={(fd) => {
        submittedRef.current = true;
        formAction(fd);
      }}
      className="mb-6 flex gap-2"
    >
      <Input
        id="collection-name"
        name="name"
        type="text"
        required
        placeholder="새 컬렉션 이름"
        maxLength={80}
        className="flex-1"
      />
      <SubmitButton />
    </form>
  );
}