# Privacy, exports, and account deletion

The public `/privacy` page explains data use and browser analytics choices. Signed-in users open **Dashboard → Privacy & data** (`/settings/privacy`) for export, session management, and deletion. `/demo/privacy` is a fictional browser-only playground; it never reads or changes account data.

These are software controls, not a universal privacy notice or legal compliance claim. Each instance operator must publish their contact details, purposes, retention periods, backup policy, and applicable external-service information before accepting personal data.

## Access and export

Sensitive actions require a session created by a successful magic-link sign-in within the last **15 minutes**. The page offers **Sign in again** when needed. Signed-in confirmation is bound to the current account email and skips the anonymous CAPTCHA; anonymous sign-in checks remain enabled. No password, email address, account ID, or `fresh` flag from the form authorizes an export or deletion; the server checks the current session and expiry again inside the data transaction. Endpoints reject foreign/missing Origins on POST, apply durable rate limits, and return private, non-cacheable responses with generic provider errors.

**Download account JSON** returns a versioned `beforebig-account.json` attachment. It contains the current account profile, product memberships, product records and facts, owned collections (including soft-removed collections) and their saved references, authored reviews, downvotes, recommendations, supports, votes, updates, image metadata, verification states, session timestamps, and account-attributed event types/dates. Shared product records are collaborative data visible to members; other users' private reviews, collections, email addresses, moderation notes, and identity fields are excluded.

Authentication tokens/hashes, proof secrets, network keys, provider credentials, object keys, and image digests are never included. Internal audit payloads/notes are excluded because they may contain information about others. Anonymous analytics and network security records have no account ID and cannot generally be attributed to the exporting account.

Image bytes are **separate downloads**. The JSON media manifest provides authenticated `/api/account/media/<id>` paths for the uploader's available canonical WebP files, including after product membership has ended. Open those paths on the same instance while recently signed in and save the files **before deleting**. Originals were discarded at upload. An unfinished, deleted, failed, or unavailable image cannot be exported as a file; its status is explicit. This is a JSON export plus individual files, not a ZIP archive or a restore/import feature.

Self-service JSON exports are capped at **2 MiB** and **5,000 rows per section**. Exceeding either limit returns an error requesting operator assistance; no successful export is silently truncated. Operators should supply a complete securely delivered export for larger accounts. Export attempts are limited to five per hour/account.

## Deletion outcomes

Deletion requires a recent sign-in, the exact typed word `DELETE`, acknowledgement of the consequences, and an explicit product-record choice. Download anything needed first. There is no grace period, trash, or account recovery.

| Data | Outcome |
| --- | --- |
| Account profile and every session | Deleted; the current session cookie is cleared and optional analytics reset off in this browser |
| Pending/consumed sign-in links for the account email | Deleted; link consumption/session creation serialize with deletion |
| Collections/items, reviews, recommendations/supports, reactions/locks, verification challenges | Account-owned rows deleted through foreign-key cascades; supports linked to removed recommendations are also removed |
| Authored product updates | Deleted, including updates on shared products |
| Own uploads | URLs revoked and text/attribution scrubbed transactionally; bounded physical-deletion attempt, then durable operator cleanup retries |
| Unshared products where the user is the owner | User chooses removal (including linked community content) or retention of public/approved records as unclaimed; private/unlisted records are always removed |
| Shared products / editor-only access | Product-level records and collaborators' content remain; no ownership is automatically transferred |
| Verification when the last owner leaves | Cleared; approved records return to public/review state; another remaining owner preserves verification |
| Retained audit events attributable to the account | Identity and free-form payload/note cleared |
| Account/email rate-limit hashes under the current salt | Deleted; unlinked network keys are outside the account graph |
| Anonymous analytics, external services, operator config/logs/backups, downloaded copies | Outside automatic account deletion; disclose retention and handle separately |

If public records are retained, product descriptions, facts, and other people's contributions remain. Those fields can contain personal information entered by a contributor; review them before choosing retention. Shared records remain for collaborators, so personal information in collaborative product fields requires operator review. An email listed in the instance's `ADMIN_EMAILS` environment configuration is not removed from that configuration by deleting the database account.

All database changes commit together. A database failure rolls back the operation and leaves the session intact. Physical object deletion occurs after database revocation; up to four objects are attempted per request in pairs, with provider deadlines. In-flight/uncertain uploads wait for a one-hour write grace period even after access revocation. Remaining/failed objects keep scrubbed tombstones and inaccessible URLs. Run the documented [media cleanup command](MEDIA.md#gallery-workflow-and-removal) until complete. Bucket versions, backups, and downloaded copies may remain according to the operator's policy. Re-registering creates a new account; it does not recover removed data.

## Browser analytics choices

Optional internal page/click analytics and GA4 are **off until this browser explicitly allows them**. The public privacy page offers **Keep analytics off** and **Allow optional analytics** without requiring an account. The `beforebig_privacy` cookie stores only `allow` or `deny`, lasts one year, is SameSite=Lax, and is Secure in production. It is readable by the client so beacons can decline to send. Changing the choice reloads the page so an already loaded optional tag is unloaded. Opting out clears the local anonymous analytics session identifier, not historical event rows.

Global Privacy Control (`Sec-GPC: 1` / `navigator.globalPrivacyControl`) takes priority over an allow choice. The analytics endpoint and outbound redirect independently check consent; the redirect still reaches the product website when analytics is off. Essential authentication, HMAC-based abuse prevention, verification, moderation, and theme storage continue to function. The cookie applies to this browser, not every device associated with an account.

## Operator responsibilities

- Apply all migrations through `0011_account_cleanup_grace.sql`. The new column defers physical cleanup of uncertain/in-flight writes for one hour; preserve the media hard-delete trigger and existing cascade/set-null foreign keys.
- Configure authentication, salts, private image storage, and correct `NEXT_PUBLIC_APP_URL`; test export, image download, session revocation, and deletion with disposable accounts on your instance.
- Run `pnpm media:cleanup --apply` regularly and monitor aggregate failures. No background job is created automatically.
- Document bounded retention for anonymous/security logs, email providers, object versions, and backups. This release does not deploy a retention scheduler, an external-provider erasure workflow, or a deletion ledger outside the live database. Before restoring an old backup, reconcile completed erasure requests using your operator process so deleted accounts are not republished.
- Set a support channel for large exports, shared-record redaction, inaccessible storage, or data held outside the application. Keep exports private; never put them in public issues, telemetry, or source control.

The recent-sign-in boundary follows the rationale in [OWASP's authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#require-re-authentication-for-sensitive-features).
