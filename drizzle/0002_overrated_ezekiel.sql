CREATE TABLE `auth_magic_links` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`token_hash` text NOT NULL,
	`return_to` text DEFAULT '/dashboard' NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_magic_links_token_unique` ON `auth_magic_links` (`token_hash`);--> statement-breakpoint
CREATE INDEX `auth_magic_links_email_created_idx` ON `auth_magic_links` (`email`,`created_at`);--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_sessions_token_unique` ON `auth_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `auth_sessions_user_idx` ON `auth_sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `moderation_events` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`actor_user_id` text,
	`action` text NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `moderation_events_product_time_idx` ON `moderation_events` (`product_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `product_events` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`actor_user_id` text,
	`event_type` text NOT NULL,
	`metadata_json` text,
	`occurred_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `product_events_product_time_idx` ON `product_events` (`product_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `product_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'owner' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_memberships_product_user_unique` ON `product_memberships` (`product_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `product_memberships_user_idx` ON `product_memberships` (`user_id`);--> statement-breakpoint
CREATE TABLE `product_updates` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`author_user_id` text,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`created_at` integer NOT NULL,
	`published_at` integer,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `product_updates_product_status_time_idx` ON `product_updates` (`product_id`,`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `rate_limit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`actor_key_hash` text NOT NULL,
	`occurred_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_limit_events_action_actor_time_idx` ON `rate_limit_events` (`action`,`actor_key_hash`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`author_user_id` text NOT NULL,
	`rating` integer NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`moderated_at` integer,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_product_author_unique` ON `reviews` (`product_id`,`author_user_id`);--> statement-breakpoint
CREATE INDEX `reviews_product_status_time_idx` ON `reviews` (`product_id`,`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `verification_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`user_id` text NOT NULL,
	`method` text DEFAULT 'dns_txt' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` integer NOT NULL,
	`verified_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `verification_challenges_product_status_idx` ON `verification_challenges` (`product_id`,`status`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_analytics_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`product_id` text,
	`entity_slug` text,
	`surface_type` text,
	`session_hash` text,
	`metadata_json` text,
	`occurred_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_analytics_events`("id", "event_type", "product_id", "entity_slug", "surface_type", "session_hash", "metadata_json", "occurred_at") SELECT "id", "event_type", "product_id", "entity_slug", "surface_type", "session_hash", "metadata_json", "occurred_at" FROM `analytics_events`;--> statement-breakpoint
DROP TABLE `analytics_events`;--> statement-breakpoint
ALTER TABLE `__new_analytics_events` RENAME TO `analytics_events`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `analytics_events_entity_type_time_idx` ON `analytics_events` (`entity_slug`,`event_type`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `__new_product_facts` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`claim_type` text NOT NULL,
	`value` text NOT NULL,
	`source_url` text,
	`claim_state` text NOT NULL,
	`last_verified_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_product_facts`("id", "product_id", "claim_type", "value", "source_url", "claim_state", "last_verified_at", "created_at") SELECT "id", "product_id", "claim_type", "value", "source_url", "claim_state", "last_verified_at", "created_at" FROM `product_facts`;--> statement-breakpoint
DROP TABLE `product_facts`;--> statement-breakpoint
ALTER TABLE `__new_product_facts` RENAME TO `product_facts`;--> statement-breakpoint
CREATE TABLE `__new_traffic_entitlements` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`entitlement_type` text NOT NULL,
	`target_visits` integer NOT NULL,
	`delivered_visits` integer DEFAULT 0 NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_traffic_entitlements`("id", "product_id", "entitlement_type", "target_visits", "delivered_visits", "enabled", "created_at") SELECT "id", "product_id", "entitlement_type", "target_visits", "delivered_visits", "enabled", "created_at" FROM `traffic_entitlements`;--> statement-breakpoint
DROP TABLE `traffic_entitlements`;--> statement-breakpoint
ALTER TABLE `__new_traffic_entitlements` RENAME TO `traffic_entitlements`;--> statement-breakpoint
ALTER TABLE `products` ADD `stage` text DEFAULT 'Early access' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `best_for` text DEFAULT 'Early adopters evaluating a focused product.' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `not_best_for` text DEFAULT 'Teams that require an established, extensively reviewed product.' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `price` text DEFAULT 'Not provided' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `tags_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);