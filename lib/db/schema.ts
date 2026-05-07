import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

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

// NOTE: 태그는 사용자별 (Q1 결정). 같은 이름이라도 다른 사용자가 만들면 별개 행.
// id는 INTEGER autoincrement — 외부 노출 안 함, AGENTS.md §Database 정책.
// userId는 v1엔 nullable (bookmarks와 동일 정책). docs/13 §1.3 Q1, §8.3.
export const tags = sqliteTable(
  "tags",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id"),
    name: text("name").notNull(),
  },
  (t) => [
    // NOTE: (user_id, name)이 UNIQUE — 같은 사용자가 같은 이름 태그 못 만듦.
    // userId가 NULL인 v1 단일 사용자 케이스에선 SQLite의 NULL 동작상
    // NULL ≠ NULL이라 이론적으로 중복 가능. v1 단일 사용자 환경에선
    // 앱 로직(소문자 정규화 + 입력 시 중복 제거)으로 방어.
    // v3 인증 도입 시 userId NOT NULL이 되며 자연 해결.
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