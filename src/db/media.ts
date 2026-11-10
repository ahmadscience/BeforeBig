import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, lt, lte, max, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import { productMedia as media, products, productMemberships, productEvents } from "@/db/schema";
import { mediaLimits, storedMediaDetailsSchema, mediaMetadataSchema, mediaObjectKey, mediaUploadMetadataSchema, MediaError, type MediaItem } from "@/lib/media";

type Database = NonNullable<ReturnType<typeof getDb>>;
export type MediaActor = { id: string; role: string };
type Row = typeof media.$inferSelect;
export const mediaDTO = (row: Row): MediaItem => ({ id: row.id, src: "/media/" + row.id, altText: row.altText, caption: row.caption, kind: row.kind, width: row.width, height: row.height, status: row.status, position: row.position });
const moderator = (actor?: MediaActor | null) => Boolean(actor && ["admin", "moderator"].includes(actor.role));
export function getMediaStore() { const db = getDb(); return db ? createMediaStore(db) : null; }

export function createMediaStore(db: Database) {
  async function member(actor: MediaActor, productId: string, connection: Pick<Database, "select"> = db) {
    const [row] = await connection.select({ id: productMemberships.id }).from(productMemberships).where(and(eq(productMemberships.productId, productId), eq(productMemberships.userId, actor.id))).limit(1);
    return Boolean(row);
  }
  async function owned(actor: MediaActor, slug: string, editable = false, connection: Pick<Database, "select"> = db) {
    const [product] = await connection.select().from(products).where(eq(products.slug, slug)).limit(1);
    if (!product || !await member(actor, product.id, connection)) throw new MediaError("Product not found or unavailable.", 404);
    if (editable && !["draft", "public", "approved"].includes(product.status)) throw new MediaError("This product cannot accept media changes right now.", 409);
    return product;
  }
  async function ownedItem(actor: MediaActor, id: string, connection: Pick<Database, "select"> = db) {
    const [row] = await connection.select().from(media).where(and(eq(media.id, id), isNull(media.deletedAt))).limit(1);
    if (!row?.productId || !await member(actor, row.productId, connection)) throw new MediaError("Media not found or unavailable.", 404);
    return row;
  }
  return {
    assertEditable: (actor: MediaActor, slug: string) => owned(actor, slug, true),
    async ownedMedia(actor: MediaActor, slug: string) {
      const product = await owned(actor, slug);
      const rows = await db.select().from(media).where(and(eq(media.productId, product.id), isNull(media.deletedAt))).orderBy(asc(media.position), asc(media.createdAt));
      return rows.map((row) => ({ ...mediaDTO(row), moderationNote: row.moderationNote }));
    },
    async publicMedia(productId: string) {
      const rows = await db.select({ media }).from(media).innerJoin(products, eq(products.id, media.productId))
        .where(and(eq(media.productId, productId), isNull(media.deletedAt), eq(media.status, "approved"), inArray(products.status, ["public", "approved"]))).orderBy(asc(media.position), asc(media.createdAt));
      return rows.map(({ media: row }) => mediaDTO(row));
    },
    async reserve(actor: MediaActor, slug: string, input: unknown, details: { width: number; height: number; byteSize: number; sha256: string }) {
      const metadata = mediaUploadMetadataSchema.parse(input);
      details = storedMediaDetailsSchema.parse(details);
      return db.transaction(async (tx) => {
        const product = await owned(actor, slug, true, tx);
        const [total] = await tx.select({ value: count(), last: max(media.position) }).from(media).where(and(eq(media.productId, product.id), isNull(media.deletedAt)));
        if (total.value >= mediaLimits.items) throw new MediaError("A product can have up to six images. Remove one before uploading another.", 409);
        const id = randomUUID(); const storageKey = mediaObjectKey(id); const now = new Date();
        await tx.insert(media).values({ id, storageKey, productId: product.id, uploaderUserId: actor.id, altText: metadata.altText, caption: metadata.caption, kind: metadata.kind, ...details, position: (total.last ?? -1) + 1, rightsConfirmedAt: now, cleanupAfter: new Date(now.getTime()+60*60_000), createdAt: now, updatedAt: now });
        return { id, storageKey, productSlug: product.slug };
      });
    },
    async complete(actor: MediaActor, id: string) {
      return db.transaction(async (tx) => {
        const row = await ownedItem(actor, id, tx);
        if (row.status !== "uploading") throw new MediaError("This upload is no longer active.", 409);
        const [product] = await tx.select().from(products).where(eq(products.id, row.productId!)).limit(1);
        if (!product || !["draft", "public", "approved"].includes(product.status)) throw new MediaError("Product is no longer accepting media.", 409);
        await tx.update(media).set({ status: "pending", cleanupAfter: null, updatedAt: new Date() }).where(eq(media.id, id));
        await tx.insert(productEvents).values({ id: randomUUID(), productId: row.productId!, actorUserId: actor.id, eventType: "media_uploaded", occurredAt: new Date() });
      });
    },
    async edit(actor: MediaActor, id: string, input: unknown) {
      const metadata = mediaMetadataSchema.parse(input);
      return db.transaction(async (tx) => {
        const row = await ownedItem(actor, id, tx);
        if (!["pending", "approved", "rejected"].includes(row.status)) throw new MediaError("This image cannot be edited yet.", 409);
        const [product] = await tx.select().from(products).where(eq(products.id, row.productId!)).limit(1);
        if (!product || !["draft", "public", "approved"].includes(product.status)) throw new MediaError("Product is not accepting media changes.", 409);
        if (row.altText === metadata.altText && row.caption === metadata.caption && row.kind === metadata.kind) return;
        await tx.update(media).set({ ...metadata, status: "pending", moderatedAt: null, moderatedByUserId: null, moderationNote: null, updatedAt: new Date() }).where(eq(media.id, id));
      });
    },
    async cover(actor: MediaActor, id: string) {
      return db.transaction(async (tx) => {
        const row = await ownedItem(actor, id, tx);
        const [product] = await tx.select().from(products).where(eq(products.id, row.productId!)).limit(1);
        if (!product || !["draft", "public", "approved"].includes(product.status)) throw new MediaError("Product is not accepting media changes.", 409);
        if (row.status !== "approved") throw new MediaError("Approve the image before making it the cover.", 409);
        const rows = await tx.select({ id: media.id }).from(media).where(and(eq(media.productId, row.productId!), isNull(media.deletedAt))).orderBy(asc(media.position), asc(media.createdAt));
        const ordered = [id, ...rows.map((item) => item.id).filter((value) => value !== id)];
        for (let index = 0; index < ordered.length; index++) await tx.update(media).set({ position: index, updatedAt: new Date() }).where(eq(media.id, ordered[index]));
      });
    },
    async moderate(actor: MediaActor, id: string, decision: "approved" | "rejected", note: string) {
      if (!moderator(actor)) throw new MediaError("Moderator access required.", 403);
      return db.transaction(async (tx) => {
        const [row] = await tx.select().from(media).where(and(eq(media.id, id), isNull(media.deletedAt), inArray(media.status, ["pending", "approved", "rejected"]))).limit(1);
        if (!row?.productId) throw new MediaError("Media not found or unavailable.", 404);
        if (decision === "approved" && (row.uploaderUserId === actor.id || await member(actor, row.productId, tx))) throw new MediaError("Another moderator must approve your own product media.", 403);
        const [product] = await tx.select().from(products).where(eq(products.id, row.productId)).limit(1);
        if (!product || (decision === "approved" && !["draft", "public", "approved"].includes(product.status))) throw new MediaError("Product is not accepting media changes.", 409);
        await tx.update(media).set({ status: decision, moderationNote: note || null, moderatedByUserId: actor.id, moderatedAt: new Date(), updatedAt: new Date() }).where(eq(media.id, id));
        await tx.insert(productEvents).values({ id: randomUUID(), productId: row.productId, actorUserId: actor.id, eventType: "media_" + decision, occurredAt: new Date() });
      });
    },
    async queue(actor: MediaActor, status: "pending" | "approved" | "rejected" = "pending") {
      if (!moderator(actor)) throw new MediaError("Moderator access required.", 403);
      const rows = await db.select({ media, productName: products.name, slug: products.slug }).from(media).innerJoin(products, eq(products.id, media.productId))
        .where(and(eq(media.status, status), isNull(media.deletedAt))).orderBy(desc(media.updatedAt)).limit(100);
      return Promise.all(rows.map(async ({ media: row, ...rest }) => ({ ...rest, ...mediaDTO(row), own: row.uploaderUserId === actor.id || await member(actor, row.productId!), moderationNote: row.moderationNote })));
    },
    async readable(id: string, actor?: MediaActor | null) {
      const [row] = await db.select({ media, productStatus: products.status }).from(media).innerJoin(products, eq(products.id, media.productId))
        .where(and(eq(media.id, id), isNull(media.deletedAt), inArray(media.status, ["pending", "approved", "rejected"]))).limit(1);
      if (!row) return null;
      if (row.media.status === "approved" && ["public", "approved"].includes(row.productStatus)) return row.media;
      if (actor && (moderator(actor) || await member(actor, row.media.productId!))) return row.media;
      return null;
    },
    async remove(actor: MediaActor, id: string) {
      const row = moderator(actor)
        ? (await db.select().from(media).where(and(eq(media.id, id), isNull(media.deletedAt))).limit(1))[0]
        : await ownedItem(actor, id);
      if (!row) throw new MediaError("Media not found or unavailable.", 404);
      if (row.status === "uploading") throw new MediaError("The upload is still in progress. Try again once it finishes.", 409);
      await db.update(media).set({ status: "deleted", deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(media.id, id), isNull(media.deletedAt)));
      return row.storageKey;
    },
    // System-only lifecycle methods; IDs originate from reservations/cleanup, never a user key.
    async failReservation(id: string) { await db.update(media).set({ status: "failed", storageDeletedAt: null, deletedAt: new Date(), updatedAt: new Date() }).where(eq(media.id, id)); },
    async markStorageDeleted(id: string) { await db.update(media).set({ storageDeletedAt: new Date() }).where(and(eq(media.id, id), isNotNull(media.deletedAt))); },
    async cleanupCandidates(cutoff: Date) {
      return db.select({ id: media.id, storageKey: media.storageKey }).from(media)
        .where(and(isNull(media.storageDeletedAt), or(isNull(media.cleanupAfter), lte(media.cleanupAfter,new Date(cutoff.getTime()+60*60_000))), or(isNotNull(media.deletedAt), and(eq(media.status, "uploading"), lt(media.createdAt, cutoff)))))
        .orderBy(asc(media.createdAt)).limit(100);
    },
    async claimCleanup(id: string, cutoff: Date) {
      const rows = await db.update(media).set({ status: "deleted", deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(media.id, id), isNull(media.storageDeletedAt), or(isNull(media.cleanupAfter), lte(media.cleanupAfter,new Date(cutoff.getTime()+60*60_000))), or(isNotNull(media.deletedAt), and(eq(media.status, "uploading"), lt(media.createdAt, cutoff)))))
        .returning({ id: media.id });
      return rows.length > 0;
    },
  };
}
export type MediaStore = ReturnType<typeof createMediaStore>;
