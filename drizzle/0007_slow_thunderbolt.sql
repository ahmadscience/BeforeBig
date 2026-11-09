ALTER TABLE `products` ADD `platforms_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `license_type` text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `pricing_model` text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `source_url` text DEFAULT '' NOT NULL;