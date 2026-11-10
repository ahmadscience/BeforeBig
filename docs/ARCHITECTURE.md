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

`src/db/catalog.ts` queries a SQLite FTS5 index for word-prefix search and indexed category/tag/platform term rows for exact filters. User text is bound as quoted literal prefixes joined by AND; FTS operators are not accepted. Matching counts, ordering, LIMIT, and OFFSET run in the database. Only the selected page receives vote/activity hydration. The default page size is 12, with bounded choices up to 48 and a unique ID tie-breaker for every sort.

Migration `0009_catalog_search.sql` backfills visible records and maintains both indexes with insert/update/delete triggers. Draft, suspended, and discontinued records are excluded; every read also checks current publication state. Virtual tables/triggers are maintained in checked SQL because Drizzle does not model FTS5. See [SQLite's FTS5 reference](https://www.sqlite.org/fts5.html).

`/categories` and `/tags` are paginated directories; their detail pages reuse the catalog search component. Taxonomy keys preserve punctuation/Unicode and use URL encoding instead of lossy slug conversion. Sample-only terms are noindex. Filtered query variants are noindex with canonical URLs; indexable real terms can enter the dynamic sitemap. The sitemap term query is capped at 10,000 terms; larger deployments should split sitemaps. Offset pagination remains proportional to offset on very deep pages; cursor pagination is a later optimization.

`/compare` resolves up to three selected public records independently of the shortlist and uses indexed search to find additional choices. Homepage and related-product selectors remain bounded shortlists rather than loading the whole catalog.

## Data sources and disconnected states

Bundled fixtures carry `source: "sample"`; database records carry `source: "database"`. This provenance affects labels and sample interactions, not authorization. Fixtures disable persistent reactions. Connected demo records have real database counters but remain `noindex`.

Discovery falls back to clearly labeled fixtures if database reads fail; connected empty/no-match results stay empty and are never padded with samples. A configured but unreachable database can still fail content/session queries; this is not a complete offline cache. Blank `DATABASE_URL` for a database-free demo.

Draft submission without persistence returns a clearly labeled provisional preview. Saving requires an authenticated session, durable rate limiting, and the persistence flag. External email, CAPTCHA, and GA4 adapters are configured independently; an unavailable reporting source is not a zero count.

## Runtime boundaries

- Server actions and route handlers enforce authorization; hidden controls are not a security boundary.
- Anonymous analytics append events through `/api/analytics`; outbound links record clicks through `/go/[slug]`. GA4 is optional and reported separately.
- Votes and reviews use database uniqueness and moderation rules described in [the data model](DATA_MODEL.md).
- Third-party scripts stay optional and route-scoped. The app uses system fonts and has no media upload pipeline.
- Hosting needs a server runtime and remote database; static export is not supported. No official service or background worker is provided.
- CI runs typechecking, lint, tests, a production build, and the existing Lighthouse budgets. See [contributing](../CONTRIBUTING.md).


## Community data boundary

`src/db/community.ts` centralizes recommendation lifecycle and collection authorization. Server actions derive the actor from the session, validate input, apply durable rate limits, and invalidate dependent pages. Public reads filter relationship state and both product states. Collection reads apply visibility/ownership before returning titles or items, and public DTOs omit identity fields. Generic collection metadata prevents private title leakage.

`/demo/community` is an isolated Client Component playground. Its local role switch never calls server actions, changes account permissions, or writes to a database.
