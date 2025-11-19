CREATE TABLE `todo` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`deletedAt` integer,
	`title` text NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`parent_id` integer,
	`user_id` integer
);
--> statement-breakpoint
CREATE INDEX `todo_user_id_index` ON `todo` (`user_id`);--> statement-breakpoint
CREATE INDEX `todo_parent_id_index` ON `todo` (`parent_id`);--> statement-breakpoint
CREATE INDEX `todo_completed_index` ON `todo` (`completed`);--> statement-breakpoint
CREATE INDEX `todo_created_at_index` ON `todo` (`createdAt`);--> statement-breakpoint
CREATE INDEX `todo_updated_at_index` ON `todo` (`updatedAt`);--> statement-breakpoint
CREATE INDEX `todo_deleted_at_index` ON `todo` (`deletedAt`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`deletedAt` integer,
	`username` text NOT NULL,
	`email` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `email_index` ON `user` (`email`);