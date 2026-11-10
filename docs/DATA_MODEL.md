# Data model

The first schema is intentionally small and SQLite-compatible. It avoids PostgreSQL-only extensions so the project remains portable within Turso/libSQL.

## Core tables

- `users` — identity and role.
- `auth_magic_links` — hashed, expiring, one-use sign-in challenges.
- `auth_sessions` — hashed server-side sessions and expiry.
- `products` — the permanent canonical product record.
- `product_memberships` — owner/editor authorization per product.
- `product_votes` — one community upvote per product/user, enforced by a composite unique index.
- `product_downvotes` — one reasoned downvote per product/user, including pending/approved/rejected/withdrawn state, private evidence, nullable legacy CAPTCHA metadata, and moderator attribution.
- `product_reaction_locks` — one active reaction reservation per product/user and product/HMAC-network key; stores no raw IP address.
- `verification_challenges` — expiring DNS TXT ownership checks.
- `product_facts` — structured claims, sources, state, and freshness.
- `product_events` — authenticated append-only product activity.
- `moderation_events` — admin decisions and notes.
- `rate_limit_events` — durable abuse-control events keyed by HMAC, never raw addresses.
- `product_updates` — founder-published permanent record updates.
- `reviews` — one structured review per product/user with moderation state.
- `analytics_events` — immutable event source for public counters. `entity_slug` identifies the public product or surface without requiring a seeded product row in the demo.
- `traffic_entitlements` — future feature-flagged delivery obligations.

## Product lifecycle

```text
draft -> public -> approved
                   |\
                   v v
              suspended discontinued
```

`public` means visible but not necessarily indexable. `approved` is the minimum status for an indexable canonical page. `verification_status` is separate from publication status.

## Draft persistence

- The submit action normalizes the website URL before any database operation.
- `normalized_domain` is unique, so repeated submissions reuse one permanent record.
- Slugs use the first normalized domain label; deterministic hash suffixes resolve collisions without exposing database IDs.
- New stored submissions begin as `draft` + `unverified` and their preview pages are always `noindex`.
- Writes require the server-only `SUBMISSION_PERSISTENCE_ENABLED` flag, an authenticated session, and a passing durable rate-limit check.

## Fact states

Supported foundation states are `founder_claimed`, `ownership_verified`, `editorially_verified`, `stale`, and `disputed`. Public rendering must show state and last verification date.

## Analytics rules

- Events are append-only.
- Counters are derived, not trusted from browser input.
- Use opaque IDs and privacy-preserving session hashes.
- Keep sponsored events separately classified.
- A provider outage is not `0`.
- `product_page_view` counts page views; distinct non-null `session_hash` values count BeforeBig visitors.
- `product_outbound_click` counts requests through `/go/[slug]`, plus a GA4 custom event for reporting parity.
- GA4 values are optional and may lag; display them as a separate source, never silently merge them with internal values.

## Community voting rules

- Only authenticated users can create or remove a vote.
- `(product_id, user_id)` is unique, so retries and concurrent requests cannot create duplicate votes.
- `product_reaction_locks` also uniquely constrains `(product_id, network_key_hash)`, preventing multiple accounts on one IP from reacting to the same product.
- Vote actions are rate-limited and recorded in `product_events` for auditability.
- Counts come from vote rows, never from a browser-supplied number.
- Seeded demo products use stable `demo_` IDs and live Turso counters while remaining `noindex`; local fixtures are the disconnected fallback.
- Creating a downvote removes the same user’s upvote; creating an upvote withdraws the same user’s pending or approved downvote.
- Downvote reasons are 20–500 characters, private by default, and retained after withdrawal for moderation/audit evidence.
- Public downvote totals count only rows with `status=approved`. Pending signals do not affect rank or public totals.
- Withdrawing an upvote/downvote or rejecting a downvote releases its network lock; approving a downvote keeps the lock.

## Catalog metadata (migration 0007)

`products.platforms_json` stores a validated list of supported platforms. `license_type` is unknown/open-source/proprietary; `pricing_model` is unknown/free/freemium/paid. `source_url` records a founder-provided public source URL and is required by the editor for an open-source claim. All new fields default to unknown/empty, preserving existing rows without inventing facts. SQLite text enums are enforced by the editor contract, not database CHECK constraints. Apply migration 0007 before running this version against a database.


## Community recommendations and collections

Migration `0008_sparkling_warhawk.sql` adds four tables:

- `alternative_recommendations`: unique directional source/target pair, author, written reason, pending/approved/rejected/withdrawn state, and latest moderator attribution. Authors can revise their rejected/withdrawn proposal; support is cleared on withdrawal.
- `alternative_supports`: unique recommendation/account support. Only approved relationships between approved records are publicly readable or supportable.
- `collections`: owner, title, description, private/public visibility, timestamps, and soft-removal marker. Private is the default.
- `collection_items`: unique collection/product save with cascade cleanup on actual collection/product deletion.

Foreign keys and unique indexes protect associations. The data-access layer additionally enforces owner-only collection mutations, private read access, approved-product requirements, conflict-of-interest rules, and separate moderator approval. Public DTOs omit author/owner identities. Removed collections retain items for restoration and are excluded from all public reads.


## Indexed discovery

Migration `0009_catalog_search.sql` adds `product_catalog_terms`, indexed by `(kind, key, product_id)` with a unique product/kind/key constraint. Category, tag, and platform rows are deduplicated and maintained by product triggers. Keys follow SQLite `lower(trim(...))`: ASCII case is folded, punctuation and Unicode identities are preserved. Terms are rechecked against public/approved product state when read.

`product_search` is a SQL-managed FTS5 virtual table keyed by the product rowid. It indexes name, tagline, description, category, and valid text tags for public/approved products only. Inserts, edits, status transitions, and deletes update both indexes atomically with the product operation. Product status/date/name and stage indexes support structured queries. Custom virtual tables/triggers must be preserved when generating future migrations.


## Product media

Migration `0010_product_media.sql` adds `product_media`: random ID/key, nullable product/uploader references, kind, alt text/caption, canonical width/height/byte size/SHA-256, position, rights-confirmation timestamp, review attribution/note, and upload/deletion timestamps. Gallery, moderation, and unique storage-key indexes support bounded queries. Storage keys, digests, uploader IDs, and private moderation notes are omitted from public DTOs.

The lifecycle is `uploading → pending → approved/rejected`. Changed text/type returns media to pending. Six active slots include uploading reservations; a transaction checks the cap before insert. Failed uploads are tombstoned; deleted rows revoke reads immediately and retain keys until object deletion succeeds. `storage_deleted_at` records successful cleanup. The `products_media_before_delete` trigger tombstones rows before their product FK is set null, preserving cleanup information after hard deletion. User deletion sets media attribution null; account deletion itself remains a future workflow. Preserve this SQL-managed trigger when generating later migrations.
