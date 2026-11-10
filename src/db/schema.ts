import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name"),
    role: text("role", { enum: ["founder", "scout", "moderator", "admin"] }).notNull().default("founder"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    websiteUrl: text("website_url").notNull(),
    normalizedDomain: text("normalized_domain").notNull(),
    tagline: text("tagline").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    stage: text("stage").notNull().default("Early access"),
    bestFor: text("best_for").notNull().default("Early adopters evaluating a focused product."),
    notBestFor: text("not_best_for").notNull().default("Teams that require an established, extensively reviewed product."),
    price: text("price").notNull().default("Not provided"),
    tagsJson: text("tags_json").notNull().default("[]"),
    platformsJson: text("platforms_json").notNull().default("[]"),
    licenseType: text("license_type", { enum: ["unknown", "open-source", "proprietary"] }).notNull().default("unknown"),
    pricingModel: text("pricing_model", { enum: ["unknown", "free", "freemium", "paid"] }).notNull().default("unknown"),
    sourceUrl: text("source_url").notNull().default(""),
    status: text("status", { enum: ["draft", "public", "approved", "suspended", "discontinued"] }).notNull().default("draft"),
    verificationStatus: text("verification_status", { enum: ["unverified", "domain_verified", "founder_verified"] }).notNull().default("unverified"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("products_slug_unique").on(table.slug),
    uniqueIndex("products_domain_unique").on(table.normalizedDomain),
    index("products_catalog_status_created_idx").on(table.status, table.createdAt, table.id),
    index("products_catalog_status_name_idx").on(table.status, table.name, table.id),
    index("products_catalog_stage_idx").on(table.stage, table.status),
  ],
);

export const authMagicLinks = sqliteTable(
  "auth_magic_links",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    returnTo: text("return_to").notNull().default("/dashboard"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    consumedAt: integer("consumed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("auth_magic_links_token_unique").on(table.tokenHash),
    index("auth_magic_links_email_created_idx").on(table.email, table.createdAt),
  ],
);

export const authSessions = sqliteTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("auth_sessions_token_unique").on(table.tokenHash),
    index("auth_sessions_user_idx").on(table.userId),
  ],
);

export const productMemberships = sqliteTable(
  "product_memberships",
  {
    id: text("id").primaryKey(),
    productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "editor"] }).notNull().default("owner"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("product_memberships_product_user_unique").on(table.productId, table.userId),
    index("product_memberships_user_idx").on(table.userId),
  ],
);

export const productVotes = sqliteTable(
  "product_votes",
  {
    id: text("id").primaryKey(),
    productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("product_votes_product_user_unique").on(table.productId, table.userId),
    index("product_votes_product_time_idx").on(table.productId, table.createdAt),
    index("product_votes_user_idx").on(table.userId),
  ],
);

export const productDownvotes = sqliteTable(
  "product_downvotes",
  {
    id: text("id").primaryKey(),
    productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    status: text("status", { enum: ["pending", "approved", "rejected", "withdrawn"] }).notNull().default("pending"),
    captchaHostname: text("captcha_hostname"),
    captchaVerifiedAt: integer("captcha_verified_at", { mode: "timestamp_ms" }),
    moderatedByUserId: text("moderated_by_user_id").references(() => users.id, { onDelete: "set null" }),
    moderatedAt: integer("moderated_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("product_downvotes_product_user_unique").on(table.productId, table.userId),
    index("product_downvotes_product_status_time_idx").on(table.productId, table.status, table.updatedAt),
    index("product_downvotes_user_idx").on(table.userId),
  ],
);

export const productReactionLocks = sqliteTable(
  "product_reaction_locks",
  {
    id: text("id").primaryKey(),
    productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    networkKeyHash: text("network_key_hash").notNull(),
    reactionType: text("reaction_type", { enum: ["upvote", "downvote"] }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("product_reaction_locks_product_user_unique").on(table.productId, table.userId),
    uniqueIndex("product_reaction_locks_product_network_unique").on(table.productId, table.networkKeyHash),
    index("product_reaction_locks_user_idx").on(table.userId),
  ],
);

export const verificationChallenges = sqliteTable(
  "verification_challenges",
  {
    id: text("id").primaryKey(),
    productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    method: text("method", { enum: ["dns_txt"] }).notNull().default("dns_txt"),
    status: text("status", { enum: ["pending", "verified", "expired"] }).notNull().default("pending"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    verifiedAt: integer("verified_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("verification_challenges_product_status_idx").on(table.productId, table.status)],
);

export const productFacts = sqliteTable("product_facts", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  claimType: text("claim_type").notNull(),
  value: text("value").notNull(),
  sourceUrl: text("source_url"),
  claimState: text("claim_state", { enum: ["founder_claimed", "ownership_verified", "editorially_verified", "stale", "disputed"] }).notNull(),
  lastVerifiedAt: integer("last_verified_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const analyticsEvents = sqliteTable(
  "analytics_events",
  {
    id: text("id").primaryKey(),
    eventType: text("event_type").notNull(),
    productId: text("product_id").references(() => products.id, { onDelete: "set null" }),
    entitySlug: text("entity_slug"),
    surfaceType: text("surface_type"),
    sessionHash: text("session_hash"),
    metadataJson: text("metadata_json"),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("analytics_events_entity_type_time_idx").on(table.entitySlug, table.eventType, table.occurredAt)],
);

export const productEvents = sqliteTable(
  "product_events",
  {
    id: text("id").primaryKey(),
    productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull(),
    metadataJson: text("metadata_json"),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("product_events_product_time_idx").on(table.productId, table.occurredAt)],
);

export const rateLimitEvents = sqliteTable(
  "rate_limit_events",
  {
    id: text("id").primaryKey(),
    action: text("action").notNull(),
    actorKeyHash: text("actor_key_hash").notNull(),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("rate_limit_events_action_actor_time_idx").on(table.action, table.actorKeyHash, table.occurredAt)],
);

export const moderationEvents = sqliteTable(
  "moderation_events",
  {
    id: text("id").primaryKey(),
    productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action", { enum: ["approve", "reject", "suspend"] }).notNull(),
    note: text("note"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("moderation_events_product_time_idx").on(table.productId, table.createdAt)],
);

export const productUpdates = sqliteTable(
  "product_updates",
  {
    id: text("id").primaryKey(),
    productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id").references(() => users.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    status: text("status", { enum: ["draft", "published"] }).notNull().default("published"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
  },
  (table) => [index("product_updates_product_status_time_idx").on(table.productId, table.status, table.createdAt)],
);

export const reviews = sqliteTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    body: text("body").notNull(),
    status: text("status", { enum: ["pending", "published", "rejected"] }).notNull().default("pending"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    moderatedAt: integer("moderated_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("reviews_product_author_unique").on(table.productId, table.authorUserId),
    index("reviews_product_status_time_idx").on(table.productId, table.status, table.createdAt),
  ],
);

export const trafficEntitlements = sqliteTable("traffic_entitlements", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  entitlementType: text("entitlement_type", { enum: ["demo", "fair_start_365"] }).notNull(),
  targetVisits: integer("target_visits").notNull(),
  deliveredVisits: integer("delivered_visits").notNull().default(0),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

// Recommendations are directional: target is proposed as an alternative to source.
export const alternativeRecommendations = sqliteTable("alternative_recommendations", {
  id: text("id").primaryKey(),
  sourceProductId: text("source_product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  targetProductId: text("target_product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  authorUserId: text("author_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected", "withdrawn"] }).notNull().default("pending"),
  moderatedByUserId: text("moderated_by_user_id").references(() => users.id, { onDelete: "set null" }),
  moderatedAt: integer("moderated_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("alternative_recommendations_pair_unique").on(table.sourceProductId, table.targetProductId),
  index("alternative_recommendations_queue_idx").on(table.status, table.createdAt),
]);

export const alternativeSupports = sqliteTable("alternative_supports", {
  id: text("id").primaryKey(),
  recommendationId: text("recommendation_id").notNull().references(() => alternativeRecommendations.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [uniqueIndex("alternative_supports_recommendation_user_unique").on(table.recommendationId, table.userId)]);

export const collections = sqliteTable("collections", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  visibility: text("visibility", { enum: ["private", "public"] }).notNull().default("private"),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("collections_owner_idx").on(table.ownerUserId), index("collections_public_idx").on(table.visibility, table.deletedAt, table.updatedAt)]);

export const collectionItems = sqliteTable("collection_items", {
  id: text("id").primaryKey(),
  collectionId: text("collection_id").notNull().references(() => collections.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [uniqueIndex("collection_items_collection_product_unique").on(table.collectionId, table.productId)]);


// Maintained by migration triggers alongside the FTS5 index, including direct SQL edits/seeds.
export const productCatalogTerms = sqliteTable("product_catalog_terms", {
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["category", "tag", "platform"] }).notNull(),
  key: text("key").notNull(),
  label: text("label").notNull(),
}, (table) => [
  uniqueIndex("product_catalog_terms_product_kind_key_unique").on(table.productId, table.kind, table.key),
  index("product_catalog_terms_lookup_idx").on(table.kind, table.key, table.productId),
]);

export const productMedia = sqliteTable("product_media", {
  id: text("id").primaryKey(),
  // Preserve tombstones/object keys after product removal so cleanup can still delete private bytes.
  productId: text("product_id").references(() => products.id, { onDelete: "set null" }),
  uploaderUserId: text("uploader_user_id").references(() => users.id, { onDelete: "set null" }),
  storageKey: text("storage_key").notNull(),
  kind: text("kind", { enum: ["screenshot", "image"] }).notNull().default("screenshot"),
  altText: text("alt_text").notNull(),
  caption: text("caption").notNull().default(""),
  width: integer("width").notNull(), height: integer("height").notNull(), byteSize: integer("byte_size").notNull(),
  sha256: text("sha256").notNull(),
  position: integer("position").notNull().default(0),
  status: text("status", { enum: ["uploading", "pending", "approved", "rejected", "failed", "deleted"] }).notNull().default("uploading"),
  rightsConfirmedAt: integer("rights_confirmed_at", { mode: "timestamp_ms" }).notNull(),
  moderatedByUserId: text("moderated_by_user_id").references(() => users.id, { onDelete: "set null" }),
  moderatedAt: integer("moderated_at", { mode: "timestamp_ms" }), moderationNote: text("moderation_note"),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }), storageDeletedAt: integer("storage_deleted_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(), updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("product_media_storage_key_unique").on(table.storageKey),
  index("product_media_gallery_idx").on(table.productId, table.deletedAt, table.status, table.position),
  index("product_media_queue_idx").on(table.status, table.deletedAt, table.createdAt),
]);
