# Contributing to BeforeBig

Start with [setup](docs/SETUP.md), [architecture](docs/ARCHITECTURE.md), and the [feature gaps](docs/FEATURES.md). The current direction is a reusable source project with no official hosted launch. Bug reports and small, well-explained improvements are welcome.

## Work locally

1. Fork and clone the repository, then create a branch for one coherent change.
2. Use Node 24 and the pinned pnpm version. Install with `pnpm install --frozen-lockfile`.
3. Copy `.env.example` to `.env.local`. Start with offline fixtures; use your own database for mutations.
4. Make the change, update relevant documentation, and run `pnpm verify`.
5. For visible changes, check desktop and mobile, both themes, keyboard focus, empty states, and long text. Include screenshots in your pull request.
6. Describe the problem, resulting behavior, validation, and limitations. Link a related issue when available.

Never include credentials, personal database files, real user content, or generated build output in a pull request. Do not run migrations or seed scripts against another person's database.

## Code conventions

- TypeScript stays strict. Prefer Server Components; use Client Components for browser interaction.
- Read the installed Next.js guides in `node_modules/next/dist/docs/` before changing framework APIs; this project uses Next 16 with asynchronous route props and request APIs.
- Put reusable domain rules in `src/lib`, persistence in `src/db`, and request/auth boundaries in actions or route handlers.
- Treat form/query input as untrusted. Check permission, resource state, and rate limits on the server for every mutation.
- Add comments where they explain a constraint, security decision, fallback, or non-obvious algorithm. Avoid comments that restate the code. Document public contracts and environment changes.
- Keep fictional fixtures visibly distinct from database records. Do not invent platform, license, price, endorsement, or traffic claims.
- Keep third-party scripts optional and route-scoped. Use the existing UI primitives, system fonts, and shared CSS tokens.

## Tests and database changes

Use Vitest for domain behavior and security regressions. Add meaningful tests when changing validation, ranking/filtering, authorization rules, or reaction invariants. UI-only tweaks usually need browser inspection instead of tests that repeat markup.

For schema changes, edit `src/db/schema.ts`, run `pnpm db:generate`, review the generated SQL and snapshots, then apply to your own disposable database using `pnpm db:migrate`. Commit the schema, SQL, and migration metadata together. Explain compatibility and data preservation; never delete applied migrations to rewrite history.

`pnpm perf:audit` requires a completed production build, browser support, and port 3247. It measures each route three times, checks median timing/performance values, and requires every run to meet accessibility, best-practices, and SEO thresholds. Unit tests do not prove the connected founder/moderator journey: report separately whether you tested authentication, saving, DNS verification, approval, and reactions against your own database.

## Reporting issues

Include what you expected, what happened, reproduction steps, Node/pnpm versions, and whether you used offline fixtures or a connected database. Redact environment values, cookies, emails, tokens, and private moderation evidence. Use the repository's bug/feature templates.

For vulnerabilities, follow [SECURITY.md](SECURITY.md). Keep discussion constructive, respect maintainers' time, and avoid personal attacks or publishing other people's data.
