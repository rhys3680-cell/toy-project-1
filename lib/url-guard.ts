// NOTE: server-only — DNS 조회/사설망 검증 로직이 클라이언트로 새지 않게.
import "server-only";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

// NOTE: SSRF 방어. 외부 URL fetch 전에 호출. 위험하면 throw.
// 막는 것: 메타데이터 엔드포인트(169.254.169.254), localhost, 사설망(10/8, 172.16/12, 192.168/16),
// http/https 외 프로토콜.
// 한계: DNS rebinding 완벽 방어 안 됨 (검증 시점과 fetch 시점의 DNS 응답이 다를 수 있음).
// redirect 후 최종 URL 재검증도 v1엔 안 함 — v3+ 인증 도입 시 강화.
//
// 회귀 재검증: tests/url-guard.test.ts (vitest). IPv6 평탄화 + IPv4-mapped IPv6
// 16진수 변환 함정이 거기 박제됨. 수동 확인 케이스 목록도 그 파일이 진실 소스.
export async function assertSafeUrl(input: string): Promise<URL> {
  const url = new URL(input);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("only http/https allowed");
  }

  // NOTE: Node URL이 IPv6 hostname을 brackets 포함해 보관 — `[::1]`.
  // node:net.isIP는 brackets 없이만 인식하니 평탄화. IPv4는 brackets 안 씀.
  const host = url.hostname.replace(/^\[|\]$/g, "");

  // hostname이 IP면 직접 검증
  if (isIP(host)) {
    if (isPrivateOrLoopbackIp(host)) {
      throw new Error("private or loopback ip not allowed");
    }
    return url;
  }

  // 도메인이면 DNS 해석 후 IP 검증
  // NOTE: dns.lookup은 OS resolver 사용 (/etc/hosts 등 반영). dns.resolve와 다름.
  const { address } = await lookup(host);
  if (isPrivateOrLoopbackIp(address)) {
    throw new Error("domain resolves to private or loopback ip");
  }

  return url;
}

function isPrivateOrLoopbackIp(ip: string): boolean {
  // IPv4
  if (ip === "0.0.0.0") return true;
  if (ip.startsWith("127.")) return true; // loopback
  if (ip.startsWith("169.254.")) return true; // link-local + cloud metadata
  if (ip.startsWith("10.")) return true; // private class A
  if (ip.startsWith("192.168.")) return true; // private class C
  if (ip.startsWith("172.")) {
    const second = Number.parseInt(ip.split(".")[1] ?? "", 10);
    if (second >= 16 && second <= 31) return true; // private class B
  }

  // IPv6 (간략화 — 정확한 매칭은 v3+)
  if (ip === "::1") return true; // loopback
  if (ip === "::") return true;
  const lower = ip.toLowerCase();
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
  if (lower.startsWith("fe80")) return true; // link-local
  // IPv4-mapped IPv6 — 두 표기 모두 처리:
  //   ::ffff:127.0.0.1   (mixed dotted decimal)
  //   ::ffff:7f00:1      (Node URL 정규화 후 16진수, 압축 포함)
  if (lower.startsWith("::ffff:")) {
    const tail = lower.slice(7);
    if (isIP(tail) === 4) return isPrivateOrLoopbackIp(tail);
    // 16진수 변환 시도 (예: "7f00:1" → "127.0.0.1")
    const hexMatch = tail.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hexMatch) {
      const high = Number.parseInt(hexMatch[1], 16);
      const low = Number.parseInt(hexMatch[2], 16);
      const dotted = `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
      if (isIP(dotted) === 4) return isPrivateOrLoopbackIp(dotted);
    }
  }

  return false;
}