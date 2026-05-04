CREATE TABLE `bookmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`url` text NOT NULL,
	`title` text,
	`description` text,
	`image` text,
	`created_at` integer NOT NULL
);
