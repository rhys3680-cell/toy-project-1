import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// NOTE: dotenv는 default로 .env만 자동 로드. .env.local은 명시 필요.
// drizzle-kit은 Next.js 컨텍스트 밖이라 자체 dotenv를 써야 함.
// 환경별 분기 필요해지면 path: string[] 옵션으로 multi-file 가능.
// 자세한 건 docs/16 §3.4.
config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Check .env.local");
}

export default defineConfig({
  // NOTE: drizzle-kit 0.31+에서 driver "turso"가 dialect "turso"로 승격.
  // libsql 드라이버 + SQLite 문법. 로컬 file: + 원격 libsql:// 같은 API.
  dialect: "turso",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  },
  verbose: true,
  strict: true,
});
