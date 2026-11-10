import { getDb } from "@/db/client";
import { createCatalogStore } from "@/db/catalog";
import { demoProducts } from "@/data/products";
import { pageWindow, sampleCatalogPage, sampleTerms, termKey, type CatalogQuery, type TaxonomyKind } from "@/lib/catalog";

export async function searchCatalog(query: CatalogQuery, viewerId?: string) {
  const db = getDb();
  if (!db) return sampleCatalogPage(demoProducts, query);
  try { return await createCatalogStore(db).search(query, viewerId); }
  catch { return sampleCatalogPage(demoProducts, query, "fallback"); }
}
export async function catalogDirectory(kind: TaxonomyKind, page = 1, size = 48) {
  const db = getDb();
  if (db) {
    try { return await createCatalogStore(db).directory(kind, page, size); } catch { /* Explicit sample fallback, never a silent zero. */ }
  }
  const items = sampleTerms(demoProducts, kind); const window = pageWindow(items.length, page, size);
  return { ...window, items: items.slice(window.offset, window.offset + size), total: items.length, source: db ? "fallback" as const : "sample" as const };
}
export async function catalogTerm(kind: TaxonomyKind, key: string) {
  const db = getDb();
  if (db) {
    try { return { item: await createCatalogStore(db).term(kind, key), source: "database" as const }; } catch { /* Surface the outage to callers. */ }
  }
  return { item: sampleTerms(demoProducts, kind).find((item) => item.key === termKey(key)) ?? null, source: db ? "fallback" as const : "sample" as const };
}
export async function catalogFacets() {
  const db = getDb();
  if (db) { try { return await createCatalogStore(db).facets(); } catch { /* Match offline controls to the offline catalog. */ } }
  return { categories: sampleTerms(demoProducts, "category"), stages: [...new Set(demoProducts.map((product) => product.stage))].sort() };
}
