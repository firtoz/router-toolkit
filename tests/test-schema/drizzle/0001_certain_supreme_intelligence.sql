PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_todo` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer DEFAULT (current_timestamp) NOT NULL,
	`updatedAt` integer DEFAULT (current_timestamp) NOT NULL,
	`deletedAt` integer DEFAULT NULL,
	`title` text NOT NULL,
	`completed` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_todo`("id", "createdAt", "updatedAt", "deletedAt", "title", "completed") SELECT "id", "createdAt", "updatedAt", "deletedAt", "title", "completed" FROM `todo`;--> statement-breakpoint
DROP TABLE `todo`;--> statement-breakpoint
ALTER TABLE `__new_todo` RENAME TO `todo`;--> statement-breakpoint
PRAGMA foreign_keys=ON;