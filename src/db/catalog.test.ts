import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { catalogWhere, createCatalogStore } from "@/db/catalog";
import { parseCatalogQuery, taxonomyPath } from "@/lib/catalog";

let directory: string;
let client: ReturnType<typeof createClient>;
let db: ReturnType<typeof drizzle<typeof schema>>;
let store: ReturnType<typeof createCatalogStore>;
const query = (values: Record<string, string> = {}) => parseCatalogQuery(values);
const row = (id: string, overrides: Partial<typeof schema.products.$inferInsert> = {}) => ({ id, slug: id, name: "Tool " + id, websiteUrl: "https://" + id + ".example", normalizedDomain: id + ".example", tagline: "Release planning for teams", description: "Coordinate development and release checklists.", category: "Developer tools", tagsJson: '["Planning","Teams","Teams"]', platformsJson: '["Web"]', status: "approved" as const, verificationStatus: "domain_verified" as const, createdAt: new Date(1000), updatedAt: new Date(1000), ...overrides });

beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), "beforebig-catalog-"));
  client = createClient({ url: "file:" + join(directory, "test.db") }); db = drizzle(client, { schema });
  const migrations = readdirSync("drizzle").filter((name) => name.endsWith(".sql")).sort();
  // Insert old records before the new migration to exercise its backfill, not just its triggers.
  const searchIndex = migrations.indexOf("0009_catalog_search.sql");
  for (const migration of migrations.slice(0, searchIndex)) await client.executeMultiple(readFileSync("drizzle/" + migration, "utf8"));
  await db.insert(schema.products).values(row("existing"));
  for (const migration of migrations.slice(searchIndex)) await client.executeMultiple(readFileSync("drizzle/" + migration, "utf8"));
  store = createCatalogStore(db);
});
afterEach(() => { client.close(); rmSync(directory, { recursive: true, force: true }); });

describe("indexed catalog", () => {
  it("backfills existing records and searches all words as literal prefixes", async () => {
    expect((await store.search(query({ q: "RELE plan" }))).total).toBe(1);
    expect((await store.search(query({ q: "rele unknown" }))).total).toBe(0);
    expect((await store.search(query({ q: '" OR * - % (' }))).total).toBe(0);
    expect((await store.search(query({ q: "!!!" }))).total).toBe(0);
    expect((await store.search(query({ q: "   " }))).total).toBe(1);
    await db.insert(schema.products).values(row("accented", { name: "Café planner" }));
    expect((await store.search(query({ q: "cafe" }))).products[0].slug).toBe("accented");
  });
  it("paginates beyond the old 24-record limit with stable ties and exact totals", async () => {
    await db.insert(schema.products).values(Array.from({ length: 35 }, (_, index) => row("tool-" + String(index).padStart(2, "0"))));
    const all: string[] = [];
    for (const page of [1, 2, 3]) {
      const result = await store.search(query({ page: String(page) }));
      expect(result.total).toBe(36); expect(result.products).toHaveLength(12);
      all.push(...result.products.map((product) => product.id));
    }
    expect(new Set(all).size).toBe(36);
    expect(all).toEqual([...all].sort());
    await db.update(schema.products).set({ name: "Unique Needle" }).where(eq(schema.products.id, "tool-34"));
    expect((await store.search(query({ q: "needle" }))).products[0].id).toBe("tool-34");
    expect((await store.search(query({ page: "99999" }))).page).toBe(3);
    expect((await store.search(query({ q: "unmatched", page: "99999" }))).page).toBe(1);
  });
  it("combines exact indexed category/tag/platform filters with metadata filters", async () => {
    await db.update(schema.products).set({ licenseType: "open-source", pricingModel: "free", stage: "Live" }).where(eq(schema.products.id, "existing"));
    const filters = { q: "planning", category: "DEVELOPER TOOLS", tag: "teams", platform: "web", license: "open-source", pricing: "free", stage: "Live", verified: "true" };
    expect((await store.search(query(filters))).total).toBe(1);
    expect((await store.search(query({ ...filters, tag: "team" }))).total).toBe(0);
    expect((await store.search(query({ ...filters, pricing: "paid" }))).total).toBe(0);
    expect((await store.directory("tag")).items.find((term) => term.key === "teams")?.count).toBe(1);
  });
  it("keeps indexes current after edits, moderation, deletes, and malformed JSON", async () => {
    await db.update(schema.products).set({ category: "Finance", tagsJson: '["Invoicing"]', name: "Freshword" }).where(eq(schema.products.id, "existing"));
    expect((await store.search(query({ q: "freshw", tag: "invoicing" }))).total).toBe(1);
    expect(await store.term("tag", "Teams")).toBeNull();
    expect(await store.term("category", "Finance")).not.toBeNull();
    await db.update(schema.products).set({ status: "suspended" }).where(eq(schema.products.id, "existing"));
    expect((await store.search(query({ q: "freshw" }))).total).toBe(0);
    expect((await store.directory("category")).items).toEqual([]);
    expect((await client.execute("SELECT count(*) n FROM product_search")).rows[0].n).toBe(0);
    await db.update(schema.products).set({ status: "public", tagsJson: '{invalid', platformsJson: '{}' }).where(eq(schema.products.id, "existing"));
    expect((await store.search(query())).total).toBe(1);
    expect((await store.directory("tag")).items).toEqual([]);
    await db.delete(schema.products).where(eq(schema.products.id, "existing"));
    expect((await client.execute("SELECT count(*) n FROM product_search")).rows[0].n).toBe(0);
  });
  it("never indexes or exposes hidden records through results, facets, counts, or taxonomy", async () => {
    for (const status of ["draft", "suspended", "discontinued"] as const) await db.insert(schema.products).values(row(status, { status, category: "PrivateCategory", tagsJson: '["PrivateTag"]', name: "Secretword" }));
    expect((await store.search(query({ q: "secretword" }))).total).toBe(0);
    expect(await store.term("tag", "PrivateTag")).toBeNull();
    expect((await store.facets()).categories.map((term) => term.label)).not.toContain("PrivateCategory");
    expect((await store.search(query())).catalogTotal).toBe(1);
    expect((await client.execute("SELECT count(*) n FROM product_search")).rows[0].n).toBe(1);
  });
  it("preserves punctuation and Unicode taxonomy identities and paginates directories", async () => {
    await db.insert(schema.products).values([row("cpp", { tagsJson: '["C++"]' }), row("csharp", { tagsJson: '["C#"]' }), row("unicode", { category: "設計", tagsJson: '["Café"]' }), row("demo_sample", { tagsJson: '["Sampleonly"]' })]);
    expect((await store.term("tag", "C++"))?.count).toBe(1);
    expect((await store.term("tag", "C#"))?.count).toBe(1);
    expect(taxonomyPath("tag", "C++")).not.toBe(taxonomyPath("tag", "C#"));
    expect((await store.term("category", "設計"))?.count).toBe(1);
    expect((await store.term("tag", "Sampleonly"))?.indexableCount).toBe(0);
    expect((await store.sitemapTerms()).some((term) => term.key === "sampleonly")).toBe(false);
    expect((await store.sitemapTerms()).some((term) => term.key === "teams")).toBe(true);
    const first = await store.directory("tag", 1, 2); const second = await store.directory("tag", 2, 2);
    expect(first.items).toHaveLength(2); expect(second.items).toHaveLength(2);
    expect(new Set([...first.items, ...second.items].map((term) => term.key)).size).toBe(4);
  });
  it("hydrates only the selected page's real votes and viewer state", async () => {
    await db.insert(schema.users).values({ id: "viewer", email: "viewer@example.test", createdAt: new Date() });
    await db.insert(schema.productVotes).values({ id: "vote", productId: "existing", userId: "viewer", createdAt: new Date() });
    const result = await store.search(query(), "viewer");
    expect(result.products[0]).toMatchObject({ viewerHasVoted: true, source: "database", stats: { upvotes: 1 } });
  });
  it("uses the FTS virtual index and indexed taxonomy lookups", async () => {
    const fulltext = await db.all<{ detail: string }>(sql`EXPLAIN QUERY PLAN SELECT id FROM products WHERE ${catalogWhere({ q: "release" })}`);
    expect(fulltext.some((row) => /VIRTUAL TABLE INDEX/.test(row.detail))).toBe(true);
    const taxonomy = await db.all<{ detail: string }>(sql`EXPLAIN QUERY PLAN SELECT id FROM products WHERE ${catalogWhere({ tag: "teams" })}`);
    expect(taxonomy.some((row) => /product_catalog_terms.*(INDEX|idx|unique)/i.test(row.detail))).toBe(true);
  });
});
