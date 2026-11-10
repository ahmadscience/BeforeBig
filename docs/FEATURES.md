# Features and roadmap

BeforeBig focuses on early product discovery. Like a popular alternative tool, it supports searching software, inspecting product details, and comparing fit. Recommendations based on category/tag overlap are suggestions, not community endorsements.

## Available

- Search names, taglines, descriptions, categories, and tags through a database-backed FTS5 index.
- Page through the full catalog with stable ordering and shareable filter URLs.
- Browse dedicated category and tag directories/pages with indexed exact filters.
- Filter by category, stage, platform, license, pricing model, and ownership verification.
- Sort by recommendation order, upvotes, record date, or name.
- Compare up to three public products using shareable URLs.
- Inspect product fit, price, founder updates, moderated reviews, and related suggestions.
- Recommend alternatives with written reasons; moderators approve before publication, and other accounts can support approved suggestions.
- Create private or public collections, save/remove approved products, edit visibility, and restore removed collections.
- Upload PNG/JPEG/WebP screenshots and product images with byte/dimension validation, metadata stripping, private storage, separate moderation, cover selection, and removal/cleanup. See [media setup](MEDIA.md).
- Export account JSON and individual canonical images after recent sign-in; revoke other sessions or permanently delete the account with explicit product-record choices. See [privacy controls](PRIVACY.md).
- Keep optional internal/GA4 analytics off by default, with browser opt-in/out and Global Privacy Control support.
- Try the account-free browser playgrounds at `/demo/community`, `/demo/catalog`, `/demo/media`, and `/demo/privacy`.
- Submit and edit products, verify domain ownership, and moderate public records.
- Use authenticated upvotes and private reasoned downvotes, with account/network limits.
- Browse offline examples or connect your own database and optional analytics providers.

Platform, license, and pricing fields default to unknown. Open-source claims require a public source URL; they are not independently audited.

## Planned improvements

| Area | Remaining work |
| --- | --- |
| Larger deployments | Cursor pagination, precomputed ranking counters, and split sitemaps |
| Metadata evidence | Better provenance and software-license verification |
| Additional media | Video support and automated content/rights screening |
| Privacy operations | Account import, scheduled retention, external-provider erasure, and backup reconciliation |

Payments, traffic guarantees, and editorial/news publishing are outside the current scope. See [CONTRIBUTING.md](../CONTRIBUTING.md) to propose or implement improvements.
