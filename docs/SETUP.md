# Setup and configuration

## Requirements

Use Node.js 24 and pnpm 11.24.0. CI uses Node 24; other versions have not been verified for this source release. Commands run from the project root. Install exactly from `pnpm-lock.yaml` with `pnpm install --frozen-lockfile`.

If pnpm is unavailable, enable Corepack and activate the version in `package.json`. If your Node distribution does not bundle Corepack, install Corepack with your Node package manager first.

## Offline demo

Copy `.env.example` to `.env.local` and run `pnpm dev`. Keep `DATABASE_URL` and provider credentials blank. This mode reads `src/data/demo-products.json`; it supports discovery, filtering, comparisons, and provisional URL previews. `/demo/community` adds an interactive browser-only playground that resets on reload; persistent recommendations and collections require a database. Authentication, moderation, reviews, durable analytics, and saving require a database. Example product URLs are fictional, not working services.

Next.js loads root environment files automatically. Scripts load `.env.local` and then `.env` with dotenv. Existing process variables take priority. Restart development after changes; `NEXT_PUBLIC_*` values are embedded at build time for production. Never place secrets in those variables.

## Configure your own database

Create your own Turso/libSQL database and put its `libsql://` URL and authentication token in `.env.local`. The app imports `drizzle-orm/libsql/web`; `file:local.db` is not supported by that runtime adapter. Migration scripts use the full libSQL client, which does not imply local-file support in the application.

```bash
pnpm db:migrate
pnpm db:seed:demo:preview
pnpm db:seed:demo
```

This version requires migration `0008_sparkling_warhawk.sql` for community recommendations, support votes, and saved collections. Apply all checked migrations before starting the connected app.

These commands target the database in your environment. Review the target before running them. Migrations apply checked SQL through Drizzle's migration ledger. Demo seeding uses stable `demo_` IDs, skips conflicting domains/slugs, and updates its own existing records. Back up a database before schema changes. No automatic rollback command is provided.

Generate a different random secret for each salt/key below. For example, run this four times and store each result privately:

```bash
node -e 'console.log(require("node:crypto").randomBytes(32).toString("hex"))'
```

Set `RATE_LIMIT_HASH_SALT`, `VOTE_IP_HASH_SALT`, `VERIFICATION_SECRET`, and `ANALYTICS_HASH_SALT`. Keep them stable for the instance: changing them affects deduplication, reaction network locks, and outstanding verification challenges.

For local founder workflows, enable `AUTH_DEV_MAGIC_LINK_ENABLED="true"` and `SUBMISSION_PERSISTENCE_ENABLED="true"`. Add your own email to `ADMIN_EMAILS`, sign in at `/sign-in`, and open the development link displayed by the form. This helper works only with a database and is forcibly disabled in production. Keep email delivery and reCAPTCHA disabled for local development.

## Environment reference

| Variables | Purpose / when required |
| --- | --- |
| `DATABASE_URL`, `DATABASE_AUTH_TOKEN` | Your Turso database; required for sessions and persistence |
| `NEXT_PUBLIC_APP_URL` | Instance origin; default `http://127.0.0.1:3247`; HTTPS for hosting |
| `NEXT_PUBLIC_BRAND_NAME` | Configuration brand value; some UI strings still use BeforeBig explicitly |
| `SUBMISSION_PERSISTENCE_ENABLED` | Opt in to saving drafts; requires auth and rate limits |
| `AUTH_DEV_MAGIC_LINK_ENABLED` | Local-only login link shown in UI; never production |
| `RATE_LIMIT_HASH_SALT` | Dedicated key for hashed abuse-control identities |
| `VOTE_IP_HASH_SALT` | Dedicated HMAC key for one-network-per-product reaction locks |
| `VERIFICATION_SECRET` | Dedicated key for DNS ownership challenges |
| `ANALYTICS_HASH_SALT` | Anonymous internal session hashing |
| `ADMIN_EMAILS` | Comma-separated exact admin emails, applied at successful login |
| `EMAIL_FEATURE_ENABLED`, `EMAIL_PROVIDER` | Opt in to delivery; `mailgun`, `resend`, or `postmark` |
| `EMAIL_API_KEY`, `EMAIL_FROM` | Provider key and sender |
| `MAILGUN_DOMAIN`, `MAILGUN_API_BASE_URL` | Mailgun sending domain; US or EU API origin |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY`, `RECAPTCHA_ALLOWED_HOSTNAMES` | Anonymous form protection for hosting; hostnames exclude scheme, port, and path |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Optional GA4 browser tag; leave blank to avoid loading it |
| `GA_PROPERTY_ID`, `GA_CLIENT_EMAIL`, `GA_PRIVATE_KEY` | Optional read-only GA4 reporting credentials |
| `TRAFFIC_FEATURE_ENABLED`, `PAYMENTS_FEATURE_ENABLED` | Reserved flags; do not implement traffic delivery or payments by enabling them |

All flags are enabled only by the literal string `true`. Public values are not secrets. Use at least 32 random characters for secrets; do not reuse credentials between instances.

Removing an address from `ADMIN_EMAILS` does not automatically demote its existing database role. Role revocation requires a deliberate database operation; there is no user-management UI yet.

## Running a hosted instance

No official deployment is planned. If you host your own, use a Node-compatible Next.js server or Vercel with a remote Turso database. This is not a static export: sessions, actions, DNS checks, and database reads need a server runtime.

Set the HTTPS app origin, production database, salts, admin allowlist, email delivery, anonymous-form CAPTCHA, and persistence flag. Run `pnpm env:check` with those values loaded, then `pnpm build` and `pnpm start` (or your hosting adapter). The start script binds loopback port 3247; put a reverse proxy in front when self-hosting. The environment checker requires the full connected configuration, not the offline demo. A passing checker validates configuration shape, not provider connectivity.

Before accepting other people's data, define retention, consent, backups, deletion, and support processes. Those operational workflows are not supplied by this project.

## Troubleshooting

- **No login link:** configure your database and migrations, then the local helper or an email provider. Production also requires reCAPTCHA.
- **Preview not saved:** persistence is off, you are signed out, or the database/rate-limit configuration is incomplete.
- **Only samples appear:** check your database connection and migration state. Discovery falls back to fixtures when reads fail.
- **Product page fails with an unreachable configured database:** only discovery has complete fixture fallback; content/session queries can still fail. Blank `DATABASE_URL` for an offline demo.
- **Vote rejected on a shared network:** the deliberate one-HMAC-network-per-product rule can affect households and offices. See `src/db/votes.ts` and `src/db/downvotes.ts` before changing this policy.
- **Build or Lighthouse port conflict:** stop the development server on 3247 before `pnpm perf:audit`. Do not move this project to shared ports 3000/3100.
- **Types for a new route missing:** run `pnpm exec next typegen`, then `pnpm typecheck`.
