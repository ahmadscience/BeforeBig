# Using BeforeBig

## Discover and compare

Open `/today` to search names, taglines, descriptions, categories, and tags. Search uses case-insensitive word prefixes, and all query words must match (for example, `plan` matches `planning`). It is not an arbitrary substring search. Quotes, punctuation, and words such as OR do not act as search operators. Category, stage, platform, software-license, pricing-model, and verified-only filters combine with search. Unknown metadata is shown explicitly rather than inferred from tags or price text. Sort by recommended (repository order, live records first), upvotes, newest record date, or name. “Newest” uses the stored record date, not a claim about a product's actual release date.

Submit the form to apply filters. Filters stay in the URL and survive reloads and shared links. Reset clears them; submitting a new search or changing filters starts at page 1. Pagination preserves the active filters and page size. Invalid pages default to 1; pages past the end redirect to the last available page. Empty results suggest broadening the search. Verification means recorded ownership status, not an endorsement.

Open **Compare** in navigation (`/compare`), choose two or three different products, and submit. The table compares purpose, category, intended fit, exclusions, founder-provided price, stage, ownership, tags, platforms, software-license type, pricing model, and source repository. Duplicate selections count as one product. These are public record claims; the table does not imply independent testing. The URL stores selections and can be shared.

Product pages suggest related records if they share a category or tag. Category overlap is weighted above a single shared tag. Suggestions exclude the current product and do not claim community approval. A small catalog may have no related records.

## Founder workflow (database required)

1. Sign in at `/sign-in`. Locally, the explicitly enabled helper displays the one-use link; a hosted instance sends email.
2. Submit a public website URL at `/submit`. A signed-in user can save a draft when persistence is enabled. Repeated domains reuse the existing record.
3. Open `/dashboard`, select your product, and edit its description, fit, price, category, tags, platforms, software-license type, pricing model, and source repository. Open-source claims require a public HTTP(S) source URL; ownership verification is not a software-license audit.
4. Follow the claim/verification instructions for the product. Add the provided DNS TXT challenge under `_beforebig.<product-domain>` and check it after DNS propagation.
5. Ownership proof grants membership and makes the record public, but moderation is a separate step. Unverified and unapproved records remain `noindex`.
6. Publish updates from the product editor. Read the analytics definitions before interpreting visitor/click numbers.

Editing material details on an approved product sends it back for review. DNS verification requires a domain you control; the bundled `.example` demos cannot be verified through real DNS.

## Community and moderation

Signed-in users can toggle an upvote, submit a structured review, or give a private 20–500 character downvote reason. Upvotes and downvotes are mutually exclusive. Reactions are limited by both account and anonymized network identity, so multiple accounts on a shared IP cannot react to the same product concurrently.

Reviews wait for moderation. New downvotes are pending and do not affect public totals or ranking. Only admin-approved downvote aggregates are public; reasons and identities remain private.

An admin configured through `ADMIN_EMAILS` signs in and visits `/admin/moderation` to review records, reviews, and downvote evidence. Approval controls indexing separately from DNS ownership. Sample fixtures accept no persistent reactions; connected demo records use actual database counters but remain excluded from indexing.

## Themes and accessibility

The theme control stores a local preference. Navigation, search, comparison, and product links support keyboard use. A skip link moves to main content. Comparison tables can scroll horizontally on small screens and can be focused with a keyboard. Reduced-motion preferences suppress transitions.


## Community-recommended alternatives

On an approved, database-backed product page, sign in and open **Recommend an alternative**. Choose another approved product and explain the shared use case in 30–1,000 characters. Reasons are private while pending and become public only after moderator approval. Owners/editors cannot propose or support relationships involving their own products. There is one directional recommendation per product pair; other community members can add/remove one support vote per account.

Your proposals show their status on the source product page. Withdraw a pending or approved proposal to hide it and clear its supports. A rejected or withdrawn proposal can be revised and resubmitted by its original author. A moderator reviews proposals at `/admin/moderation`; they cannot approve their own proposal. If either product loses approval, its relationship and support controls disappear from public views.

## Saved collections

Open **Collections**, sign in, and create a title/description. New collections default to private. Save approved products from their product pages, then remove individual items or edit the collection from its page. Repeated saves keep a single item. Each account can keep up to 50 active collections with 100 products each.

Public collections are listed in community browsing and can be shared by their page URL. Titles, descriptions, and approved products are public; owner emails and IDs are not shown. Private collections return not-found to other viewers, even when they know the URL. Switching back to private immediately revokes public access. All collection pages use generic, non-indexable metadata.

Removing a collection immediately hides its public URL and moves it to **Removed collections**, where the owner can restore it with its saved items. This is a soft removal: records are retained until the instance operator applies their retention/deletion policy. Account export and permanent account deletion remain future work.

To try the flows without signing in, open `/demo/community`. Its role switch and actions affect fictional browser-memory data only, not actual roles, moderation, or saved account data.


## Categories, tags, and catalog pages

Open `/categories` or `/tags`, or follow category/tag links on a product card or record. Category pages group the main purpose; tag pages connect shared attributes. The same search, metadata filters, sorting, and pagination work within each page's fixed scope. Reset clears optional filters without leaving the category/tag.

Taxonomy paths use encoded, normalized labels, such as `/categories/project%20management` and `/tags/ai`. Punctuation is preserved: C++ and C# have different URLs. Unknown terms return not-found. A database outage is labeled as sample fallback rather than a live result set; an empty connected catalog stays empty. Directories show counts for currently visible records and paginate 48 terms at a time. Category/stage select controls show up to 100 choices; use the directory for additional categories.

Catalog pages default to 12 products and offer 4, 24, or 48 per page. Search does not stop at the first 24 records. Counts and results can change as the live catalog changes; page ordering uses a unique record ID to make ties stable. Compare's search box finds candidates outside the initial shortlist and keeps existing selections.

Try `/demo/catalog` without an account to explore multiple pages, category/tag browsing, empty states, and search with fictional data. It uses browser-only sample filtering, not a live search index.
