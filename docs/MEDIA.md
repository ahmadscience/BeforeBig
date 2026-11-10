# Product screenshots and images

Uploads are optional and disabled by default. They require a migrated database, signed-in owner/editor membership, `RATE_LIMIT_HASH_SALT`, and private storage. Run `pnpm db:migrate` against your own database before enabling this feature; migration `0010_product_media.sql` adds the gallery and deletion tombstones. The offline playground at `/demo/media` uses fictional sample images and never uploads files.

## Development storage

Add these values to your private environment file:

```dotenv
MEDIA_UPLOADS_ENABLED="true"
MEDIA_STORAGE_DRIVER="local"
MEDIA_LOCAL_DIR=".media"
```

The local driver creates private files outside `public/`, with random names and exclusive writes. `.media/` is ignored by Git. If you choose another folder, keep it outside any static server/document root and add it to your own ignore rules. Keep the directory under operator control; do not let other users replace it or its parent directories. Local storage is deliberately refused in production and is unsuitable for ephemeral or multiple application instances.

## Production: private S3-compatible storage

Create your own private bucket with public access blocked. Do not enable public bucket/CDN access, static website hosting, or browser uploads. The application does not create buckets or change bucket policies. All reads pass through the application gateway so moderation, privacy, and removal remain enforceable.

```dotenv
MEDIA_UPLOADS_ENABLED="true"
MEDIA_STORAGE_DRIVER="s3"
MEDIA_S3_BUCKET="your-private-bucket"
MEDIA_S3_REGION="your-region"
MEDIA_S3_ACCESS_KEY_ID=""
MEDIA_S3_SECRET_ACCESS_KEY=""
# Leave blank for AWS S3. For another provider, use its HTTPS origin only.
MEDIA_S3_ENDPOINT=""
MEDIA_S3_FORCE_PATH_STYLE="false"
```

Use a dedicated server-only credential. AWS S3 uses the bucket's region; Cloudflare R2 uses `auto` and its account-specific S3 API origin. Other compatible providers may require path-style addressing. Endpoints must use HTTPS with no credentials, path, query, or fragment. No ambient/default credential chain is used. Never put these values in `NEXT_PUBLIC_*` variables, source control, or a browser bundle.

For AWS, a minimal object permission statement is below. Substitute your bucket name; retain the fixed prefix. The app needs no list, ACL, or bucket-management permissions. Apply the equivalent object read/write/delete permissions with your provider. Configure encryption, backups, credential rotation, storage quotas, and cost alerts for your instance.

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
    "Resource": "arn:aws:s3:::your-private-bucket/beforebig/media/*"
  }]
}
```

If bucket versioning is enabled, a delete may retain prior versions. Configure noncurrent-version expiration and backup retention to meet your removal policy. The app removes the current object; it cannot promise erasure from provider backups or already downloaded copies.

Set `NEXT_PUBLIC_APP_URL` to the exact application origin. The upload endpoint requires that Origin header. Use a Node runtime with Sharp support and a request body allowance of at least 4 MiB. A proxy may reject uploads before the app's own checks; keep its limit bounded and compatible. Restart/redeploy after configuration changes. Production storage configuration is checked by `pnpm env:check` when uploads are enabled; provider connectivity still requires an actual upload/read/delete smoke test on your own instance.

## Validation and access

| Rule | Behavior |
| --- | --- |
| Formats | Still PNG, JPEG, and WebP only; no SVG, GIF, video, documents, or remote URL imports |
| Input | Maximum 4 MiB, at least 32 × 32 pixels, at most 8,192 pixels per side and 12 megapixels |
| Decoder | MIME, magic bytes, decoded format, truncation, and animation checks; bounded body read and decoder deadlines; two active decodes per Node process |
| Stored file | Auto-oriented, resized inside 2,560 × 1,600, re-encoded WebP, maximum 2 MiB; source bytes, filename, EXIF, and other metadata are discarded |
| Gallery | Six active images per product, including unfinished reservations; transactional slot checks |
| Abuse controls | Session/membership/state checked before processing; durable account limits target 20 upload attempts per hour, plus action limits |
| Publication | Pending/private until a separate moderator approves; the uploader and product members cannot approve their own media |
| Read access | Approved image + public/approved product for visitors; otherwise only product members and moderators; hidden/deleted URLs return not-found |
| Gateway | Bounded storage reads, SHA-256 integrity check, `private, no-store`, `Vary: Cookie`, MIME-sniffing protection; image optimization caching is bypassed |

A rights confirmation is required, but cannot prove ownership. Moderators must review the visible image and its description/caption for private data, misleading content, and rights issues. Re-encoding and metadata removal do not redact pixels, scan for every threat, or replace content review. Keep Sharp and its native codecs patched. Captions are rendered as escaped text.

## Gallery workflow and removal

Owners/editors upload from **Dashboard → product → Screenshots & images**. Alt text is required; captions are optional. Changing metadata returns an approved image to review; saving unchanged details preserves approval. Only approved images can become the gallery cover. The first approved image is the public cover, with additional images below it.

Moderators use the pending/approved/rejected image tabs at `/admin/moderation`. They can approve, reject/hide, or permanently remove images. Rejecting an approved image immediately hides it publicly but retains private bytes for founder/moderator review. Permanent removal revokes gateway access first, then attempts storage deletion. A failed deletion remains a durable tombstone for retry. Disabling new uploads does not disable authorized reading or removal of existing images.

Run cleanup from a full project checkout with development dependencies installed (`pnpm install --frozen-lockfile`), using the same database and storage configuration as the application:

```bash
pnpm media:cleanup          # dry run; aggregate candidate count only
pnpm media:cleanup --apply  # delete up to 100 eligible objects
```

Cleanup retries tombstones and expires unfinished uploads older than one hour. It rechecks eligibility before deleting, never sweeps arbitrary bucket objects, and exits nonzero if any deletion fails. Repeat until the candidate count is zero. Schedule the apply command with your own job runner if needed; no worker is deployed automatically. Failed uploads remain unreadable, even if their cleanup must wait. Hard product deletion preserves keys in tombstones through a checked SQL trigger; retain that trigger in future migrations.
