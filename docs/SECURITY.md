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
