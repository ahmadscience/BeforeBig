CREATE TABLE `product_catalog_terms` (
	`product_id` text NOT NULL,
	`kind` text NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_catalog_terms_product_kind_key_unique` ON `product_catalog_terms` (`product_id`,`kind`,`key`);--> statement-breakpoint
CREATE INDEX `product_catalog_terms_lookup_idx` ON `product_catalog_terms` (`kind`,`key`,`product_id`);--> statement-breakpoint
CREATE INDEX `products_catalog_status_created_idx` ON `products` (`status`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `products_catalog_status_name_idx` ON `products` (`status`,`name`,`id`);--> statement-breakpoint
CREATE INDEX `products_catalog_stage_idx` ON `products` (`stage`,`status`);
--> statement-breakpoint
-- FTS5 is intentionally defined in checked SQL: Drizzle does not model virtual tables.
CREATE VIRTUAL TABLE product_search USING fts5(
  product_id UNINDEXED, name, tagline, description, category, tags,
  tokenize = 'unicode61 remove_diacritics 2', prefix = '2 3 4'
);
--> statement-breakpoint
-- Backfill existing public records; drafts and suspended/discontinued records stay out.
INSERT INTO product_search(rowid, product_id, name, tagline, description, category, tags)
 SELECT p.rowid, p.id, p.name, p.tagline, p.description, p.category,
 coalesce((SELECT group_concat(value, ' ') FROM json_each(CASE WHEN json_valid(p.tags_json) THEN CASE WHEN json_type(p.tags_json) = 'array' THEN p.tags_json ELSE '[]' END ELSE '[]' END) WHERE type = 'text'), '')
 FROM products AS p WHERE p.status IN ('public', 'approved');
--> statement-breakpoint
INSERT OR IGNORE INTO product_catalog_terms(product_id, kind, key, label)
 SELECT p.id, 'category', lower(trim(p.category)), trim(p.category)
 FROM products AS p WHERE p.status IN ('public', 'approved') AND length(trim(p.category)) > 0;
--> statement-breakpoint
INSERT OR IGNORE INTO product_catalog_terms(product_id, kind, key, label)
 SELECT p.id, 'tag', lower(trim(j.value)), trim(j.value)
 FROM products AS p, json_each(CASE WHEN json_valid(p.tags_json) THEN CASE WHEN json_type(p.tags_json) = 'array' THEN p.tags_json ELSE '[]' END ELSE '[]' END) AS j
 WHERE p.status IN ('public', 'approved') AND j.type = 'text' AND length(trim(j.value)) > 0;
--> statement-breakpoint
INSERT OR IGNORE INTO product_catalog_terms(product_id, kind, key, label)
 SELECT p.id, 'platform', lower(trim(j.value)), trim(j.value)
 FROM products AS p, json_each(CASE WHEN json_valid(p.platforms_json) THEN CASE WHEN json_type(p.platforms_json) = 'array' THEN p.platforms_json ELSE '[]' END ELSE '[]' END) AS j
 WHERE p.status IN ('public', 'approved') AND j.type = 'text' AND length(trim(j.value)) > 0;
--> statement-breakpoint
CREATE TRIGGER products_catalog_after_insert AFTER INSERT ON products BEGIN
INSERT INTO product_search(rowid, product_id, name, tagline, description, category, tags)
 SELECT new.rowid, new.id, new.name, new.tagline, new.description, new.category,
 coalesce((SELECT group_concat(value, ' ') FROM json_each(CASE WHEN json_valid(new.tags_json) THEN CASE WHEN json_type(new.tags_json) = 'array' THEN new.tags_json ELSE '[]' END ELSE '[]' END) WHERE type = 'text'), '')
  WHERE new.status IN ('public', 'approved');
 INSERT OR IGNORE INTO product_catalog_terms(product_id, kind, key, label)
 SELECT new.id, 'category', lower(trim(new.category)), trim(new.category)
  WHERE new.status IN ('public', 'approved') AND length(trim(new.category)) > 0;
 INSERT OR IGNORE INTO product_catalog_terms(product_id, kind, key, label)
 SELECT new.id, 'tag', lower(trim(j.value)), trim(j.value)
 FROM json_each(CASE WHEN json_valid(new.tags_json) THEN CASE WHEN json_type(new.tags_json) = 'array' THEN new.tags_json ELSE '[]' END ELSE '[]' END) AS j
 WHERE new.status IN ('public', 'approved') AND j.type = 'text' AND length(trim(j.value)) > 0;
 INSERT OR IGNORE INTO product_catalog_terms(product_id, kind, key, label)
 SELECT new.id, 'platform', lower(trim(j.value)), trim(j.value)
 FROM json_each(CASE WHEN json_valid(new.platforms_json) THEN CASE WHEN json_type(new.platforms_json) = 'array' THEN new.platforms_json ELSE '[]' END ELSE '[]' END) AS j
 WHERE new.status IN ('public', 'approved') AND j.type = 'text' AND length(trim(j.value)) > 0;
END;
--> statement-breakpoint
CREATE TRIGGER products_catalog_after_update AFTER UPDATE ON products BEGIN
 DELETE FROM product_search WHERE rowid = old.rowid;
 DELETE FROM product_catalog_terms WHERE product_id = old.id;
INSERT INTO product_search(rowid, product_id, name, tagline, description, category, tags)
 SELECT new.rowid, new.id, new.name, new.tagline, new.description, new.category,
 coalesce((SELECT group_concat(value, ' ') FROM json_each(CASE WHEN json_valid(new.tags_json) THEN CASE WHEN json_type(new.tags_json) = 'array' THEN new.tags_json ELSE '[]' END ELSE '[]' END) WHERE type = 'text'), '')
  WHERE new.status IN ('public', 'approved');
 INSERT OR IGNORE INTO product_catalog_terms(product_id, kind, key, label)
 SELECT new.id, 'category', lower(trim(new.category)), trim(new.category)
  WHERE new.status IN ('public', 'approved') AND length(trim(new.category)) > 0;
 INSERT OR IGNORE INTO product_catalog_terms(product_id, kind, key, label)
 SELECT new.id, 'tag', lower(trim(j.value)), trim(j.value)
 FROM json_each(CASE WHEN json_valid(new.tags_json) THEN CASE WHEN json_type(new.tags_json) = 'array' THEN new.tags_json ELSE '[]' END ELSE '[]' END) AS j
 WHERE new.status IN ('public', 'approved') AND j.type = 'text' AND length(trim(j.value)) > 0;
 INSERT OR IGNORE INTO product_catalog_terms(product_id, kind, key, label)
 SELECT new.id, 'platform', lower(trim(j.value)), trim(j.value)
 FROM json_each(CASE WHEN json_valid(new.platforms_json) THEN CASE WHEN json_type(new.platforms_json) = 'array' THEN new.platforms_json ELSE '[]' END ELSE '[]' END) AS j
 WHERE new.status IN ('public', 'approved') AND j.type = 'text' AND length(trim(j.value)) > 0;
END;
--> statement-breakpoint
CREATE TRIGGER products_catalog_after_delete AFTER DELETE ON products BEGIN
 DELETE FROM product_search WHERE rowid = old.rowid;
 DELETE FROM product_catalog_terms WHERE product_id = old.id;
END;
