import { defineConfig } from "vitest/config";
import path from "node:path";

// NOTE: Next.js next.config.ts와 별개. vitest는 esbuild로 직접 컴파일.
// path alias `@/`만 맞춰주면 됨. server-only는 setup에서 mock 처리.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    // NOTE: 통합 테스트가 in-memory DB에 마이그레이션 적용하면서 약간 느림 →
    // 각 테스트 파일은 격리 (병렬). 한 파일 안 테스트는 순차 (DB 상태 공유 방지).
    fileParallelism: true,
    sequence: { concurrent: false },
  },
});