"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertModerator } from "@/lib/auth";
import { getDb } from "@/db/client";
import { moderationEvents, productDownvotes, productEvents, productReactionLocks, products, reviews } from "@/db/schema";
import { consumeRateLimit } from "@/lib/rate-limit";

const productModerationSchema = z.object({
  productId: z.string().uuid(),
  slug: z.string().min(1).max(80),
  action: z.enum(["approve", "reject", "suspend"]),
  note: z.string().trim().max(500).optional(),
});

export async function moderateProduct(formData: FormData) {
  const parsed = productModerationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const moderator = await assertModerator();
  const db = getDb();
  if (!db) return;
  const [product] = await db.select().from(products).where(eq(products.id, parsed.data.productId)).limit(1);
  if (!product) return;
  if (parsed.data.action === "approve" && product.verificationStatus === "unverified") return;

  const limit = await consumeRateLimit({ action: "moderation_product", actorKey: moderator.id, limit: 100, windowMs: 60 * 60_000 });
  if (!limit.allowed) return;
  const now = new Date();
  const status = parsed.data.action === "approve" ? "approved" : parsed.data.action === "suspend" ? "suspended" : "public";
  await db.update(products).set({ status, updatedAt: now }).where(eq(products.id, product.id));
  await db.insert(moderationEvents).values({
    id: randomUUID(),
    productId: product.id,
    actorUserId: moderator.id,
    action: parsed.data.action,
    note: parsed.data.note || null,
    createdAt: now,
  });
  await db.insert(productEvents).values({
    id: randomUUID(),
    productId: product.id,
    actorUserId: moderator.id,
    eventType: `moderation_${parsed.data.action}`,
    occurredAt: now,
  });
  revalidatePath(`/${parsed.data.slug}`);
  revalidatePath("/admin/moderation");
}

const reviewModerationSchema = z.object({
  reviewId: z.string().uuid(),
  productSlug: z.string().min(1).max(80),
  decision: z.enum(["published", "rejected"]),
});

export async function moderateReview(formData: FormData) {
  const parsed = reviewModerationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const moderator = await assertModerator();
  const db = getDb();
  if (!db) return;
  const limit = await consumeRateLimit({ action: "moderation_review", actorKey: moderator.id, limit: 150, windowMs: 60 * 60_000 });
  if (!limit.allowed) return;
  await db.update(reviews).set({ status: parsed.data.decision, moderatedAt: new Date() }).where(eq(reviews.id, parsed.data.reviewId));
  revalidatePath(`/${parsed.data.productSlug}`);
  revalidatePath("/admin/moderation");
}

const downvoteModerationSchema = z.object({
  downvoteId: z.string().uuid(),
  productSlug: z.string().min(1).max(80),
  decision: z.enum(["approved", "rejected"]),
});

export async function moderateDownvote(formData: FormData) {
  const parsed = downvoteModerationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const moderator = await assertModerator();
  const db = getDb();
  if (!db) return;
  const limit = await consumeRateLimit({ action: "moderation_downvote", actorKey: moderator.id, limit: 150, windowMs: 60 * 60_000 });
  if (!limit.allowed) return;

  const now = new Date();
  const [moderated] = await db
    .update(productDownvotes)
    .set({ status: parsed.data.decision, moderatedByUserId: moderator.id, moderatedAt: now, updatedAt: now })
    .where(and(eq(productDownvotes.id, parsed.data.downvoteId), eq(productDownvotes.status, "pending")))
    .returning({ id: productDownvotes.id, productId: productDownvotes.productId, userId: productDownvotes.userId });
  if (!moderated) return;

  if (parsed.data.decision === "rejected") {
    await db.delete(productReactionLocks).where(and(eq(productReactionLocks.productId, moderated.productId), eq(productReactionLocks.userId, moderated.userId)));
  }

  await db.insert(productEvents).values({
    id: randomUUID(),
    productId: moderated.productId,
    actorUserId: moderator.id,
    eventType: `product_downvote_${parsed.data.decision}`,
    metadataJson: JSON.stringify({ downvoteId: moderated.id }),
    occurredAt: now,
  });
  revalidatePath("/");
  revalidatePath("/today");
  revalidatePath(`/${parsed.data.productSlug}`);
  revalidatePath("/admin/moderation");
}
