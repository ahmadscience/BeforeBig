import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProductCard } from "@/components/product-card";
import { CatalogPagination } from "@/components/catalog-pagination";
import { AnalyticsBeacon } from "@/components/analytics-beacon";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { platforms } from "@/lib/catalog-metadata";
import { catalogHref, catalogPageSizes, parseCatalogQuery, termKey, type QueryParams, type TaxonomyKind } from "@/lib/catalog";
import { catalogFacets, searchCatalog } from "@/lib/catalog-data";

export async function CatalogResults({ params, path = "/today", scope }: { params: QueryParams; path?: string; scope?: { kind: TaxonomyKind; key: string; label: string } }) {
  const query = parseCatalogQuery(params);
  if (scope) query.filters[scope.kind === "category" ? "category" : "tag"] = scope.key;
  const user = await getCurrentUser();
  const data = await searchCatalog(query, user?.id);
  if (query.page !== data.page) redirect(catalogHref(path, data, data.page) as Route);
  const facets = await catalogFacets();
  const filters = data.filters;
  const selectedCategory = termKey(filters.category ?? "");
  const categories = [...facets.categories];
  if (selectedCategory && !categories.some((category) => category.key === selectedCategory)) categories.unshift({ key: selectedCategory, label: filters.category! });
  const stages = [...new Set([...facets.stages, ...(filters.stage ? [filters.stage] : [])])];
  const first = data.total ? (data.page - 1) * data.size + 1 : 0;
  const last = Math.min(data.page * data.size, data.total);
  const returnTo = catalogHref(path, data, data.page);
  return <section className="shell page-section today-page">
    <AnalyticsBeacon eventType="page_view" surfaceType={scope ? "taxonomy" : "today"} />
    <header className="today-header"><div>
      <p className="page-kicker">{scope ? (scope.kind === "category" ? "Category" : "Tag") : data.source === "database" ? "Product catalog" : "Sample catalog"}</p>
      <h1>{scope ? scope.label : "Find your next useful tool"}</h1>
      <p>{scope ? "Explore products in this " + scope.kind + ", then narrow the shortlist." : "Search by what products do. Browse categories, follow tags, and compare the evidence."}</p>
    </div><div className="today-summary" aria-label="Catalog summary"><div><strong>{data.catalogTotal}</strong><span>in catalog</span></div><div><strong>{data.total}</strong><span>matching</span></div><div><strong>{data.page} / {data.pages}</strong><span>page</span></div></div></header>
    <nav className="catalog-browse" aria-label="Browse the catalog"><Link href="/today">All products</Link><Link href="/categories">Categories →</Link><Link href="/tags">Tags →</Link><Link href="/demo/catalog">Try the catalog demo →</Link></nav>
    {data.source !== "database" ? <p className="catalog-notice" role="status">{data.source === "fallback" ? "The database is unavailable. Showing clearly labeled sample records; these are not live search results." : "Sample catalog · fictional product records and counters."}</p> : null}
    <form className="catalog-search" action={path} method="get" role="search">
      <label className="catalog-query">Search products<input type="search" name="q" defaultValue={filters.q} placeholder="Name, purpose, or tag" maxLength={200} /></label>
      {scope?.kind !== "category" ? <label>Category<select name="category" defaultValue={selectedCategory}><option value="">All categories</option>{categories.map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}</select></label> : null}
      {filters.tag && scope?.kind !== "tag" ? <input type="hidden" name="tag" value={filters.tag} /> : null}
      <label>Stage<select name="stage" defaultValue={filters.stage ?? ""}><option value="">All stages</option>{stages.map((stage) => <option key={stage}>{stage}</option>)}</select></label>
      <label>Platform<select name="platform" defaultValue={filters.platform ?? ""}><option value="">All platforms</option>{platforms.map((platform) => <option key={platform}>{platform}</option>)}</select></label>
      <label>License<select name="license" defaultValue={filters.license ?? ""}><option value="">All licenses</option><option value="open-source">Open source</option><option value="proprietary">Proprietary</option><option value="unknown">Unknown</option></select></label>
      <label>Pricing<select name="pricing" defaultValue={filters.pricing ?? ""}><option value="">All pricing</option><option value="free">Free</option><option value="freemium">Freemium</option><option value="paid">Paid</option><option value="unknown">Unknown</option></select></label>
      <label>Sort by<select name="sort" defaultValue={filters.sort ?? ""}><option value="">Recommended</option><option value="votes">Most upvoted</option><option value="newest">Newest</option><option value="name">Name A–Z</option></select></label>
      <label>Per page<select name="size" defaultValue={String(data.size)}>{catalogPageSizes.map((size) => <option key={size}>{size}</option>)}</select></label>
      <label className="catalog-checkbox"><input type="checkbox" name="verified" value="true" defaultChecked={filters.verified === "true"} /> Verified only</label><Button type="submit">Search</Button>
    </form>
    <div className="discovery-toolbar"><p role="status">{first}–{last} of {data.total} matching products{filters.tag && !scope ? " · Tag: " + filters.tag : ""}</p><Link href={path as Route} className="text-link">Reset filters</Link></div>
    <div className="today-layout"><div>
      <div className="today-feed"><div className="feed-toolbar"><span>Rank</span><span>Product</span><span>Traffic</span><span>Votes</span><span>Open</span></div>
        {data.products.map((product, index) => <ProductCard key={product.id} product={product} index={first + index} compact returnTo={returnTo} headingLevel="h2" />)}
        {!data.products.length ? <div className="catalog-empty"><h2>No products match these filters</h2><p>Try a broader search or choose another category.</p><Link href={path as Route} className="text-link">Clear filters →</Link></div> : null}
      </div>
      <CatalogPagination page={data.page} pages={data.pages} href={(page) => catalogHref(path, data, page)} />
    </div><aside className="today-sidebar"><div className="today-side-card"><p className="eyebrow">Reading the records</p><h2>Follow a useful trail</h2><p>Categories group products by their main purpose. Tags connect shared features, audiences, and workflows.</p><p>Search matches all your words as word prefixes. Ownership verification proves domain control, not product quality.</p></div><div className="today-side-card"><p className="eyebrow">Building something?</p><h2>Start a product record</h2><p>No paid placement.</p><Link href="/submit" className="button button-primary">Submit your product →</Link></div></aside></div>
  </section>;
}
