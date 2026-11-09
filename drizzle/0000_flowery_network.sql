CREATE TABLE `analytics_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`product_id` text,
	`surface_type` text,
	`session_hash` text,
	`metadata_json` text,
	`occurred_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `product_facts` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`claim_type` text NOT NULL,
	`value` text NOT NULL,
	`source_url` text,
	`claim_state` text NOT NULL,
	`last_verified_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`website_url` text NOT NULL,
	`normalized_domain` text NOT NULL,
	`tagline` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`verification_status` text DEFAULT 'unverified' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_unique` ON `products` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `products_domain_unique` ON `products` (`normalized_domain`);--> statement-breakpoint
CREATE TABLE `traffic_entitlements` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`entitlement_type` text NOT NULL,
	`target_visits` integer NOT NULL,
	`delivered_visits` integer DEFAULT 0 NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`role` text DEFAULT 'founder' NOT NULL,
	`created_at` integer NOT NULL
);
