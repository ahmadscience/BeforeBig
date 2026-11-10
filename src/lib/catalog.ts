import type { Product } from "@/lib/types";
import type { DiscoveryFilters } from "@/lib/discovery";

export const catalogPageSize = 12;
export const catalogPageSizes = [4, 12, 24, 48] as const;
export type CatalogFilters = DiscoveryFilters & { tag?: string };
export type QueryParams = Record<string, string | string[] | undefined>;
export type TaxonomyKind = "category" | "tag";
export type CatalogTerm = { key: string; label: string; count: number; indexableCount: number };
export type CatalogQuery = { filters: CatalogFilters; page: number; size: number };
export type CatalogPage = CatalogQuery & { products: Product[]; total: number; catalogTotal: number; pages: number; source: "database" | "sample" | "fallback" };

// Matches SQLite lower(trim(...)): do not collapse punctuation, accents, or distinct labels.
export function termKey(label: string) { return label.replace(/^ +| +$/g, "").replace(/[A-Z]/g, (letter) => letter.toLowerCase()); }
/** Next passes encoded segment values here; decode exactly once to preserve literal percent labels. */
export function decodeTaxonomyParam(segment: string) {
  try { return decodeURIComponent(segment); } catch { return null; }
}
export function taxonomyPath(kind: TaxonomyKind, label: string) { return (kind === "category" ? "/categories/" : "/tags/") + encodeURIComponent(termKey(label)); }
export function positivePage(value: string | undefined) { return value && /^[1-9]\d{0,8}$/.test(value) ? Number(value) : 1; }
export function searchTokens(input: string) { return (input.slice(0, 200).match(/[\p{L}\p{N}]+/gu) ?? []); }
/** Users supply text, never FTS operators. Each token is a literal word prefix joined by AND. */
export function ftsQuery(input: string) { return searchTokens(input).map((word) => '"' + word + '"*').join(" AND "); }

export function parseCatalogQuery(params: QueryParams): CatalogQuery {
  const first = (key: string) => { const value = params[key]; return (Array.isArray(value) ? value[0] : value)?.trim(); };
  const filters: CatalogFilters = {};
  for (const key of ["q", "category", "tag", "stage", "sort", "verified", "platform", "license", "pricing"] as const) {
    const value = first(key)?.slice(0, key === "q" ? 200 : 100);
    if (value) filters[key] = value;
  }
  if (filters.sort && !["votes", "newest", "name"].includes(filters.sort)) delete filters.sort;
  if (filters.verified !== "true") delete filters.verified;
  const size = Number(first("size"));
  return { filters, page: positivePage(first("page")), size: catalogPageSizes.some((allowed) => allowed === size) ? size : catalogPageSize };
}
export function pageWindow(total: number, requestedPage: number, size: number) {
  const pages = Math.max(1, Math.ceil(total / size));
  const page = Math.min(Math.max(1, Math.trunc(requestedPage) || 1), pages);
  return { page, pages, offset: (page - 1) * size };
}
export function catalogHref(path: string, query: CatalogQuery, page = 1) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query.filters)) if (value) params.set(key, value);
  if (path.startsWith("/categories/")) params.delete("category");
  if (path.startsWith("/tags/")) params.delete("tag");
  if (query.size !== catalogPageSize) params.set("size", String(query.size));
  if (page > 1) params.set("page", String(page));
  return path + (params.size ? "?" + params.toString() : "");
}
function normalizedWord(word: string) { return word.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase(); }
export function filterSampleCatalog(products: Product[], filters: CatalogFilters) {
  const terms = searchTokens(filters.q ?? "").map(normalizedWord);
  return products.filter((product) => {
    if (!["public", "approved"].includes(product.status)) return false;
    const words = searchTokensForDocument([product.name, product.tagline, product.description, product.category, ...product.tags].join(" "));
    return (!filters.q?.trim() || (terms.length > 0 && terms.every((term) => words.some((word) => word.startsWith(term)))))
      && (!filters.category || termKey(product.category) === termKey(filters.category))
      && (!filters.tag || product.tags.some((tag) => termKey(tag) === termKey(filters.tag!)))
      && (!filters.platform || product.platforms?.some((platform) => termKey(platform) === termKey(filters.platform!)))
      && (!filters.stage || product.stage === filters.stage)
      && (!filters.license || (product.licenseType ?? "unknown") === filters.license)
      && (!filters.pricing || (product.pricingModel ?? "unknown") === filters.pricing)
      && (filters.verified !== "true" || product.verificationStatus !== "unverified");
  }).sort((a, b) => {
    if (filters.sort === "name") return a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id);
    if (filters.sort === "newest") return b.launchedAt.localeCompare(a.launchedAt) || a.id.localeCompare(b.id);
    return b.stats.upvotes - a.stats.upvotes || b.launchedAt.localeCompare(a.launchedAt) || a.id.localeCompare(b.id);
  });
}
function searchTokensForDocument(text: string) { return (text.match(/[\p{L}\p{N}]+/gu) ?? []).map(normalizedWord); }
export function sampleCatalogPage(products: Product[], query: CatalogQuery, source: "sample" | "fallback" = "sample"): CatalogPage {
  const matches = filterSampleCatalog(products, query.filters);
  const window = pageWindow(matches.length, query.page, query.size);
  return { ...query, ...window, products: matches.slice(window.offset, window.offset + query.size), total: matches.length, catalogTotal: products.filter((product) => ["public", "approved"].includes(product.status)).length, source };
}
export function sampleTerms(products: Product[], kind: TaxonomyKind): CatalogTerm[] {
  const terms = new Map<string, CatalogTerm>();
  for (const product of products.filter((item) => ["public", "approved"].includes(item.status))) {
    for (const [key, label] of new Map((kind === "category" ? [product.category] : product.tags).map((label) => [termKey(label), label]))) {
      if (!key) continue;
      const value = terms.get(key) ?? { key, label, count: 0, indexableCount: 0 };
      value.count += 1; terms.set(key, value);
    }
  }
  return [...terms.values()].sort((a, b) => a.label.localeCompare(b.label, "en"));
}
