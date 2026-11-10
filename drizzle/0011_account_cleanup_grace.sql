ALTER TABLE `product_media` ADD `cleanup_after` integer;--> statement-breakpoint
-- Preserve a grace period for writes started by the previous application version.
UPDATE product_media SET cleanup_after = created_at + 3600000 WHERE status IN ('uploading', 'failed');
