import Link from "next/link";
import { DeleteButton } from "@/app/bookmarks/delete-button";
import { ReadButton, StarButton } from "@/app/bookmarks/flag-button";
import type { BookmarkWithTags } from "@/lib/db/queries";
import { BookmarkNote } from "./bookmark-note";
import { CollectionPicker } from "./collection-picker";

// NOTE: 메인/컬렉션/미분류 세 페이지에서 공유. PR3에서 추출.
// 페이지마다 다른 자리는 props로 받음:
//   - activeTag — 현재 활성 태그 (하이라이트 + aria-current)
//   - hrefForTag — 태그 클릭 시 URL 생성 (페이지마다 query string 구성이 달라 함수로)
//   - collections — 컬렉션 picker의 옵션. 사용자 본인 컬렉션 목록.
//     호출자가 listCollections로 가져와 prop으로 전달 (Client Component가 DB 직접 호출 X).
// 페이지마다 같은 자리는 내부에 박음:
//   - Star/Read/Delete 액션 + CollectionPicker
//   - 카드 레이아웃, 이미지, 제목/설명, 메타
// 동일 레이아웃을 강제해 페이지 간 시각 일관성 확보 (docs/25 §디자인 시스템 철학).
type Props = {
  bookmark: BookmarkWithTags;
  activeTag?: string;
  hrefForTag: (tag: string) => string;
  collections: { id: string; name: string }[];
};

export function BookmarkCard({
  bookmark,
  activeTag,
  hrefForTag,
  collections,
}: Props) {
  const b = bookmark;
  return (
    <li
      className={
        b.isRead
          ? "rounded-md border border-zinc-200 bg-white p-4 opacity-60 dark:border-zinc-800 dark:bg-zinc-900"
          : "rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      }
    >
      <div className="flex items-start gap-4">
        {b.image && (
          // NOTE: next/image 대신 <img> 사용. next/image는 도메인 화이트리스트가
          // 필수인데 북마크 매니저는 임의 외부 도메인을 받음 → 화이트리스트 부적합.
          // og:image URL은 lib/og.ts의 validateImageUrl에서 http/https 검증 끝.
          // referrerPolicy="no-referrer" — 외부 사이트에 우리 페이지 노출 최소화.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={b.image}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-20 w-32 flex-none rounded border border-zinc-200 bg-zinc-100 object-cover dark:border-zinc-800 dark:bg-zinc-800"
          />
        )}
        <div className="min-w-0 flex-1">
          <a
            href={b.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-50"
          >
            {b.title ?? b.url}
          </a>
          {b.description && (
            <p className="mt-1 line-clamp-2 text-xs text-zinc-600 dark:text-zinc-300">
              {b.description}
            </p>
          )}
          <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
            {b.url}
          </p>
          <BookmarkNote bookmarkId={b.id} initialNote={b.note} />
          {b.tags.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1">
              {b.tags.map((t) => {
                const isActive = t === activeTag;
                return (
                  <li key={t}>
                    <Link
                      href={hrefForTag(t)}
                      aria-current={isActive ? "true" : undefined}
                      className={
                        isActive
                          ? "rounded bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
                          : "rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                      }
                    >
                      {t}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
            {b.createdAt.toLocaleString("ko-KR")}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <StarButton id={b.id} initial={b.isStarred} />
            <ReadButton id={b.id} initial={b.isRead} />
          </div>
          <CollectionPicker
            bookmarkId={b.id}
            currentCollectionId={b.collectionId}
            collections={collections}
          />
          <DeleteButton id={b.id} />
        </div>
      </div>
    </li>
  );
}