CREATE TABLE `product_reaction_locks` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`user_id` text NOT NULL,
	`network_key_hash` text NOT NULL,
	`reaction_type` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_reaction_locks_product_user_unique` ON `product_reaction_locks` (`product_id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `product_reaction_locks_product_network_unique` ON `product_reaction_locks` (`product_id`,`network_key_hash`);--> statement-breakpoint
CREATE INDEX `product_reaction_locks_user_idx` ON `product_reaction_locks` (`user_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_product_downvotes` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`user_id` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`captcha_hostname` text,
	`captcha_verified_at` integer,
	`moderated_by_user_id` text,
	`moderated_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`moderated_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_product_downvotes`("id", "product_id", "user_id", "reason", "status", "captcha_hostname", "captcha_verified_at", "moderated_by_user_id", "moderated_at", "created_at", "updated_at") SELECT "id", "product_id", "user_id", "reason", "status", "captcha_hostname", "captcha_verified_at", "moderated_by_user_id", "moderated_at", "created_at", "updated_at" FROM `product_downvotes`;--> statement-breakpoint
DROP TABLE `product_downvotes`;--> statement-breakpoint
ALTER TABLE `__new_product_downvotes` RENAME TO `product_downvotes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `product_downvotes_product_user_unique` ON `product_downvotes` (`product_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `product_downvotes_product_status_time_idx` ON `product_downvotes` (`product_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `product_downvotes_user_idx` ON `product_downvotes` (`user_id`);