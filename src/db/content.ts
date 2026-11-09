import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { productUpdates, products, reviews, users } from "@/db/schema";

export async function getPublicProductContent(slug: string) {
  const db = getDb();
  if (!db) return { updates: [], reviews: [] };
  const [product] = await db.select({ id: products.id }).from(products).where(eq(products.slug, slug)).limit(1);
  if (!product) return { updates: [], reviews: [] };
  const [updates, publishedReviews] = await Promise.all([
    db.select().from(productUpdates).where(and(eq(productUpdates.productId, product.id), eq(productUpdates.status, "published"))).orderBy(desc(productUpdates.createdAt)),
    db
      .select({ id: reviews.id, rating: reviews.rating, body: reviews.body, createdAt: reviews.createdAt, displayName: users.displayName })
      .from(reviews)
      .innerJoin(users, eq(reviews.authorUserId, users.id))
      .where(and(eq(reviews.productId, product.id), eq(reviews.status, "published")))
      .orderBy(desc(reviews.createdAt)),
  ]);
  return {
    updates,
    reviews: publishedReviews,
  };
}
