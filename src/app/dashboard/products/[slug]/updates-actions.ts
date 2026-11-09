"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertUser } from "@/lib/auth";
import { getDb } from "@/db/client";
import { productEvents, productUpdates } from "@/db/schema";
import { findPersistedProductRowBySlug, getProductMembership } from "@/db/products";
import { consumeRateLimit } from "@/lib/rate-limit";

const updateSchema = z.object({
  slug: z.string().min(1).max(80),
  title: z.string().trim().min(5, "Add a specific update title.").max(100),
  body: z.string().trim().min(30, "Add at least 30 characters.").max(2_000),
});

export type ProductUpdateState = { error?: string; message?: string };

export async function publishProductUpdate(_previous: ProductUpdateState, formData: FormData): Promise<ProductUpdateState> {
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the update." };
  const user = await assertUser();
  const product = await findPersistedProductRowBySlug(parsed.data.slug);
  if (!product) return { error: "Product not found." };
  if (!(await getProductMembership(product.id, user.id))) return { error: "You do not have access to this product." };
  const limit = await consumeRateLimit({ action: "product_update", actorKey: user.id, limit: 10, windowMs: 24 * 60 * 60_000 });
  if (!limit.allowed) return { error: "You have reached today’s update limit." };
  const db = getDb();
  if (!db) return { error: "Storage is not configured." };
  const now = new Date();
  await db.insert(productUpdates).values({
    id: randomUUID(),
    productId: product.id,
    authorUserId: user.id,
    title: parsed.data.title,
    body: parsed.data.body,
    status: "published",
    createdAt: now,
    publishedAt: now,
  });
  await db.insert(productEvents).values({
    id: randomUUID(),
    productId: product.id,
    actorUserId: user.id,
    eventType: "update_published",
    occurredAt: now,
  });
  revalidatePath(`/${product.slug}`);
  return { message: "Update published to the permanent record." };
}
