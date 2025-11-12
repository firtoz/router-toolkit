CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer DEFAULT (cast(unixepoch('now', 'subsec') * 1000 as integer)) NOT NULL,
	`updatedAt` integer DEFAULT (cast(unixepoch('now', 'subsec') * 1000 as integer)) NOT NULL,
	`deletedAt` integer DEFAULT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `email_index` ON `user` (`email`);--> statement-breakpoint
ALTER TABLE `todo` ADD `parent_id` integer;--> statement-breakpoint
ALTER TABLE `todo` ADD `user_id` integer;--> statement-breakpoint
CREATE INDEX `todo_user_id_index` ON `todo` (`user_id`);--> statement-breakpoint
CREATE INDEX `todo_parent_id_index` ON `todo` (`parent_id`);--> statement-breakpoint
CREATE INDEX `todo_completed_index` ON `todo` (`completed`);--> statement-breakpoint
CREATE INDEX `todo_created_at_index` ON `todo` (`createdAt`);--> statement-breakpoint
CREATE INDEX `todo_updated_at_index` ON `todo` (`updatedAt`);--> statement-breakpoint
CREATE INDEX `todo_deleted_at_index` ON `todo` (`deletedAt`);