CREATE TABLE `product_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_votes_product_user_unique` ON `product_votes` (`product_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `product_votes_product_time_idx` ON `product_votes` (`product_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `product_votes_user_idx` ON `product_votes` (`user_id`);