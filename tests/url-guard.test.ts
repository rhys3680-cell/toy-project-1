// NOTE: 단위 테스트 — SSRF 방어. dns.lookup만 mock, 나머지는 실제 동작.
// docs/22 §13 우선 ★★★, docs/cases/ssrf-domain-fit.
import { describe, expect, test, vi } from "vitest";

// dns.lookup mock — 도메인은 우리가 지정한 IP로 매핑. 실제 DNS 호출 안 함.
vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async (hostname: string) => {
    const map: Record<string, string> = {
      "example.com": "93.184.216.34", // 공인 IP
      "private.example.com": "10.0.0.5", // 공격자가 사설 IP를 가리키게 한 도메인
      "metadata.example.com": "169.254.169.254", // 클라우드 메타데이터
      "localhost-via-domain.example.com": "127.0.0.1",
    };
    const address = map[hostname];
    if (!address) throw new Error(`mock: unknown hostname ${hostname}`);
    return { address, family: 4 };
  }),
}));

// NOTE: import는 mock 선언 후. assertSafeUrl이 내부에서 dns.lookup을 가져갈 때
// mock된 버전을 받게 됨.
const { assertSafeUrl } = await import("@/lib/url-guard");

describe("assertSafeUrl — 프로토콜 화이트리스트", () => {
  test("https 통과", async () => {
    await expect(assertSafeUrl("https://example.com")).resolves.toBeInstanceOf(
      URL,
    );
  });

  test("http 통과", async () => {
    await expect(assertSafeUrl("http://example.com")).resolves.toBeInstanceOf(
      URL,
    );
  });

  test.each([
    ["javascript:alert(1)"],
    ["file:///etc/passwd"],
    ["ftp://example.com"],
    ["data:text/html,<script>"],
  ])("%s 거부", async (url) => {
    await expect(assertSafeUrl(url)).rejects.toThrow(/only http\/https/);
  });
});

describe("assertSafeUrl — 직접 입력 IP의 사설/loopback 차단", () => {
  test.each([
    ["http://127.0.0.1", "loopback"],
    ["http://169.254.169.254", "cloud metadata"],
    ["http://10.0.0.1", "private class A"],
    ["http://172.20.0.1", "private class B"],
    ["http://192.168.1.1", "private class C"],
    ["http://0.0.0.0", "wildcard"],
    ["http://[::1]", "IPv6 loopback"],
  ])("%s (%s) 거부", async (url) => {
    await expect(assertSafeUrl(url)).rejects.toThrow(/private or loopback/);
  });

  test("172.15.x는 private 범위 밖 — 통과", async () => {
    // 172.16.x ~ 172.31.x만 사설. 그 밖은 공인.
    await expect(assertSafeUrl("http://172.15.0.1")).resolves.toBeInstanceOf(
      URL,
    );
  });

  test.each([
    ["http://[::ffff:127.0.0.1]", "IPv4-mapped IPv6 loopback"],
    ["http://[fc00::1]", "IPv6 unique local"],
    ["http://[fe80::1]", "IPv6 link-local"],
  ])("%s (%s) 거부", async (url) => {
    await expect(assertSafeUrl(url)).rejects.toThrow(/private or loopback/);
  });
});

describe("assertSafeUrl — 도메인 → DNS 해석 후 IP 검증", () => {
  test("공인 IP로 해석되는 도메인 통과", async () => {
    await expect(assertSafeUrl("https://example.com")).resolves.toBeInstanceOf(
      URL,
    );
  });

  test("사설 IP로 해석되는 도메인 거부", async () => {
    await expect(assertSafeUrl("https://private.example.com")).rejects.toThrow(
      /private or loopback/,
    );
  });

  test("메타데이터 엔드포인트로 해석되는 도메인 거부", async () => {
    await expect(assertSafeUrl("https://metadata.example.com")).rejects.toThrow(
      /private or loopback/,
    );
  });

  test("localhost로 해석되는 도메인 거부", async () => {
    await expect(
      assertSafeUrl("https://localhost-via-domain.example.com"),
    ).rejects.toThrow(/private or loopback/);
  });
});