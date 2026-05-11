CREATE TABLE `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collections_user_id_name_unique` ON `collections` (`user_id`,`name`);--> statement-breakpoint
-- NOTE: drizzle-kit 0.31이 ALTER TABLE ADD COLUMN의 FK 액션(ON DELETE/UPDATE)을
-- SQL로 표현하지 못해 누락함. snapshot 메타엔 "set null"로 들어 있으나 SQL 단계에서
-- 떨어져 나가, 액션 없는 FK는 SQLite에서 NO ACTION으로 등록되어 부모 삭제 시
-- constraint failure로 거부됨. SQLite 3.50은 ALTER ADD COLUMN에 ON DELETE 액션을
-- 인라인 지원하므로 수동으로 ON DELETE SET NULL을 명시. 검증: scratch/verify-alter-fk-action.mjs.
ALTER TABLE `bookmarks` ADD `collection_id` text REFERENCES collections(id) ON DELETE SET NULL;