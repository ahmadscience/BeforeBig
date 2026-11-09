import { randomUUID } from "node:crypto";
import { and, count, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { productDownvotes, productEvents, productReactionLocks, productVotes } from "@/db/schema";

export async function toggleProductVote(productId: string, userId: string, networkKeyHash: string) {
  const db = getDb();
  if (!db) return null;
  const now = new Date();
  return db.transaction(async (tx) => {
    const [existingVote] = await tx
      .select({ id: productVotes.id })
      .from(productVotes)
      .where(and(eq(productVotes.productId, productId), eq(productVotes.userId, userId)))
      .limit(1);

    if (existingVote) {
      await tx.delete(productVotes).where(eq(productVotes.id, existingVote.id));
      await tx.delete(productReactionLocks).where(and(eq(productReactionLocks.productId, productId), eq(productReactionLocks.userId, userId)));
      await tx.insert(productEvents).values({ id: randomUUID(), productId, actorUserId: userId, eventType: "product_upvote_removed", occurredAt: now });
      const [result] = await tx.select({ value: count() }).from(productVotes).where(eq(productVotes.productId, productId));
      return { voted: false, count: Number(result?.value ?? 0) };
    }

    const [userLock] = await tx
      .select({ id: productReactionLocks.id })
      .from(productReactionLocks)
      .where(and(eq(productReactionLocks.productId, productId), eq(productReactionLocks.userId, userId)))
      .limit(1);
    if (userLock) {
      await tx.update(productReactionLocks).set({ reactionType: "upvote", updatedAt: now }).where(eq(productReactionLocks.id, userLock.id));
    } else {
      const [createdLock] = await tx
        .insert(productReactionLocks)
        .values({ id: randomUUID(), productId, userId, networkKeyHash, reactionType: "upvote", createdAt: now, updatedAt: now })
        .onConflictDoNothing()
        .returning({ id: productReactionLocks.id });
      if (!createdLock) return { voted: false, count: null, reason: "network_conflict" as const };
    }

    await tx
      .update(productDownvotes)
      .set({ status: "withdrawn", updatedAt: now })
      .where(and(eq(productDownvotes.productId, productId), eq(productDownvotes.userId, userId), inArray(productDownvotes.status, ["pending", "approved"])));
    const [createdVote] = await tx
      .insert(productVotes)
      .values({ id: randomUUID(), productId, userId, createdAt: now })
      .onConflictDoNothing({ target: [productVotes.productId, productVotes.userId] })
      .returning({ id: productVotes.id });
    if (!createdVote) throw new Error("reaction_write_conflict");

    await tx.insert(productEvents).values({ id: randomUUID(), productId, actorUserId: userId, eventType: "product_upvoted", occurredAt: now });
    const [result] = await tx.select({ value: count() }).from(productVotes).where(eq(productVotes.productId, productId));
    return { voted: true, count: Number(result?.value ?? 0) };
  });
}

export async function getProductVoteState(productId: string, viewerUserId?: string) {
  const db = getDb();
  if (!db) return { count: 0, viewerHasVoted: false };
  const [countResult] = await db.select({ value: count() }).from(productVotes).where(eq(productVotes.productId, productId));
  const [viewerVote] = viewerUserId
    ? await db
        .select({ id: productVotes.id })
        .from(productVotes)
        .where(and(eq(productVotes.productId, productId), eq(productVotes.userId, viewerUserId)))
        .limit(1)
    : [];
  return { count: Number(countResult?.value ?? 0), viewerHasVoted: Boolean(viewerVote) };
}
