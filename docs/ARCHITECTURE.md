# Architecture

BeforeBig uses Next.js App Router, React, strict TypeScript, and Turso/libSQL through Drizzle. Pages are Server Components by default; Client Components handle browser interaction. UI primitives live in the source tree and use Tailwind CSS and Lucide icons.

## Repository map

```text
src/app/              pages, layouts, actions, route handlers
src/components/       reusable UI and browser interactions
src/components/ui/    source-owned UI primitives
src/lib/              domain rules, validation, authentication, configuration
src/db/               database schema and repositories
drizzle/              SQL migrations and migration metadata
scripts/              environment checks, migration and demo seeding
docs/                 setup, usage, and technical guides
```

## Request flow

```text
Browser -> page / action / route handler
        -> input validation
        -> session, permission, resource-state and rate-limit checks for writes
        -> domain operation -> Drizzle -> Turso
```

Magic links and sessions use random opaque tokens; only hashes are stored. Product permissions come from owner/editor memberships. DNS TXT challenges establish domain control; moderation separately controls public indexing. See [security](SECURITY.md) for the full rules.

## Catalog discovery

`src/lib/discovery.ts` implements filtering, sorting, and related-product scoring. `/today` awaits search parameters and renders a GET form with shareable filter URLs. Search matches all case-insensitive words across public catalog text. Explicit sorting works on a copy; the default preserves repository order.

`/compare` resolves up to three selections against the public catalog and deduplicates them. It does not resolve arbitrary private products from query strings. Related suggestions use category/tag overlap, distinct from community-endorsed alternative relationships.

Search currently filters the loaded catalog in memory. Add indexed queries and pagination before supporting a large catalog.

## Data sources and disconnected states

Bundled fixtures carry `source: "sample"`; database records carry `source: "database"`. This provenance affects labels and sample interactions, not authorization. Fixtures disable persistent reactions. Connected demo records have real database counters but remain `noindex`.

Discovery falls back to fixtures if database reads fail. A configured but unreachable database can still fail content/session queries; this is not a complete offline cache. Blank `DATABASE_URL` for a database-free demo.

Draft submission without persistence returns a clearly labeled provisional preview. Saving requires an authenticated session, durable rate limiting, and the persistence flag. External email, CAPTCHA, and GA4 adapters are configured independently; an unavailable reporting source is not a zero count.

## Runtime boundaries

- Server actions and route handlers enforce authorization; hidden controls are not a security boundary.
- Anonymous analytics append events through `/api/analytics`; outbound links record clicks through `/go/[slug]`. GA4 is optional and reported separately.
- Votes and reviews use database uniqueness and moderation rules described in [the data model](DATA_MODEL.md).
- Third-party scripts stay optional and route-scoped. The app uses system fonts and has no media upload pipeline.
- Hosting needs a server runtime and remote database; static export is not supported. No official service or background worker is provided.
- CI runs typechecking, lint, tests, a production build, and the existing Lighthouse budgets. See [contributing](../CONTRIBUTING.md).
