// NOTE: server-only — 외부 fetch + HTML 파싱 로직이 클라이언트로 새지 않게.
import "server-only";
import { parse } from "node-html-parser";
import { assertSafeUrl } from "./url-guard";

export type OgMeta = {
  title: string | null;
  description: string | null;
  image: string | null;
};

const TIMEOUT_MS = 5000;
const MAX_BYTES = 256 * 1024; // 256KB — head 영역 추출엔 충분
const TITLE_MAX = 200;
const DESCRIPTION_MAX = 500;
const IMAGE_URL_MAX = 2048;

// NOTE: 어떤 단계에서든 실패하면 null 필드 반환. 북마크 저장 자체는 항상 진행돼야 하므로
// 호출 측에서 try/catch로 감쌀 필요 없도록 여기서 모든 에러 흡수.
export async function fetchOgMeta(input: string): Promise<OgMeta> {
  const empty: OgMeta = { title: null, description: null, image: null };

  let url: URL;
  try {
    url = await assertSafeUrl(input);
  } catch {
    return empty;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      // NOTE: redirect는 기본 follow. 북마크 매니저 도메인상 redirect는 정상 흐름
      // (http→https, www 정규화 등). 단점: 최종 URL이 사설 IP일 가능성을 v1엔 못 막음.
      // v3+ 강화 시 manual redirect + 재검증.
      redirect: "follow",
      headers: {
        // NOTE: UA 없으면 일부 사이트가 403/봇 차단. 일반 브라우저 흉내.
        "user-agent":
          "Mozilla/5.0 (compatible; BookmarkManagerBot/0.1; +https://example.com/bot)",
        accept: "text/html,application/xhtml+xml",
      },
    });

    if (!res.ok) return empty;

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/html")) return empty;
    if (!res.body) return empty;

    const html = await readLimited(res.body, MAX_BYTES);
    return extractOgMeta(html, url);
  } catch {
    return empty;
  } finally {
    clearTimeout(timeout);
  }
}

// NOTE: 응답을 통째로 읽지 않고 MAX_BYTES까지만 읽고 reader.cancel()로 stream 종료.
// 메타 태그는 <head>에 있으니 256KB면 거의 모든 사이트에서 충분.
async function readLimited(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<string> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

function extractOgMeta(html: string, baseUrl: URL): OgMeta {
  const root = parse(html, {
    blockTextElements: { script: false, style: false, noscript: false },
  });

  const ogTitle = pickMeta(root, "og:title");
  const ogDescription = pickMeta(root, "og:description");
  const ogImage = pickMeta(root, "og:image");
  const fallbackTitle = root.querySelector("title")?.text?.trim() ?? null;
  const fallbackDescription = pickMetaName(root, "description");

  return {
    title: clamp(ogTitle ?? fallbackTitle, TITLE_MAX),
    description: clamp(ogDescription ?? fallbackDescription, DESCRIPTION_MAX),
    image: validateImageUrl(ogImage, baseUrl),
  };
}

function pickMeta(
  root: ReturnType<typeof parse>,
  property: string,
): string | null {
  const el = root.querySelector(`meta[property="${property}"]`);
  const value = el?.getAttribute("content")?.trim();
  return value && value.length > 0 ? value : null;
}

function pickMetaName(
  root: ReturnType<typeof parse>,
  name: string,
): string | null {
  const el = root.querySelector(`meta[name="${name}"]`);
  const value = el?.getAttribute("content")?.trim();
  return value && value.length > 0 ? value : null;
}

function clamp(s: string | null, max: number): string | null {
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

// NOTE: og:image URL은 카드에 <img>로 렌더될 가능성이 큼.
// javascript:/data: 등 위험 프로토콜 차단해서 XSS 가능성 0으로.
// 상대 경로는 baseUrl 기준 절대 URL로 변환 시도, 실패하면 버림.
function validateImageUrl(raw: string | null, baseUrl: URL): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw, baseUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const s = u.toString();
    return s.length > IMAGE_URL_MAX ? null : s;
  } catch {
    return null;
  }
}