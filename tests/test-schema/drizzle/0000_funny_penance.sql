CREATE TABLE `todo` (
	`id` text PRIMARY KEY NOT NULL,
	`createdAt` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updatedAt` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deletedAt` integer DEFAULT NULL,
	`title` text NOT NULL,
	`completed` integer DEFAULT false NOT NULL
);
