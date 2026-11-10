CREATE TABLE `product_media` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text,
	`uploader_user_id` text,
	`storage_key` text NOT NULL,
	`kind` text DEFAULT 'screenshot' NOT NULL,
	`alt_text` text NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`byte_size` integer NOT NULL,
	`sha256` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'uploading' NOT NULL,
	`rights_confirmed_at` integer NOT NULL,
	`moderated_by_user_id` text,
	`moderated_at` integer,
	`moderation_note` text,
	`deleted_at` integer,
	`storage_deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`uploader_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`moderated_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_media_storage_key_unique` ON `product_media` (`storage_key`);--> statement-breakpoint
CREATE INDEX `product_media_gallery_idx` ON `product_media` (`product_id`,`deleted_at`,`status`,`position`);--> statement-breakpoint
CREATE INDEX `product_media_queue_idx` ON `product_media` (`status`,`deleted_at`,`created_at`);
--> statement-breakpoint
-- Retain object keys for cleanup even when a product is physically deleted.
CREATE TRIGGER products_media_before_delete BEFORE DELETE ON products BEGIN
 UPDATE product_media SET status = 'deleted', deleted_at = coalesce(deleted_at, unixepoch() * 1000), updated_at = unixepoch() * 1000 WHERE product_id = old.id;
END;
