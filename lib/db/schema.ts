import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { isNull, relations } from "drizzle-orm";

// NOTE: Better Auth 표준 테이블 (user, session, account, verification)을
// 별도 파일에서 re-export. drizzle-kit이 한 schema.ts만 보면 되도록.
// 분리 이유: Better Auth가 관리하는 표준 영역과 우리 도메인(bookmarks/tags)을
// 시각적으로 분리. 미래 Better Auth 플러그인 추가 시 auth-schema.ts만 갱신.
export { user, session, account, verification } from "./auth-schema";

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
    // NOTE: (user_id, name) UNIQUE — v3 인증 도입 후 정상 작동.
    // v1엔 user_id가 항상 NULL이라 NULL ≠ NULL 표준 동작으로 무용지물.
    // docs/08 §5, docs/09 (2026-05-06 학습 항목) 참조.
    uniqueIndex("tags_user_id_name_unique").on(t.userId, t.name),
    // NOTE: v1 NULL 함정 봉쇄용 partial unique index. user_id가 NULL일 때만
    // name unique. v3에 user_id가 NOT NULL이 되면 이 index는 무용지물 → drop.
    // 코드(SELECT-then-INSERT)와 함께 두 층 방어를 구성. 동시성 안전망 역할.
    uniqueIndex("tags_null_user_name_unique")
      .on(t.name)
      .where(isNull(t.userId)),
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