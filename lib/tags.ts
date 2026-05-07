// NOTE: 태그 정규화 — 폼 입력 텍스트(쉼표 구분)를 저장 가능한 이름 배열로.
// 정규화 규칙: trim + lowercase + 빈 항목/중복 제거 + 길이 제한.
// lowercase: 사용자 입력의 대소문자 변형("React" vs "react")을 한 태그로 통합.
// 길이 50: docs/13 §1.3 Q12 미결정이지만 합리적 상한. v3+에서 더 정밀해질 수 있음.

const TAG_NAME_MAX = 50;
const MAX_TAGS_PER_BOOKMARK = 20;

export function parseTagInput(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const name = part.trim().toLowerCase();
    if (name.length === 0) continue;
    if (name.length > TAG_NAME_MAX) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(name);
    if (out.length >= MAX_TAGS_PER_BOOKMARK) break;
  }
  return out;
}