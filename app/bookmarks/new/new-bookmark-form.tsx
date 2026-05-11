"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CollectionWithCount } from "@/lib/db/queries";
import { createBookmark, type CreateBookmarkState } from "./actions";

// NOTE: 새 북마크 폼 — Server Action을 useActionState로 감쌈.
// state.error 변할 때 toast.error로 표시. 성공 시엔 redirect되어 이 컴포넌트 자체가
// 사라지므로 success toast는 필요 없음.
//
// useFormStatus를 사용한 SubmitButton 별도 — useActionState의 isPending과 같은
// 효과지만 *form 안에 있는 버튼*이 form 상태를 바로 잡는다는 패턴 학습.

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "저장 중…" : "저장"}
    </Button>
  );
}

type Props = {
  collections: CollectionWithCount[];
};

export function NewBookmarkForm({ collections }: Props) {
  const [state, formAction] = useActionState<CreateBookmarkState, FormData>(
    createBookmark,
    null,
  );

  // NOTE: state가 새로 들어올 때마다 toast. 같은 에러 두 번 보이려면 reset 필요하지만
  // 여기선 새 제출이 새 state를 만드니 자연스럽게 새 toast.
  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Label htmlFor="url">URL</Label>
      <Input
        id="url"
        name="url"
        type="url"
        required
        placeholder="https://example.com"
        maxLength={2048}
      />

      <Label htmlFor="tags" className="mt-2">
        태그
      </Label>
      <Input
        id="tags"
        name="tags"
        type="text"
        placeholder="react, typescript, nextjs"
        maxLength={500}
      />
      <p className="text-xs text-muted-foreground">
        쉼표로 구분. 비워둬도 됩니다.
      </p>

      <Label htmlFor="collectionId" className="mt-2">
        컬렉션
      </Label>
      {/* NOTE: shadcn Select 미설치 — native select로 진행. PR2 범위 폭증 회피.
          Tailwind 토큰으로 Input과 시각 정합 맞춤. 향후 shadcn Select 도입은 별도 PR.
          빈 옵션의 value=""는 createBookmark에서 null로 정규화되어 "미분류"로 저장. */}
      <select
        id="collectionId"
        name="collectionId"
        defaultValue=""
        className="border-input bg-transparent focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full rounded-md border px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
      >
        <option value="">(미분류)</option>
        {collections.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {collections.length === 0 && (
        <p className="text-xs text-muted-foreground">
          아직 컬렉션이 없습니다. 비워두면 미분류로 저장됩니다.
        </p>
      )}

      <div className="mt-2 flex gap-2">
        <SubmitButton />
        <Button asChild variant="ghost">
          <Link href="/">취소</Link>
        </Button>
      </div>
    </form>
  );
}