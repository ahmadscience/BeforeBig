import { randomUUID } from "node:crypto";
import { and, count, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { getDb } from "@/db/client";
import { alternativeRecommendations as recommendations, alternativeSupports as supports, collections, collectionItems, products, productMemberships } from "@/db/schema";
import { collectionSchema, recommendationSchema, CommunityError, isCommunityProduct } from "@/lib/community";

type Database = NonNullable<ReturnType<typeof getDb>>;
type Actor = { id: string; role: string };
const source = alias(products, "source_product");

export function getCommunityStore() { const db = getDb(); return db ? createCommunityStore(db) : null; }

/** Actor IDs come from server sessions. Queries enforce visibility/ownership even when callers bypass the UI. */
export function createCommunityStore(db: Database) {
  async function approvedProduct(slug: string, connection: Pick<Database, "select"> = db) {
    const [product] = await connection.select().from(products).where(and(eq(products.slug, slug), eq(products.status, "approved"))).limit(1);
    if (!product) throw new CommunityError("Choose an approved product from the catalog.");
    return product;
  }
  async function ownedCollection(id: string, actorId: string, connection: Pick<Database, "select"> = db) {
    const [collection] = await connection.select().from(collections).where(and(eq(collections.id, id), eq(collections.ownerUserId, actorId), isNull(collections.deletedAt))).limit(1);
    if (!collection) throw new CommunityError("Collection not found or unavailable.");
    return collection;
  }
  return {
    async propose(actor: Actor, input: unknown) {
      const parsed = recommendationSchema.parse(input);
      return db.transaction(async (tx) => {
        const from = await approvedProduct(parsed.sourceSlug, tx);
        const to = await approvedProduct(parsed.targetSlug, tx);
        const memberships = await tx.select({ id: productMemberships.id }).from(productMemberships).where(and(eq(productMemberships.userId, actor.id), inArray(productMemberships.productId, [from.id, to.id]))).limit(1);
        if (memberships.length) throw new CommunityError("Owners and editors cannot recommend their own products.");
        const [existing] = await tx.select().from(recommendations).where(and(eq(recommendations.sourceProductId, from.id), eq(recommendations.targetProductId, to.id))).limit(1);
        const now = new Date();
        if (existing) {
          if (existing.authorUserId !== actor.id || !["rejected", "withdrawn"].includes(existing.status)) throw new CommunityError("This alternative has already been proposed. Support it once it is approved.");
          await tx.update(recommendations).set({ reason: parsed.reason, status: "pending", moderatedAt: null, moderatedByUserId: null, updatedAt: now }).where(eq(recommendations.id, existing.id));
          return existing.id;
        }
        const id = randomUUID();
        await tx.insert(recommendations).values({ id, sourceProductId: from.id, targetProductId: to.id, authorUserId: actor.id, reason: parsed.reason, createdAt: now, updatedAt: now });
        return id;
      });
    },
    async listAlternatives(sourceProductId: string, viewerId?: string) {
      const rows = await db.select({
        id: recommendations.id, reason: recommendations.reason, authorId: recommendations.authorUserId,
        targetName: products.name, targetSlug: products.slug, tagline: products.tagline,
        supportCount: count(supports.id),
        viewerSupported: sql<number>`max(case when ${supports.userId} = ${viewerId ?? ""} then 1 else 0 end)`,
      }).from(recommendations)
        .innerJoin(products, eq(recommendations.targetProductId, products.id))
        .innerJoin(source, eq(recommendations.sourceProductId, source.id))
        .leftJoin(supports, eq(supports.recommendationId, recommendations.id))
        .where(and(eq(recommendations.sourceProductId, sourceProductId), eq(recommendations.status, "approved"), eq(products.status, "approved"), eq(source.status, "approved")))
        .groupBy(recommendations.id).orderBy(desc(count(supports.id)), desc(recommendations.createdAt));
      // Author identity is used only for the viewer's own controls, never returned publicly.
      return rows.map(({ authorId, ...row }) => ({ ...row, own: authorId === viewerId, viewerSupported: Boolean(row.viewerSupported) }));
    },
    async ownRecommendations(sourceProductId: string, viewerId: string) {
      return db.select({ id: recommendations.id, reason: recommendations.reason, status: recommendations.status, targetName: products.name })
        .from(recommendations).innerJoin(products, eq(products.id, recommendations.targetProductId))
        .where(and(eq(recommendations.sourceProductId, sourceProductId), eq(recommendations.authorUserId, viewerId))).orderBy(desc(recommendations.updatedAt));
    },
    async queue(actor: Actor) {
      if (!["admin", "moderator"].includes(actor.role)) throw new CommunityError("Moderator access required.");
      return db.select({ id: recommendations.id, reason: recommendations.reason, authorId: recommendations.authorUserId, sourceName: source.name, targetName: products.name })
        .from(recommendations).innerJoin(products, eq(products.id, recommendations.targetProductId)).innerJoin(source, eq(source.id, recommendations.sourceProductId))
        .where(eq(recommendations.status, "pending")).orderBy(recommendations.createdAt).limit(100);
    },
    async moderate(actor: Actor, id: string, decision: "approved" | "rejected") {
      if (!["admin", "moderator"].includes(actor.role)) throw new CommunityError("Moderator access required.");
      return db.transaction(async (tx) => {
        const [row] = await tx.select({ recommendation: recommendations, sourceStatus: source.status, targetStatus: products.status })
          .from(recommendations).innerJoin(source, eq(source.id, recommendations.sourceProductId)).innerJoin(products, eq(products.id, recommendations.targetProductId))
          .where(and(eq(recommendations.id, id), eq(recommendations.status, "pending"))).limit(1);
        if (!row) throw new CommunityError("Recommendation is no longer pending.");
        if (row.recommendation.authorUserId === actor.id) throw new CommunityError("Another moderator must review your recommendation.");
        if (decision === "approved" && (!isCommunityProduct(row.sourceStatus) || !isCommunityProduct(row.targetStatus))) throw new CommunityError("Both products must be approved first.");
        await tx.update(recommendations).set({ status: decision, moderatedByUserId: actor.id, moderatedAt: new Date(), updatedAt: new Date() }).where(eq(recommendations.id, id));
      });
    },
    async withdraw(actor: Actor, id: string) {
      return db.transaction(async (tx) => {
        const [row] = await tx.update(recommendations).set({ status: "withdrawn", updatedAt: new Date() })
          .where(and(eq(recommendations.id, id), eq(recommendations.authorUserId, actor.id))).returning({ id: recommendations.id });
        if (!row) throw new CommunityError("Recommendation not found.");
        await tx.delete(supports).where(eq(supports.recommendationId, id));
      });
    },
    async toggleSupport(actor: Actor, id: string) {
      return db.transaction(async (tx) => {
        const [row] = await tx.select({ authorId: recommendations.authorUserId, sourceId: source.id, targetId: products.id }).from(recommendations)
          .innerJoin(source, eq(source.id, recommendations.sourceProductId)).innerJoin(products, eq(products.id, recommendations.targetProductId))
          .where(and(eq(recommendations.id, id), eq(recommendations.status, "approved"), eq(source.status, "approved"), eq(products.status, "approved"))).limit(1);
        if (!row) throw new CommunityError("This recommendation is not available for support.");
        const memberships = await tx.select({ id: productMemberships.id }).from(productMemberships).where(and(eq(productMemberships.userId, actor.id), inArray(productMemberships.productId, [row.sourceId, row.targetId]))).limit(1);
        if (row.authorId === actor.id || memberships.length) throw new CommunityError("Authors, owners, and editors cannot support their own recommendation or products.");
        const removed = await tx.delete(supports).where(and(eq(supports.recommendationId, id), eq(supports.userId, actor.id))).returning({ id: supports.id });
        if (!removed.length) await tx.insert(supports).values({ id: randomUUID(), recommendationId: id, userId: actor.id, createdAt: new Date() }).onConflictDoNothing();
        return !removed.length;
      });
    },
    async ownCollections(actorId: string) {
      return db.select().from(collections).where(eq(collections.ownerUserId, actorId)).orderBy(desc(collections.updatedAt));
    },
    async publicCollections() {
      return db.select({ id: collections.id, title: collections.title, description: collections.description }).from(collections)
        .where(and(eq(collections.visibility, "public"), isNull(collections.deletedAt))).orderBy(desc(collections.updatedAt)).limit(50);
    },
    async createCollection(actor: Actor, input: unknown) {
      const parsed = collectionSchema.parse(input);
      return db.transaction(async (tx) => {
        const [total] = await tx.select({ value: count() }).from(collections).where(and(eq(collections.ownerUserId, actor.id), isNull(collections.deletedAt)));
        if (total.value >= 50) throw new CommunityError("You can keep up to 50 active collections.");
        const now = new Date(); const id = randomUUID();
        await tx.insert(collections).values({ id, ownerUserId: actor.id, ...parsed, createdAt: now, updatedAt: now });
        return id;
      });
    },
    async readCollection(id: string, viewerId?: string) {
      // The authorization predicate runs before title, description, or items leave storage.
      const [collection] = await db.select().from(collections).where(and(eq(collections.id, id), isNull(collections.deletedAt), or(eq(collections.visibility, "public"), eq(collections.ownerUserId, viewerId ?? "")))).limit(1);
      if (!collection) return null;
      const items = await db.select({ id: products.id, slug: products.slug, name: products.name, tagline: products.tagline, category: products.category })
        .from(collectionItems).innerJoin(products, eq(collectionItems.productId, products.id))
        .where(and(eq(collectionItems.collectionId, id), eq(products.status, "approved"))).orderBy(desc(collectionItems.createdAt));
      return { id: collection.id, title: collection.title, description: collection.description, visibility: collection.visibility, own: collection.ownerUserId === viewerId, items };
    },
    async editCollection(actor: Actor, id: string, input: unknown) {
      const parsed = collectionSchema.parse(input);
      await ownedCollection(id, actor.id);
      await db.update(collections).set({ ...parsed, updatedAt: new Date() }).where(and(eq(collections.id, id), eq(collections.ownerUserId, actor.id), isNull(collections.deletedAt)));
    },
    async archiveCollection(actor: Actor, id: string, restore = false) {
      return db.transaction(async (tx) => {
        const [row] = await tx.select().from(collections).where(and(eq(collections.id, id), eq(collections.ownerUserId, actor.id))).limit(1);
        if (!row) throw new CommunityError("Collection not found.");
        if (restore) {
          const [total] = await tx.select({ value: count() }).from(collections).where(and(eq(collections.ownerUserId, actor.id), isNull(collections.deletedAt)));
          if (row.deletedAt && total.value >= 50) throw new CommunityError("Remove a collection before restoring another.");
        }
        await tx.update(collections).set({ deletedAt: restore ? null : new Date(), updatedAt: new Date() }).where(eq(collections.id, id));
      });
    },
    async saveProduct(actor: Actor, collectionId: string, slug: string, remove = false) {
      return db.transaction(async (tx) => {
        await ownedCollection(collectionId, actor.id, tx);
        if (remove) {
          const [product] = await tx.select({ id: products.id }).from(products).where(eq(products.slug, slug)).limit(1);
          if (product) await tx.delete(collectionItems).where(and(eq(collectionItems.collectionId, collectionId), eq(collectionItems.productId, product.id)));
        } else {
          const product = await approvedProduct(slug, tx);
          const [existing] = await tx.select({ id: collectionItems.id }).from(collectionItems).where(and(eq(collectionItems.collectionId, collectionId), eq(collectionItems.productId, product.id))).limit(1);
          if (!existing) {
            const [total] = await tx.select({ value: count() }).from(collectionItems).where(eq(collectionItems.collectionId, collectionId));
            if (total.value >= 100) throw new CommunityError("A collection can hold up to 100 products.");
            await tx.insert(collectionItems).values({ id: randomUUID(), collectionId, productId: product.id, createdAt: new Date() }).onConflictDoNothing();
          }
        }
        await tx.update(collections).set({ updatedAt: new Date() }).where(eq(collections.id, collectionId));
      });
    },
  };
}
