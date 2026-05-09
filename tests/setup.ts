import { vi } from "vitest";

// NOTE: server-only는 RSC 환경 외에서 throw하도록 설계됨 (docs/cases/server-only-cli-conflict).
// vitest는 RSC 환경 아님 → 우리 lib/ 파일들의 import "server-only"가 throw.
// 빈 모듈로 mock해서 통과시킴. 정책 자체는 dev/prod 빌드에서 그대로 유효.
vi.mock("server-only", () => ({}));