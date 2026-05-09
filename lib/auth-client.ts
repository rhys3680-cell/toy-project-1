// NOTE: 이 파일은 Client Component에서 import 가능. server-only 가드 없음.
// 다만 secret은 노출 안 됨 — baseURL 외엔 클라이언트 단에서 fetch만 함.
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  // NOTE: baseURL 명시 — production에선 BETTER_AUTH_URL 환경변수로 설정.
  // 같은 도메인 배포 시 생략 가능하지만 의도 명시 차원에서 둠.
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "http://localhost:3000",
});