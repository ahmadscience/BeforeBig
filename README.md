# BeforeBig

A software discovery app for finding early products, comparing their fit, and keeping a verified product record. Built with Next.js App Router, React, TypeScript, Drizzle, and Turso/libSQL.

BeforeBig is an MIT-licensed community project. Run the demo, study the implementation, or configure your own instance. There is no official hosted service.

## Try it locally

Use **Node.js 24** (the CI baseline) and **pnpm 11.24.0** (pinned in `package.json`).

```bash
corepack enable
corepack prepare pnpm@11.24.0 --activate
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Open [127.0.0.1:3247](http://127.0.0.1:3247). Keep this project's reserved port `3247`; ports `3000` and `3100` may belong to other projects.

The example environment defaults to **offline demo mode**: no database account, email provider, CAPTCHA, or analytics account is required. Bundled fictional records use `.example` domains. Search and comparison work; login and persistent changes require your own database. Submitting a URL without persistence produces a provisional preview, not a saved record. Never copy someone else's database credentials.

Try the catalog playground at `/demo/catalog` and the community playground at `/demo/community` to explore recommendations, moderation, support votes, and collections with fictional data. Changes reset on reload.

See [setup and configuration](docs/SETUP.md) to enable authentication and writes using your own Turso database. The application database adapter uses libSQL's web transport; a local SQLite file is not a supported application setup.

## What works

- Public product pages with price, fit, tags, lifecycle state, and ownership status.
- Indexed FTS5 catalog search, bounded pagination, category/stage/platform/license/pricing filters, and sorting.
- Dedicated category and tag directories/pages with shareable URLs.
- Side-by-side comparison of up to three public catalog records.
- Moderated community-recommended alternatives with reasons and support votes, separate from category/tag suggestions.
- Owner-managed public/private collections with duplicate-safe saves, removal, and restore.
- Email magic-link authentication, founder dashboard, editable drafts, DNS TXT ownership verification, and role-checked moderation.
- Founder updates, moderated reviews, authenticated upvotes, and private reasoned downvotes pending admin approval.
- Database-enforced account/network reaction limits and HMAC-based anonymous analytics.
- Optional GA4 reporting, light/dark themes, security headers, sitemap/noindex rules, CI, and Lighthouse budgets.

Offline fixtures are labeled samples and cannot accept persistent reactions. Connected demo rows have real database counters but remain `noindex`. Ownership verification proves domain control; it does not endorse pricing or other founder claims.

## Check changes

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
# After building; requires a browser and free port 3247:
pnpm perf:audit
```

`pnpm verify` runs typechecking, lint, unit tests, and the production build. `pnpm env:check` checks a fully configured **hosted** instance; it intentionally fails for the offline demo. Builds load `.env.local`; use an isolated configuration if you want checks to avoid your database entirely.

## Documentation

| Guide | Contents |
| --- | --- |
| [Setup](docs/SETUP.md) | Offline demo, database, environment variables, troubleshooting |
| [Usage](docs/USAGE.md) | Discovery, comparisons, founder and moderator workflows |
| [Contributing](CONTRIBUTING.md) | Development workflow, code comments, tests, pull requests |
| [Architecture](docs/ARCHITECTURE.md) | Runtime boundaries and repository map |
| [Data model](docs/DATA_MODEL.md) | Tables, lifecycle, and reaction invariants |
| [Security model](docs/SECURITY.md) | Authentication, URL handling, privacy, limitations |
| [Analytics](docs/ANALYTICS.md) | Counter definitions and optional GA4 |
| [Features and roadmap](docs/FEATURES.md) | Supported capabilities and planned improvements |

## Status and license

This is an early project, not a managed service. Payments, traffic guarantees, and account export/deletion workflows are not implemented. See the [feature gap list](docs/FEATURES.md) before building on it.

Released under the [MIT License](LICENSE). Dependency licenses remain their respective authors'. UI refinement used [Unslop by Damir Sokolovsky](https://github.com/heydamir/unslop), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); see [credits](CREDITS.md).
