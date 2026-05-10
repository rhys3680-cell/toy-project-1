ALTER TABLE `bookmarks` ADD `is_starred` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `bookmarks` ADD `is_read` integer DEFAULT false NOT NULL;