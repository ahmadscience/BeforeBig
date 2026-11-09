"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertUser } from "@/lib/auth";
import { getDb } from "@/db/client";
import { productEvents, products } from "@/db/schema";
import { findPersistedProductRowBySlug, getProductMembership } from "@/db/products";
import { consumeRateLimit } from "@/lib/rate-limit";
import { normalizePublicHttpUrl, normalizedDomainFromUrl } from "@/lib/validation";

import { catalogMetadataSchema } from "@/lib/catalog-metadata";

const editSchema = catalogMetadataSchema.safeExtend({
  slug: z.string().min(1).max(80),
  name: z.string().trim().min(2, "Add a product name.").max(80),
  tagline: z.string().trim().min(8, "Add a clearer tagline.").max(140),
  description: z.string().trim().min(40, "Add at least 40 characters.").max(2_000),
  websiteUrl: z.string().trim().max(2_048),
  category: z.string().trim().min(2).max(60),
  stage: z.string().trim().min(2).max(60),
  bestFor: z.string().trim().min(12).max(300),
  notBestFor: z.string().trim().min(12).max(300),
  price: z.string().trim().min(2).max(80),
  tags: z.string().trim().max(240),
});

export type ProductEditState = { error?: string; message?: string };

export async function updateProduct(_previous: ProductEditState, formData: FormData): Promise<ProductEditState> {
  const parsed = editSchema.safeParse({ ...Object.fromEntries(formData), platforms: formData.getAll("platforms") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the product details." };

  const user = await assertUser();
  const row = await findPersistedProductRowBySlug(parsed.data.slug);
  if (!row) return { error: "Product not found." };
  const membership = await getProductMembership(row.id, user.id);
  if (!membership) return { error: "You do not have access to edit this product." };

  const rateLimit = await consumeRateLimit({ action: "product_edit", actorKey: user.id, limit: 30, windowMs: 60 * 60_000 });
  if (!rateLimit.allowed) return { error: "Editing is temporarily limited. Try again later." };

  let websiteUrl: string;
  try {
    websiteUrl = normalizePublicHttpUrl(parsed.data.websiteUrl);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Check the website URL." };
  }
  if (normalizedDomainFromUrl(websiteUrl) !== row.normalizedDomain) {
    return { error: "The website domain cannot change after submission. Create a separate product record instead." };
  }

  const tags = [...new Set(parsed.data.tags.split(",").map((tag) => tag.trim()).filter(Boolean))].slice(0, 8);
  const db = getDb();
  if (!db) return { error: "Storage is not configured." };
  const now = new Date();
  await db.update(products).set({
    name: parsed.data.name,
    tagline: parsed.data.tagline,
    description: parsed.data.description,
    websiteUrl,
    category: parsed.data.category,
    stage: parsed.data.stage,
    bestFor: parsed.data.bestFor,
    notBestFor: parsed.data.notBestFor,
    price: parsed.data.price,
    tagsJson: JSON.stringify(tags),
    platformsJson: JSON.stringify([...new Set(parsed.data.platforms)]),
    licenseType: parsed.data.licenseType,
    pricingModel: parsed.data.pricingModel,
    sourceUrl: parsed.data.sourceUrl,
    status: row.status === "approved" ? "public" : row.status,
    updatedAt: now,
  }).where(eq(products.id, row.id));
  await db.insert(productEvents).values({
    id: randomUUID(),
    productId: row.id,
    actorUserId: user.id,
    eventType: "product_edited",
    metadataJson: JSON.stringify({ reviewRequired: row.status === "approved" }),
    occurredAt: now,
  });

  revalidatePath(`/${row.slug}`);
  revalidatePath(`/dashboard/products/${row.slug}`);
  revalidatePath("/dashboard");
  revalidatePath("/today");
  revalidatePath("/compare");
  return { message: row.status === "approved" ? "Changes saved and returned to review." : "Changes saved." };
}
