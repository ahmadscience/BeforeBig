import type { Metadata } from "next";
import { catalogHref, parseCatalogQuery, taxonomyPath, type QueryParams, type TaxonomyKind } from "@/lib/catalog";
import { catalogTerm } from "@/lib/catalog-data";

export async function taxonomyMetadata(kind: TaxonomyKind, key: string, params: QueryParams): Promise<Metadata> {
  const { item } = await catalogTerm(kind, key);
  if (!item) return { title: "Catalog", robots: { index: false, follow: true } };
  const query = parseCatalogQuery(params); const scopeKey = kind === "category" ? "category" : "tag";
  query.filters[scopeKey] = item.key;
  const filtered = Object.entries(query.filters).some(([name, value]) => name !== scopeKey && Boolean(value));
  return { title: item.label + (kind === "category" ? " products" : " tag"), description: "Explore " + item.label + " products, compare their fit, and discover related tools.",
    alternates: { canonical: catalogHref(taxonomyPath(kind, item.key), query, query.page) },
    robots: { index: item.indexableCount > 0 && !filtered && query.size === 12, follow: true } };
}
