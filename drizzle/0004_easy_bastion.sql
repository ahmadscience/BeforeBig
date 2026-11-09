CREATE TABLE `product_downvotes` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`user_id` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`captcha_hostname` text NOT NULL,
	`captcha_verified_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_downvotes_product_user_unique` ON `product_downvotes` (`product_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `product_downvotes_product_status_time_idx` ON `product_downvotes` (`product_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `product_downvotes_user_idx` ON `product_downvotes` (`user_id`);