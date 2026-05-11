"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// NOTE: 글로벌 키보드 단축키. layout.tsx에 마운트 → 모든 페이지에서 작동.
// 단축키:
//   `/`  검색 input 포커스 (홈 페이지에서만 의미, 다른 페이지엔 input 없어 no-op)
//   `n`  새 북마크 페이지로 이동
//   `Esc` 검색 input blur + 값 클리어 (포커스 중일 때만)
//
// 함정 카탈로그:
//   - 입력 필드 안 무시: input/textarea/contentEditable 안에선 무시 (사용자가 "n" 타이핑 가능)
//   - modifier 키 무시: Ctrl/Cmd/Alt 조합은 브라우저/OS 단축키
//   - 한글 입력 조합 중 무시: event.isComposing (한글 자모 조합 시 keydown 발사됨)
//   - preventDefault: `/`는 일부 브라우저의 빠른 검색 트리거 → 차단
export function KeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      // 한글 조합 중이면 무시
      if (event.isComposing) return;

      // modifier 조합은 우리 단축키 아님
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const isInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable === true;

      // Esc는 input 안에서만 작동 (검색 input blur용)
      if (event.key === "Escape" && isInput) {
        if (target instanceof HTMLInputElement && target.id === "search") {
          target.value = "";
          target.blur();
        }
        return;
      }

      // 그 외 단축키는 input 밖에서만
      if (isInput) return;

      if (event.key === "/") {
        const input = document.getElementById("search");
        if (input instanceof HTMLInputElement) {
          event.preventDefault();
          input.focus();
          input.select();
        }
        return;
      }

      if (event.key === "n") {
        event.preventDefault();
        router.push("/bookmarks/new");
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router]);

  return null;
}