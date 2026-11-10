import { createHash } from "node:crypto";
import type { MediaActor, MediaStore } from "@/db/media";
import type { MediaStorage } from "@/lib/media-storage";
import { mediaLimits, mediaUploadMetadataSchema, MediaError } from "@/lib/media";
import { normalizeMediaImage, readBoundedBody } from "@/lib/media-image";

export async function uploadMedia(store: MediaStore, storage: MediaStorage, actor: MediaActor, slug: string, request: Request) {
  await store.assertEditable(actor, slug);
  const header = request.headers.get("x-media-metadata") ?? "";
  if (header.length > 6000) throw new MediaError("Image details are too long.", 400);
  let input: unknown;
  try { input = JSON.parse(decodeURIComponent(header)); } catch { throw new MediaError("Provide valid image details.", 400); }
  const metadata = mediaUploadMetadataSchema.parse(input);
  const bytes = await readBoundedBody(request, mediaLimits.inputBytes);
  const image = await normalizeMediaImage(bytes, request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "");
  const reservation = await store.reserve(actor, slug, metadata, image);
  try {
    await storage.put(reservation.storageKey, image.bytes);
    await store.complete(actor, reservation.id);
  } catch {
    // A failed/uncertain write stays unreadable. Durable tombstones allow safe cleanup retries.
    try { await store.failReservation(reservation.id); } catch { /* A stale reservation can also be collected later. */ }
    try { await storage.remove(reservation.storageKey); await store.markStorageDeleted(reservation.id); } catch { /* Cleanup is retryable. */ }
    throw new MediaError("The image could not be stored. Please try again later.", 503);
  }
  return { id: reservation.id, status: "pending", width: image.width, height: image.height, byteSize: image.byteSize };
}
export async function removeMedia(store: MediaStore, storage: MediaStorage | null, actor: MediaActor, id: string) {
  const key = await store.remove(actor, id); // Hide the URL before attempting physical deletion.
  if (!storage) return { cleanupPending: true };
  try { await storage.remove(key); await store.markStorageDeleted(id); return { cleanupPending: false }; }
  catch { return { cleanupPending: true }; }
}
export async function readMedia(store: MediaStore, storage: MediaStorage, id: string, actor?: MediaActor | null) {
  const item = await store.readable(id, actor);
  if (!item) throw new MediaError("Media not found.", 404);
  let bytes: Buffer;
  try { bytes = await storage.get(item.storageKey); } catch { throw new MediaError("Media is temporarily unavailable.", 503); }
  if (bytes.length !== item.byteSize || createHash("sha256").update(bytes).digest("hex") !== item.sha256) throw new MediaError("Media is temporarily unavailable.", 503);
  return bytes;
}
export async function cleanupMedia(store: MediaStore, storage: MediaStorage, apply = false, now = new Date()) {
  // Upload and object-write deadlines are much shorter than this grace period.
  const cutoff = new Date(now.getTime() - 60 * 60_000);
  const candidates = await store.cleanupCandidates(cutoff);
  let deleted = 0; let failed = 0;
  if (apply) for (const candidate of candidates) {
    try {
      if (!await store.claimCleanup(candidate.id, cutoff)) continue;
      await storage.remove(candidate.storageKey); await store.markStorageDeleted(candidate.id); deleted++;
    } catch { failed++; }
  }
  return { candidates: candidates.length, deleted, failed };
}
