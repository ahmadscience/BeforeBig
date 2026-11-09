import type { Product } from "@/lib/types";

export type DiscoveryFilters = { q?: string; category?: string; stage?: string; sort?: string; verified?: string; platform?: string; license?: string; pricing?: string };

/** Search only public catalog fields; sorting never mutates the repository result. */
export function filterProducts(products: Product[], filters: DiscoveryFilters) {
  const terms = (filters.q ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  const result = products.filter((product) => {
    const text = [product.name, product.tagline, product.description, product.category, ...product.tags].join(" ").toLowerCase();
    return terms.every((term) => text.includes(term))
      && (!filters.category || product.category === filters.category)
      && (!filters.platform || Boolean(product.platforms?.includes(filters.platform)))
      && (!filters.license || (product.licenseType ?? "unknown") === filters.license)
      && (!filters.pricing || (product.pricingModel ?? "unknown") === filters.pricing)
      && (!filters.stage || product.stage === filters.stage)
      && (filters.verified !== "true" || product.verificationStatus !== "unverified");
  });
  return result.sort((a, b) => {
    if (filters.sort === "name") return a.name.localeCompare(b.name);
    if (filters.sort === "newest") return b.launchedAt.localeCompare(a.launchedAt) || a.slug.localeCompare(b.slug);
    if (filters.sort === "votes") return b.stats.upvotes - a.stats.upvotes || a.slug.localeCompare(b.slug);
    return 0; // Preserve the repository's live-first ordering by default.
  });
}

/** Category/tag overlap is a suggestion, never a community-endorsed replacement. */
export function relatedProducts(product: Product, catalog: Product[], limit = 3) {
  const score = (candidate: Product) => Number(candidate.category === product.category) * 3
    + candidate.tags.filter((tag) => product.tags.some((own) => own.toLowerCase() === tag.toLowerCase())).length;
  return catalog.filter((candidate) => candidate.slug !== product.slug && score(candidate) > 0)
    .sort((a, b) => score(b) - score(a) || a.slug.localeCompare(b.slug)).slice(0, limit);
}
