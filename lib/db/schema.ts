import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const bookmarks = sqliteTable("bookmarks", {
  // NOTE: TEXT UUID (crypto.randomUUID) — 외부 노출 시 정보 누출/IDOR 방어.
  // docs/14 §3.4.
  id: text("id").primaryKey(),
  // NOTE: v1엔 nullable. v3 인증 도입 시 NOT NULL + FK CASCADE 강제.
  // 미리 nullable로 둔 건 v3 마이그레이션 충격 완화 의식적 디자인.
  // docs/13 §8.3.
  userId: text("user_id"),
  url: text("url").notNull(),
  title: text("title"),
  description: text("description"),
  image: text("image"),
  // NOTE: mode "timestamp" — Drizzle이 Date ↔ unix epoch(sec) 자동 변환.
  // SQLite엔 DATE 타입 없어 INTEGER가 가장 컴팩트. docs/14 §10.2.
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export type Bookmark = typeof bookmarks.$inferSelect;
export type NewBookmark = typeof bookmarks.$inferInsert;