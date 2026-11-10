# Security and privacy baseline

## Secrets

- Secrets stay in server-only environment variables.
- Never log database tokens, magic-link tokens, verification secrets, payment payloads, or raw private analytics.
- `.env.local` is ignored; `.env.example` contains placeholders only.
- Global response headers set a restrictive content policy, deny framing, disable MIME sniffing and unused browser capabilities, and enable HSTS outside development.

## URL submission and SSRF

The demo validates scheme, credentials, hostname, and obvious private/loopback destinations but does not fetch remote HTML. The production extractor must additionally resolve DNS, validate every resolved address, revalidate after redirects, limit redirects/time/bytes/content types, prevent rebinding, and sanitize metadata.

Required tests include private IPv4/IPv6, alternate numeric IPs, userinfo confusion, DNS rebinding, redirect-to-private, oversized responses, hostile HTML, unsupported content types, and duplicate canonical destinations.

## Authorization

Every mutation checks the authenticated actor, product membership, role, and resource state on the server. UI visibility is never authorization.

Stored submissions require authentication and durable rate limiting. `SUBMISSION_PERSISTENCE_ENABLED=false` remains the safe configuration default. Database failures return generic messages and never expose provider errors or credentials.

## Authentication and sessions

- Login and session tokens use 32 cryptographically random bytes.
- Turso stores only SHA-256 token hashes; raw tokens exist only in the email URL or HttpOnly cookie.
- Magic links expire in 15 minutes and are consumed by one conditional database update.
- Login responses are generic to avoid account enumeration.
- Session cookies are host-only, HttpOnly, SameSite=Lax, path `/`, high priority, and Secure in production.
- Logout deletes both the server-side session and browser cookie.
- Return paths must be same-origin relative paths.
- Email and network login attempts, submissions, edits, verification checks, reviews, updates, and moderation are rate-limited with HMAC-derived actor keys.
- Product upvotes derive identity from the server session, are rate-limited, and are unique per product/user at the database layer.
- Reactions require a registered session and are unique per product/account and product/HMAC-anonymized IP. Raw IP addresses are never persisted.
- Downvotes additionally require a validated written reason and moderator approval; registered users are not challenged with reCAPTCHA.
- `AUTH_DEV_MAGIC_LINK_ENABLED` cannot expose links in production.
- Anonymous write forms fail closed in production unless both the public reCAPTCHA site key and server-only secret are configured.

## Ownership and moderation

- DNS ownership uses an expiring TXT challenge under `_beforebig.<domain>`.
- The expected proof is HMAC-bound to the challenge, product, and user.
- A successful proof grants owner membership and makes a draft public, but the page remains `noindex`.
- Only moderator/admin roles can approve indexing or publish/reject reviews.
- Material edits to an approved product return it to public/review state.

## Public pages

- Draft, unverified, thin, disputed, or incomplete pages stay `noindex`.
- User-generated content is escaped/sanitized before rendering.
- External links use safe target attributes and appropriate relationship values.
- Public counters must be reconcilable to immutable events or provider rows.
- Vote totals are counted from `product_votes`; the client never submits a total or a user ID.
- Public downvote totals are counted only from admin-approved `product_downvotes`; pending/rejected rows, voter identity, and reason are never rendered publicly. Reasons are visible only in the role-protected admin moderation queue.
- reCAPTCHA response tokens are never persisted or logged. Anonymous-form verification omits raw IP addresses, uses a five-second provider timeout, and fails closed when Google or configuration is unavailable.

## Privacy

Avoid raw IP retention. Use short-lived, rotating hashes for deduplication when needed. Keep founder-domain analytics and buyer activity private by default. Support deletion and export before collecting sensitive data.

The public analytics layer stores only an event type, public entity slug, timestamp, and HMAC-derived anonymous session hash. It does not store raw IP addresses, user agents, or external destination data. GA4 is opt-in by environment configuration and must follow the product's consent/privacy requirements before production use.

## Payments and future webhooks

Stripe is not enabled in the demo. When enabled, raw signed webhook bodies are verified, processing is idempotent, and publication/ranking state never trusts a browser success redirect.


## Recommendations and collections

Recommendation reasons remain private until approved. Authors cannot moderate their own proposal; product owners/editors cannot recommend or support their own products. Support is account-unique and rate-limited; it does not use the product reaction network-lock policy. Reasons are escaped as text and become public with approval.

Collection visibility is enforced at storage reads, not just navigation. Only owners can edit, save, remove, archive, or restore. Public collections are discoverable; private/removed collections return not-found to unauthorized viewers. Public responses omit owner email/ID, pending recommendation identities, and hidden product details. Collection metadata never includes private titles. Soft-removed collections retain data; instance operators must establish a retention policy.


## Search and taxonomy

The public search index contains only public/approved records. Database triggers remove entries when records become hidden; queries independently recheck status. Search text is capped at 200 characters, tokenized into literal word-prefix terms, and parameter-bound. Query parameters cannot introduce SQL or FTS operators. Result pages have bounded sizes and deterministic ordering; category/tag counts and facets exclude hidden records. Sample fallback is explicitly labeled and does not stand in for a successful empty database query.


## Uploaded images

Uploads are disabled by default. Session/membership/state, exact application Origin, and durable rate limits precede raw-body processing. The server checks bounded bytes, MIME/signature/decoded format, dimensions, animation, and decoder deadlines, then stores a new metadata-free WebP in private storage. There is no SVG/video/remote import path. A per-process decoder cap limits simultaneous native decoding. See [media limits and storage setup](MEDIA.md).

Pending/rejected images are readable only by product members and moderators. Separate moderator approval is required for public viewing; product membership or uploader identity prevents self-approval. Approved media is also hidden when its product becomes hidden. Every gateway read rechecks access, enforces size/digest integrity, and uses no-store headers; the Next image optimizer is deliberately bypassed. Physical removal revokes access before deleting bytes, with tombstones for retry and abandoned-upload cleanup. Keep buckets and local folders private, preserve cleanup triggers, and configure provider backup/version retention. Downloaded copies cannot be revoked. Metadata stripping cannot remove private information visible in pixels or prove image rights; manual review remains necessary.
