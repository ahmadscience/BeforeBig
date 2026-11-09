# Using BeforeBig

## Discover and compare

Open `/today` to search names, taglines, descriptions, categories, and tags. Words are case-insensitive and all query words must match. Category, stage, platform, software-license, pricing-model, and verified-only filters combine with search. Unknown metadata is shown explicitly rather than inferred from tags or price text. Sort by recommended (repository order, live records first), upvotes, newest record date, or name. “Newest” uses the stored record date, not a claim about a product's actual release date.

Submit the form to apply filters. Filters stay in the URL and survive reloads and shared links. Reset clears them. Empty results suggest broadening the search. Verification means recorded ownership status, not an endorsement.

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
