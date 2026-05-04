import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const bookmarks = sqliteTable("bookmarks", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  url: text("url").notNull(),
  title: text("title"),
  description: text("description"),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export type Bookmark = typeof bookmarks.$inferSelect;
export type NewBookmark = typeof bookmarks.$inferInsert;