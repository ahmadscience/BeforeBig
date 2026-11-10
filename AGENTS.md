<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


# BeforeBig contributor instructions

- Read README.md, docs/SETUP.md, docs/ARCHITECTURE.md, and docs/FEATURES.md before changing behavior.
- This is a source project for community use; no official hosted launch is planned. Do not add deployment claims, fabricated metrics, or payments without an explicit scope change.
- Use Node 24 and pnpm 11.24.0. Keep port 3247 for local work.
- Start with offline fixtures. Never read, print, overwrite, or commit `.env.local`; do not use the owner's database for tests, migrations, or seeds without authorization.
- Keep authentication, ownership, resource-state checks, and rate limits on the server. Preserve private downvote reasons and noindex rules.
- Explain non-obvious invariants and fallbacks in comments. Update documentation when changing configuration or workflows.
- Run typecheck, lint, tests, and a production build for behavior changes; inspect visible changes in both themes and at mobile widths.
- Preserve the Next.js rules above.
