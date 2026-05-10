import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { user } from "./auth-schema";

// NOTE: Better Auth 표준 테이블 (user, session, account, verification)을
// 별도 파일에서 re-export. drizzle-kit이 한 schema.ts만 보면 되도록.
// 분리 이유: Better Auth가 관리하는 표준 영역과 우리 도메인(bookmarks/tags)을
// 시각적으로 분리. 미래 Better Auth 플러그인 추가 시 auth-schema.ts만 갱신.
export { user, session, account, verification } from "./auth-schema";

export const bookmarks = sqliteTable("bookmarks", {
  // NOTE: TEXT UUID (crypto.randomUUID) — 외부 노출 시 정보 누출/IDOR 방어.
  // docs/14 §3.4.
  id: text("id").primaryKey(),
  // NOTE: 인증 도입(v1 마지막)으로 NOT NULL + FK CASCADE 정상화.
  // 사용자 삭제 시 그 사용자의 북마크도 자동 삭제 (docs/13 Q5).
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  title: text("title"),
  description: text("description"),
  image: text("image"),
  // NOTE: v2 — 즐겨찾기/읽음 토글. mode "boolean"은 SQLite INTEGER 0/1 ↔ JS boolean
  // 자동 변환. NOT NULL + DEFAULT false로 기존 데이터에 자동 채움 (ALTER ADD COLUMN
  // 시 모든 기존 행이 default 가짐).
  isStarred: integer("is_starred", { mode: "boolean" })
    .notNull()
    .default(false),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  // NOTE: mode "timestamp" — Drizzle이 Date ↔ unix epoch(sec) 자동 변환.
  // SQLite엔 DATE 타입 없어 INTEGER가 가장 컴팩트. docs/14 §10.2.
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// NOTE: 태그는 사용자별 (Q1 결정). 같은 이름이라도 다른 사용자가 만들면 별개 행.
// id는 INTEGER autoincrement — 외부 노출 안 함, AGENTS.md §Database 정책.
// 인증 도입으로 user_id NOT NULL + FK CASCADE 정상화.
export const tags = sqliteTable(
  "tags",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
  },
  (t) => [
    // NOTE: (user_id, name) UNIQUE — user_id NOT NULL이 되어 정상 작동.
    // NULL UNIQUE 함정(docs/08 §5, docs/09 2026-05-06)은 사라짐.
    // 봉쇄용 partial unique index `tags_null_user_name_unique`도 같이 drop.
    uniqueIndex("tags_user_id_name_unique").on(t.userId, t.name),
  ],
);

// NOTE: bookmark ↔ tag M:N 조인 테이블. docs/14 §2.3.
// 복합 PK (bookmark_id, tag_id) — 같은 연결 중복 차단 + surrogate id 불필요.
// CASCADE: 북마크/태그 삭제 시 연결도 사라짐 (Q4, Q5 결정).
export const bookmarkTags = sqliteTable(
  "bookmark_tags",
  {
    bookmarkId: text("bookmark_id")
      .notNull()
      .references(() => bookmarks.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.bookmarkId, t.tagId] })],
);

// NOTE: relations()는 Drizzle Relational Queries(`db.query.bookmarks.findMany({ with: { tags: ... } })`)
// 활성화. 단순 select/join에는 불필요하지만 with 키워드로 N+1 없이 가져올 때 필수.
// docs/12 등에서 relational query 패턴 사용 시 이 정의가 진입점.
export const bookmarksRelations = relations(bookmarks, ({ many }) => ({
  bookmarkTags: many(bookmarkTags),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  bookmarkTags: many(bookmarkTags),
}));

export const bookmarkTagsRelations = relations(bookmarkTags, ({ one }) => ({
  bookmark: one(bookmarks, {
    fields: [bookmarkTags.bookmarkId],
    references: [bookmarks.id],
  }),
  tag: one(tags, {
    fields: [bookmarkTags.tagId],
    references: [tags.id],
  }),
}));

export type Bookmark = typeof bookmarks.$inferSelect;
export type NewBookmark = typeof bookmarks.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type BookmarkTag = typeof bookmarkTags.$inferSelect;