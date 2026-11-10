import { constants } from "node:fs";
import { lstat, mkdir, open, realpath, unlink } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { assertMediaKey, mediaLimits, MediaError } from "@/lib/media";

export interface MediaStorage { put(key: string, bytes: Buffer): Promise<void>; get(key: string): Promise<Buffer>; remove(key: string): Promise<void> }
type Environment = Record<string, string | undefined>;

export function localMediaStorage(directory: string): MediaStorage {
  const root = resolve(directory); const publicRoot = resolve("public");
  if (root === publicRoot || root.startsWith(publicRoot + sep)) throw new MediaError("Local media must be stored outside public/.", 503);
  async function checkDirectory() {
    if ((await lstat(root)).isSymbolicLink()) throw new MediaError("Use a private directory, not a symbolic link.", 503);
    const actual = await realpath(root);
    const publicPath = await realpath(publicRoot).catch(() => publicRoot);
    if (actual === publicPath || actual.startsWith(publicPath + sep)) throw new MediaError("Local media must be stored outside public/.", 503);
  }
  const path = (key: string) => resolve(root, assertMediaKey(key) + ".webp");
  return {
    async put(key, bytes) {
      const filename = path(key);
      if (!bytes.length || bytes.length > mediaLimits.outputBytes) throw new MediaError("Invalid stored image size.");
      await mkdir(root, { recursive: true, mode: 0o700 });
      await checkDirectory();
      const file = await open(filename, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
      try { await file.writeFile(bytes); } finally { await file.close(); }
    },
    async get(key) {
      assertMediaKey(key); await checkDirectory();
      const file = await open(path(key), constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const stat = await file.stat();
        if (!stat.isFile() || stat.size < 1 || stat.size > mediaLimits.outputBytes) throw new MediaError("Stored image is unavailable.", 503);
        // A bounded read remains safe if a file changes after stat().
        const buffer = Buffer.alloc(mediaLimits.outputBytes + 1); let offset = 0;
        while (offset < buffer.length) { const read = await file.read(buffer, offset, buffer.length - offset, offset); if (!read.bytesRead) break; offset += read.bytesRead; }
        if (offset > mediaLimits.outputBytes) throw new MediaError("Stored image is unavailable.", 503);
        return buffer.subarray(0, offset);
      } finally { await file.close(); }
    },
    async remove(key) { assertMediaKey(key); try { await checkDirectory(); await unlink(path(key)); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; } },
  };
}

/** The bucket stays private. No ACLs, browser credentials, presigned URLs, or arbitrary keys. */
export function s3MediaStorage(client: S3Client, bucket: string): MediaStorage {
  return {
    async put(key, bytes) {
      assertMediaKey(key);
      if (!bytes.length || bytes.length > mediaLimits.outputBytes) throw new MediaError("Invalid stored image size.");
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentLength: bytes.length, ContentType: "image/webp", CacheControl: "private, no-store" }), { abortSignal: AbortSignal.timeout(15000) });
    },
    async get(key) {
      assertMediaKey(key);
      const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }), { abortSignal: AbortSignal.timeout(15000) });
      const body = response.Body;
      if (!body || (response.ContentLength ?? 0) > mediaLimits.outputBytes || !(Symbol.asyncIterator in body)) {
        if (body && "destroy" in body && typeof body.destroy === "function") body.destroy();
        throw new MediaError("Stored image is unavailable.", 503);
      }
      const iterator = (body as AsyncIterable<Uint8Array>)[Symbol.asyncIterator]();
      const chunks: Buffer[] = []; let size = 0; let timer: ReturnType<typeof setTimeout> | undefined;
      const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new MediaError("Storage read timed out.", 503)), 15000); });
      try {
        while (true) {
          const part = await Promise.race([iterator.next(), deadline]); if (part.done) break;
          size += part.value.byteLength;
          if (size > mediaLimits.outputBytes) throw new MediaError("Stored image is unavailable.", 503);
          chunks.push(Buffer.from(part.value));
        }
        return Buffer.concat(chunks, size);
      } finally {
        clearTimeout(timer);
        if ("destroy" in body && typeof body.destroy === "function") body.destroy();
      }
    },
    async remove(key) { assertMediaKey(key); await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }), { abortSignal: AbortSignal.timeout(15000) }); },
  };
}

export function getMediaStorage(env: Environment = process.env): MediaStorage | null {
  if (!env.MEDIA_STORAGE_DRIVER) return null;
  if (env.MEDIA_STORAGE_DRIVER === "local") {
    if (env.NODE_ENV === "production") throw new MediaError("Use private object storage in production.", 503);
    return localMediaStorage(env.MEDIA_LOCAL_DIR || ".media");
  }
  if (env.MEDIA_STORAGE_DRIVER !== "s3") throw new MediaError("Choose a supported media storage driver.", 503);
  const { MEDIA_S3_BUCKET: bucket, MEDIA_S3_REGION: region, MEDIA_S3_ACCESS_KEY_ID: accessKeyId, MEDIA_S3_SECRET_ACCESS_KEY: secretAccessKey } = env;
  if (!bucket || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket) || !region || !accessKeyId || !secretAccessKey) throw new MediaError("Private media storage is not configured.", 503);
  let endpoint: string | undefined;
  if (env.MEDIA_S3_ENDPOINT) {
    let url: URL;
    try { url = new URL(env.MEDIA_S3_ENDPOINT); } catch { throw new MediaError("Use a valid HTTPS storage endpoint.", 503); }
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new MediaError("Use an HTTPS storage origin without credentials or a path.", 503);
    endpoint = url.origin;
  }
  return s3MediaStorage(new S3Client({ region, endpoint, forcePathStyle: env.MEDIA_S3_FORCE_PATH_STYLE === "true", credentials: { accessKeyId, secretAccessKey }, maxAttempts: 2 }), bucket);
}
export function mediaUploadAvailability(env: Environment = process.env) {
  if (env.MEDIA_UPLOADS_ENABLED !== "true") return { enabled: false, message: "Image uploads are disabled on this instance." };
  try { if (!getMediaStorage(env)) return { enabled: false, message: "Configure private media storage before enabling uploads." }; }
  catch { return { enabled: false, message: "Media storage configuration needs attention." }; }
  return { enabled: true, message: "PNG, JPEG, or WebP · up to 4 MiB · six images per product" };
}
