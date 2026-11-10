import { createHash, randomUUID } from "node:crypto";
import { and, count, desc, eq, inArray, ne, notLike, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import { analyticsEvents, productDownvotes, productEvents, productMemberships, products, productVotes, reviews } from "@/db/schema";
import type { Product } from "@/lib/types";
import type { draftFromUrl } from "@/lib/validation";

type ProductRow = typeof products.$inferSelect;
type DraftInput = ReturnType<typeof draftFromUrl>;

const accents: Product["accent"][] = ["mint", "coral", "gold", "blue"];

function accentForSlug(slug: string): Product["accent"] {
  const score = [...slug].reduce((total, character) => total + character.charCodeAt(0), 0);
  return accents[score % accents.length] ?? "blue";
}

export function rowToProduct(row: ProductRow, upvotes = 0, downvotes = 0): Product {
  let tags: string[] = [];
  try {
    const parsed = JSON.parse(row.tagsJson);
    if (Array.isArray(parsed)) tags = parsed.filter((tag): tag is string => typeof tag === "string").slice(0, 8);
  } catch {
    tags = [];
  }
  return {
    source: "database",
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    websiteUrl: row.websiteUrl,
    category: row.category,
    stage: row.stage,
    status: row.status,
    verificationStatus: row.verificationStatus,
    bestFor: row.bestFor,
    notBestFor: row.notBestFor,
    price: row.price,
    activeBacking: 0,
    lifetimeBacking: 0,
    launchedAt: row.createdAt.toISOString().slice(0, 10),
    platforms: (() => {
      try { const value: unknown = JSON.parse(row.platformsJson); return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
      catch { return []; }
    })(),
    licenseType: row.licenseType,
    pricingModel: row.pricingModel,
    sourceUrl: row.sourceUrl,
    tags: tags.length ? tags : [row.status === "draft" ? "Draft" : "Early", row.category],
    accent: accentForSlug(row.slug),
    stats: { upvotes, downvotes, views: 0, qualifiedVisits: 0, reviews: 0 },
  };
}

type ActivityCounts = {
  views?: number;
  qualifiedVisits?: number;
  reviews?: number;
};

function withActivityCounts(product: Product, activity: ActivityCounts): Product {
  return {
    ...product,
    stats: {
      ...product.stats,
      views: activity.views ?? 0,
      qualifiedVisits: activity.qualifiedVisits ?? 0,
      reviews: activity.reviews ?? 0,
    },
  };
}

function collisionSuffix(domain: string) {
  return createHash("sha256").update(domain).digest("hex").slice(0, 7);
}

export async function findPersistedProductBySlug(slug: string) {
  const db = getDb();
  if (!db) return undefined;
  const [result] = await db
    .select({ product: products, upvotes: count(productVotes.id) })
    .from(products)
    .leftJoin(productVotes, eq(products.id, productVotes.productId))
    .where(eq(products.slug, slug))
    .groupBy(products.id)
    .limit(1);
  if (!result) return undefined;
  const [downvoteRows, analyticsRows, reviewRows] = await Promise.all([
    db
      .select({ value: count() })
      .from(productDownvotes)
      .where(and(eq(productDownvotes.productId, result.product.id), eq(productDownvotes.status, "approved"))),
    db
      .select({ eventType: analyticsEvents.eventType, value: count() })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.entitySlug, result.product.slug), inArray(analyticsEvents.eventType, ["product_page_view", "product_outbound_click"])))
      .groupBy(analyticsEvents.eventType),
    db
      .select({ value: count() })
      .from(reviews)
      .where(and(eq(reviews.productId, result.product.id), eq(reviews.status, "published"))),
  ]);
  const activity = Object.fromEntries(analyticsRows.map((row) => [row.eventType, Number(row.value)]));
  return withActivityCounts(rowToProduct(result.product, Number(result.upvotes), Number(downvoteRows[0]?.value ?? 0)), {
    views: activity.product_page_view,
    qualifiedVisits: activity.product_outbound_click,
    reviews: Number(reviewRows[0]?.value ?? 0),
  });
}

export async function findPersistedProductRowBySlug(slug: string) {
  const db = getDb();
  if (!db) return undefined;
  const [row] = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
  return row;
}

export async function persistProductDraft(draft: DraftInput, actorUserId: string) {
  const db = getDb();
  if (!db) return null;

  const [existing] = await db.select().from(products).where(eq(products.normalizedDomain, draft.normalizedDomain)).limit(1);
  if (existing) return { product: rowToProduct(existing), created: false };

  const [slugOwner] = await db.select({ id: products.id }).from(products).where(eq(products.slug, draft.slug)).limit(1);
  const slug = slugOwner ? `${draft.slug}-${collisionSuffix(draft.normalizedDomain)}` : draft.slug;
  const now = new Date();

  try {
    const [created] = await db
      .insert(products)
      .values({
        id: randomUUID(),
        slug,
        name: draft.name,
        websiteUrl: draft.url,
        normalizedDomain: draft.normalizedDomain,
        tagline: draft.tagline,
        description: `${draft.name} is an early product record awaiting founder details and ownership verification.`,
        category: draft.category,
        stage: "Draft preview",
        bestFor: "Early adopters reviewing a product before its public launch.",
        notBestFor: "Anyone who needs a fully verified and reviewed product record.",
        price: "Not provided",
        tagsJson: JSON.stringify(["Draft", draft.category]),
        status: "draft",
        verificationStatus: "unverified",
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!created) throw new Error("The product draft was not created.");
    await db.insert(productMemberships).values({
      id: randomUUID(),
      productId: created.id,
      userId: actorUserId,
      role: "editor",
      createdAt: now,
    });
    await db.insert(productEvents).values({
      id: randomUUID(),
      productId: created.id,
      actorUserId,
      eventType: "draft_created",
      occurredAt: now,
    });
    return { product: rowToProduct(created), created: true };
  } catch (error) {
    const [concurrent] = await db.select().from(products).where(eq(products.normalizedDomain, draft.normalizedDomain)).limit(1);
    if (concurrent) return { product: rowToProduct(concurrent), created: false };
    throw error;
  }
}

export async function listProductsForUser(userId: string) {
  const db = getDb();
  if (!db) return [];
  return db
    .select({ product: products, membershipRole: productMemberships.role })
    .from(productMemberships)
    .innerJoin(products, eq(productMemberships.productId, products.id))
    .where(eq(productMemberships.userId, userId))
    .orderBy(desc(products.updatedAt));
}

export async function getProductMembership(productId: string, userId: string) {
  const db = getDb();
  if (!db) return null;
  const [membership] = await db
    .select()
    .from(productMemberships)
    .where(and(eq(productMemberships.productId, productId), eq(productMemberships.userId, userId)))
    .limit(1);
  return membership ?? null;
}

export async function listIndexableProducts() {
  const db = getDb();
  if (!db) return [];
  return db
    .select({ slug: products.slug, updatedAt: products.updatedAt })
    .from(products)
    .where(and(eq(products.status, "approved"), ne(products.verificationStatus, "unverified"), notLike(products.id, "demo_%")));
}

export async function listDiscoverablePersistedProducts(viewerUserId?: string) {
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select({ product: products, upvotes: count(productVotes.id) })
    .from(products)
    .leftJoin(productVotes, eq(products.id, productVotes.productId))
    .where(or(eq(products.status, "public"), eq(products.status, "approved")))
    .groupBy(products.id)
    .orderBy(desc(count(productVotes.id)), desc(products.createdAt))
    .limit(24);

  return hydrateDiscoveryRows(db, rows, viewerUserId);
}

/** Enrich only the selected page, never the entire catalog. */
export async function hydrateDiscoveryRows(
  db: NonNullable<ReturnType<typeof getDb>>,
  rows: { product: ProductRow; upvotes: number }[],
  viewerUserId?: string,
) {
  const productIds = rows.map((row) => row.product.id);
  const productSlugs = rows.map((row) => row.product.slug);
  const [downvoteRows, votedRows, downvotedRows, analyticsRows, reviewRows] = await Promise.all([
    productIds.length
      ? db
        .select({ productId: productDownvotes.productId, value: count() })
        .from(productDownvotes)
        .where(and(eq(productDownvotes.status, "approved"), inArray(productDownvotes.productId, productIds)))
        .groupBy(productDownvotes.productId)
      : Promise.resolve([]),
    viewerUserId && productIds.length
      ? db
        .select({ productId: productVotes.productId })
        .from(productVotes)
        .where(and(eq(productVotes.userId, viewerUserId), inArray(productVotes.productId, productIds)))
      : Promise.resolve([]),
    viewerUserId && productIds.length
      ? db
        .select({ productId: productDownvotes.productId, status: productDownvotes.status })
        .from(productDownvotes)
        .where(and(eq(productDownvotes.userId, viewerUserId), inArray(productDownvotes.status, ["pending", "approved"]), inArray(productDownvotes.productId, productIds)))
      : Promise.resolve([]),
    productSlugs.length
      ? db
        .select({ entitySlug: analyticsEvents.entitySlug, eventType: analyticsEvents.eventType, value: count() })
        .from(analyticsEvents)
        .where(and(inArray(analyticsEvents.entitySlug, productSlugs), inArray(analyticsEvents.eventType, ["product_page_view", "product_outbound_click"])))
        .groupBy(analyticsEvents.entitySlug, analyticsEvents.eventType)
      : Promise.resolve([]),
    productIds.length
      ? db
        .select({ productId: reviews.productId, value: count() })
        .from(reviews)
        .where(and(eq(reviews.status, "published"), inArray(reviews.productId, productIds)))
        .groupBy(reviews.productId)
      : Promise.resolve([]),
  ]);
  const votedIds = new Set(votedRows.map((row) => row.productId));
  const downvotedIds = new Set(downvotedRows.map((row) => row.productId));
  const downvoteStatuses = new Map(downvotedRows.map((row) => [
    row.productId,
    row.status === "pending" || row.status === "approved" ? row.status : undefined,
  ]));
  const downvoteCounts = new Map(downvoteRows.map((row) => [row.productId, Number(row.value)]));
  const reviewCounts = new Map(reviewRows.map((row) => [row.productId, Number(row.value)]));
  const activityCounts = new Map<string, ActivityCounts>();
  for (const row of analyticsRows) {
    if (!row.entitySlug) continue;
    const activity = activityCounts.get(row.entitySlug) ?? {};
    if (row.eventType === "product_page_view") activity.views = Number(row.value);
    if (row.eventType === "product_outbound_click") activity.qualifiedVisits = Number(row.value);
    activityCounts.set(row.entitySlug, activity);
  }

  return rows.map((row) => {
    const product = withActivityCounts(rowToProduct(row.product, Number(row.upvotes), downvoteCounts.get(row.product.id) ?? 0), {
      ...activityCounts.get(row.product.slug),
      reviews: reviewCounts.get(row.product.id) ?? 0,
    });
    return {
      ...product,
      viewerHasVoted: votedIds.has(row.product.id),
      viewerHasDownvoted: downvotedIds.has(row.product.id),
      viewerDownvoteStatus: downvoteStatuses.get(row.product.id),
    };
  });
}
