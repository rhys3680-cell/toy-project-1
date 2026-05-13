"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { assignCollectionAction } from "@/app/collections/actions";

// NOTE: BookmarkCard 내부에서 카드 1건의 컬렉션 소속을 변경. PR2의 백엔드
// assignBookmarkCollection의 호출처 — 호출처가 없어 *반쪽 상태*였던 자리를 채움.
//
// 디자인 결정:
//   - native <select> + onChange 즉시 호출 (저장 버튼 없음). 큐레이션 작업 흐름엔
//     클릭 수 적은 게 가치 큼. 실수 시 토스트 보고 다시 고르면 됨.
//   - 새 북마크 폼의 native <select>와 같은 패턴 — shadcn Select 미도입, 일관성.
//   - useOptimistic 안 씀: <select>의 value 자체가 사용자 입력 직후 즉시 반영되어
//     별도 optimistic state 불필요. revalidatePath가 서버 응답으로 동기화.
//
// IDOR: collectionId는 본인 컬렉션 id만 옵션으로 들어와 위조 어려움. 그래도 서버에서
// assignBookmarkCollection이 *userId 매치 컬렉션*만 받음 (queries.ts).

type Props = {
  bookmarkId: string;
  currentCollectionId: string | null;
  collections: { id: string; name: string }[];
};

export function CollectionPicker({
  bookmarkId,
  currentCollectionId,
  collections,
}: Props) {
  const [pending, startTransition] = useTransition();

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    // NOTE: 같은 값 선택은 no-op — Server Action 호출 안 함. revalidate 비용 회피.
    if (next === (currentCollectionId ?? "")) return;

    const fd = new FormData();
    fd.set("bookmarkId", bookmarkId);
    fd.set("collectionId", next);

    startTransition(async () => {
      try {
        await assignCollectionAction(fd);
        const label = next === ""
          ? "미분류"
          : collections.find((c) => c.id === next)?.name ?? "다른 컬렉션";
        toast.success(`${label}(으)로 이동했습니다`);
      } catch (err) {
        console.error("assign collection failed", err);
        toast.error("이동에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
    });
  };

  return (
    <select
      aria-label="컬렉션"
      value={currentCollectionId ?? ""}
      onChange={onChange}
      disabled={pending}
      className="border-input bg-transparent focus-visible:border-ring focus-visible:ring-ring/50 max-w-[140px] truncate rounded-md border px-2 py-1 text-xs text-zinc-700 shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-300"
    >
      <option value="">(미분류)</option>
      {collections.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}