"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/db/client";
import { productEvents, reviews } from "@/db/schema";
import { findPersistedProductRowBySlug, getProductMembership } from "@/db/products";
import { consumeRateLimit } from "@/lib/rate-limit";

const reviewSchema = z.object({
  slug: z.string().min(1).max(80),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().min(30, "Share at least 30 characters of useful context.").max(1_500),
});

export type ReviewState = { error?: string; message?: string };

export async function submitReview(_previous: ReviewState, formData: FormData): Promise<ReviewState> {
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your review." };
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in before submitting a review." };
  const product = await findPersistedProductRowBySlug(parsed.data.slug);
  if (!product) return { error: "Reviews open when this product is connected to the live database." };
  if (await getProductMembership(product.id, user.id)) return { error: "Product owners and editors cannot review their own record." };
  const limit = await consumeRateLimit({ action: "review_submit", actorKey: user.id, limit: 10, windowMs: 24 * 60 * 60_000 });
  if (!limit.allowed) return { error: "You have reached today’s review limit." };
  const db = getDb();
  if (!db) return { error: "Storage is not configured." };
  const now = new Date();
  await db.insert(reviews).values({
    id: randomUUID(),
    productId: product.id,
    authorUserId: user.id,
    rating: parsed.data.rating,
    body: parsed.data.body,
    status: "pending",
    createdAt: now,
  }).onConflictDoUpdate({
    target: [reviews.productId, reviews.authorUserId],
    set: { rating: parsed.data.rating, body: parsed.data.body, status: "pending", moderatedAt: null },
  });
  await db.insert(productEvents).values({
    id: randomUUID(),
    productId: product.id,
    actorUserId: user.id,
    eventType: "review_submitted",
    occurredAt: now,
  });
  revalidatePath(`/${product.slug}`);
  return { message: "Review submitted for moderation." };
}
