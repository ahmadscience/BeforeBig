import { randomUUID } from "node:crypto";
import { and, count, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { productDownvotes, productEvents, productReactionLocks, productVotes } from "@/db/schema";

export async function submitProductDownvote(productId: string, userId: string, reason: string, networkKeyHash: string) {
  const db = getDb();
  if (!db) return null;
  const now = new Date();
  return db.transaction(async (tx) => {
    const [userLock] = await tx
      .select({ id: productReactionLocks.id })
      .from(productReactionLocks)
      .where(and(eq(productReactionLocks.productId, productId), eq(productReactionLocks.userId, userId)))
      .limit(1);
    if (userLock) {
      await tx.update(productReactionLocks).set({ reactionType: "downvote", updatedAt: now }).where(eq(productReactionLocks.id, userLock.id));
    } else {
      const [createdLock] = await tx
        .insert(productReactionLocks)
        .values({ id: randomUUID(), productId, userId, networkKeyHash, reactionType: "downvote", createdAt: now, updatedAt: now })
        .onConflictDoNothing()
        .returning({ id: productReactionLocks.id });
      if (!createdLock) return { downvoted: false, count: null, reason: "network_conflict" as const };
    }

    const [downvote] = await tx
      .insert(productDownvotes)
      .values({
        id: randomUUID(), productId, userId, reason, status: "pending", captchaHostname: null, captchaVerifiedAt: null, createdAt: now, updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [productDownvotes.productId, productDownvotes.userId],
        set: { reason, status: "pending", captchaHostname: null, captchaVerifiedAt: null, moderatedByUserId: null, moderatedAt: null, updatedAt: now },
      })
      .returning({ id: productDownvotes.id });
    if (!downvote) throw new Error("The downvote was not saved.");

    await tx.delete(productVotes).where(and(eq(productVotes.productId, productId), eq(productVotes.userId, userId)));
    await tx.insert(productEvents).values({
      id: randomUUID(), productId, actorUserId: userId, eventType: "product_downvote_submitted", metadataJson: JSON.stringify({ downvoteId: downvote.id }), occurredAt: now,
    });
    const [countResult] = await tx.select({ value: count() }).from(productDownvotes).where(and(eq(productDownvotes.productId, productId), eq(productDownvotes.status, "approved")));
    return { downvoted: true, count: Number(countResult?.value ?? 0), viewerDownvoteStatus: "pending" as const };
  });
}

export async function withdrawProductDownvote(productId: string, userId: string) {
  const db = getDb();
  if (!db) return null;
  const now = new Date();
  const [withdrawn] = await db
    .update(productDownvotes)
    .set({ status: "withdrawn", updatedAt: now })
    .where(and(eq(productDownvotes.productId, productId), eq(productDownvotes.userId, userId), inArray(productDownvotes.status, ["pending", "approved"])))
    .returning({ id: productDownvotes.id });
  if (withdrawn) {
    await db.delete(productReactionLocks).where(and(eq(productReactionLocks.productId, productId), eq(productReactionLocks.userId, userId)));
    await db.insert(productEvents).values({
      id: randomUUID(),
      productId,
      actorUserId: userId,
      eventType: "product_downvote_withdrawn",
      metadataJson: JSON.stringify({ downvoteId: withdrawn.id }),
      occurredAt: now,
    });
  }
  return getProductDownvoteState(productId, userId);
}

export async function getProductDownvoteState(productId: string, viewerUserId?: string) {
  const db = getDb();
  if (!db) return { count: 0, viewerHasDownvoted: false };
  const [countResult] = await db
    .select({ value: count() })
    .from(productDownvotes)
    .where(and(eq(productDownvotes.productId, productId), eq(productDownvotes.status, "approved")));
  const [viewerDownvote] = viewerUserId
    ? await db
        .select({ id: productDownvotes.id, status: productDownvotes.status })
        .from(productDownvotes)
        .where(and(eq(productDownvotes.productId, productId), eq(productDownvotes.userId, viewerUserId), inArray(productDownvotes.status, ["pending", "approved"])))
        .limit(1)
    : [];
  return {
    count: Number(countResult?.value ?? 0),
    viewerHasDownvoted: Boolean(viewerDownvote),
    viewerDownvoteStatus: viewerDownvote?.status === "pending" || viewerDownvote?.status === "approved" ? viewerDownvote.status : undefined,
  };
}
