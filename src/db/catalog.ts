import { and, asc, count, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import { products, productCatalogTerms as terms } from "@/db/schema";
import { hydrateDiscoveryRows } from "@/db/products";
import { catalogPageSizes, ftsQuery, pageWindow, termKey, type CatalogFilters, type CatalogQuery, type CatalogTerm, type TaxonomyKind } from "@/lib/catalog";

type Database = NonNullable<ReturnType<typeof getDb>>;
const visible = inArray(products.status, ["public", "approved"]);
const indexable = sql<number>`sum(case when ${products.status} = 'approved' and ${products.verificationStatus} != 'unverified' and substr(${products.id}, 1, 5) not in ('demo_', 'prod_') then 1 else 0 end)`.mapWith(Number);
// Keep the outer table qualification literal: single-table SELECT mapping can strip column qualifiers.
const votes = sql<number>`(select count(*) from product_votes where product_votes.product_id = products.id)`.mapWith(Number);

/** Every query rechecks publication state, even though triggers also remove hidden index entries. */
export function catalogWhere(filters: CatalogFilters): SQL {
  const predicates: SQL[] = [visible!];
  const match = ftsQuery(filters.q ?? "");
  if (filters.q?.trim()) predicates.push(match ? sql`${products}.rowid in (select rowid from product_search where product_search match ${match})` : sql`0`);
  for (const [kind, value] of [["category", filters.category], ["tag", filters.tag], ["platform", filters.platform]]) {
    if (value) predicates.push(sql`${products.id} in (select t.product_id from product_catalog_terms t where t.kind = ${kind} and t.key = ${termKey(value)})`);
  }
  if (filters.stage) predicates.push(eq(products.stage, filters.stage));
  if (filters.license) predicates.push(sql`${products.licenseType} = ${filters.license}`);
  if (filters.pricing) predicates.push(sql`${products.pricingModel} = ${filters.pricing}`);
  if (filters.verified === "true") predicates.push(sql`${products.verificationStatus} != 'unverified'`);
  return and(...predicates)!;
}

export function createCatalogStore(db: Database) {
  const termSelection = { key: terms.key, label: sql<string>`min(${terms.label})`, count: count(), indexableCount: indexable };
  return {
    async search(query: CatalogQuery, viewerId?: string) {
      query = { ...query, size: catalogPageSizes.some((size) => size === query.size) ? query.size : 12 };
      const [matches, catalog] = await Promise.all([
        db.select({ value: count() }).from(products).where(catalogWhere(query.filters)),
        db.select({ value: count() }).from(products).where(visible),
      ]);
      const total = matches[0].value;
      const window = pageWindow(total, query.page, query.size);
      const order = query.filters.sort === "name" ? [asc(products.name), asc(products.id)]
        : query.filters.sort === "newest" ? [desc(products.createdAt), asc(products.id)]
        : [desc(votes), desc(products.createdAt), asc(products.id)];
      const rows = await db.select({ product: products, upvotes: votes }).from(products)
        .where(catalogWhere(query.filters)).orderBy(...order).limit(query.size).offset(window.offset);
      return { ...query, ...window, products: await hydrateDiscoveryRows(db, rows, viewerId), total, catalogTotal: catalog[0].value, source: "database" as const };
    },
    async directory(kind: TaxonomyKind, requestedPage = 1, size = 48) {
      const scope = and(visible, eq(terms.kind, kind));
      const [totalRow] = await db.select({ value: sql<number>`count(distinct ${terms.key})`.mapWith(Number) }).from(terms).innerJoin(products, eq(products.id, terms.productId)).where(scope);
      const window = pageWindow(totalRow.value, requestedPage, size);
      const items: CatalogTerm[] = await db.select(termSelection).from(terms).innerJoin(products, eq(products.id, terms.productId)).where(scope)
        .groupBy(terms.key).orderBy(asc(terms.key)).limit(size).offset(window.offset);
      return { ...window, items, total: totalRow.value, source: "database" as const };
    },
    async term(kind: TaxonomyKind, key: string) {
      const [item] = await db.select(termSelection).from(terms).innerJoin(products, eq(products.id, terms.productId))
        .where(and(visible, eq(terms.kind, kind), eq(terms.key, termKey(key)))).groupBy(terms.key).limit(1);
      return item ?? null;
    },
    async sitemapTerms() {
      return db.select({ kind: terms.kind, key: terms.key }).from(terms).innerJoin(products, eq(products.id, terms.productId))
        .where(and(visible, inArray(terms.kind, ["category", "tag"]))).groupBy(terms.kind, terms.key)
        .having(sql`${indexable} > 0`).orderBy(asc(terms.kind), asc(terms.key)).limit(10000);
    },
    async facets() {
      const [categories, stages] = await Promise.all([
        db.select({ key: terms.key, label: sql<string>`min(${terms.label})` }).from(terms).innerJoin(products, eq(products.id, terms.productId))
          .where(and(visible, eq(terms.kind, "category"))).groupBy(terms.key).orderBy(asc(terms.key)).limit(100),
        db.selectDistinct({ label: products.stage }).from(products).where(visible).orderBy(asc(products.stage)).limit(100),
      ]);
      return { categories, stages: stages.map((stage) => stage.label) };
    },
  };
}
