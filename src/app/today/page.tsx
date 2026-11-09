import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { listDiscoveryProducts } from "@/lib/products";
import { AnalyticsBeacon } from "@/components/analytics-beacon";
import { platforms } from "@/lib/catalog-metadata";
import { filterProducts, type DiscoveryFilters } from "@/lib/discovery";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Discover products" };

export default async function TodayPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  // Repeated query parameters use the first value, matching the visible form.
  const filters: DiscoveryFilters = Object.fromEntries(
    ["q", "category", "stage", "sort", "verified", "platform", "license", "pricing"].map((key) => [key, Array.isArray(query[key]) ? query[key][0] : query[key]]),
  );
  const user = await getCurrentUser();
  const discoveryProducts = await listDiscoveryProducts(user?.id);
  const results = filterProducts(discoveryProducts, filters);
  const categories = [...new Set(discoveryProducts.map((product) => product.category))].sort();
  const stages = [...new Set(discoveryProducts.map((product) => product.stage))].sort();
  const returnTo = `/today?${new URLSearchParams(Object.entries(filters).filter((entry): entry is [string, string] => typeof entry[1] === "string")).toString()}`;
  const liveCount = discoveryProducts.filter((product) => product.source !== "sample" && !product.id.startsWith("prod_") && !product.id.startsWith("demo_")).length;
  const demoCount = discoveryProducts.filter((product) => product.source !== "sample" && product.id.startsWith("demo_")).length;
  return (
    <section className="shell page-section today-page">
      <AnalyticsBeacon eventType="page_view" surfaceType="today" />
      <header className="today-header">
        <div>
          <p className="page-kicker">{liveCount ? "Live records + demos" : demoCount ? "Turso-backed demo edition" : "Sample catalog"}</p>
          <h1>Find your next useful tool</h1>
          <p>Search early products by what they do. Compare fit, price, and the evidence behind each record.</p>
        </div>
        <div className="today-summary" aria-label="Today summary">
          <div><strong>{discoveryProducts.length}</strong><span>products</span></div>
          <div><strong>{discoveryProducts.filter((product) => product.verificationStatus !== "unverified").length}</strong><span>verified</span></div>
          <div><strong>{discoveryProducts.reduce((sum, product) => sum + product.stats.upvotes, 0).toLocaleString()}</strong><span>upvotes</span></div>
        </div>
      </header>

      <form className="catalog-search" action="/today" method="get" role="search">
        <label className="catalog-query">Search products
          <input type="search" name="q" defaultValue={filters.q} placeholder="Name, purpose, or tag" maxLength={200} />
        </label>
        <label>Category<select name="category" defaultValue={filters.category ?? ""}><option value="">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
        <label>Stage<select name="stage" defaultValue={filters.stage ?? ""}><option value="">All stages</option>{stages.map((stage) => <option key={stage}>{stage}</option>)}</select></label>
        <label>Platform<select name="platform" defaultValue={filters.platform ?? ""}><option value="">All platforms</option>{platforms.map((platform) => <option key={platform}>{platform}</option>)}</select></label>
        <label>License<select name="license" defaultValue={filters.license ?? ""}><option value="">All licenses</option><option value="open-source">Open source</option><option value="proprietary">Proprietary</option><option value="unknown">Unknown</option></select></label>
        <label>Pricing<select name="pricing" defaultValue={filters.pricing ?? ""}><option value="">All pricing</option><option value="free">Free</option><option value="freemium">Freemium</option><option value="paid">Paid</option><option value="unknown">Unknown</option></select></label>
        <label>Sort by<select name="sort" defaultValue={filters.sort ?? ""}><option value="">Recommended</option><option value="votes">Most upvoted</option><option value="newest">Newest</option><option value="name">Name A–Z</option></select></label>
        <label className="catalog-checkbox"><input type="checkbox" name="verified" value="true" defaultChecked={filters.verified === "true"} /> Verified only</label>
        <Button type="submit">Search</Button>
      </form>
      <div className="discovery-toolbar">
        <p role="status">{results.length} of {discoveryProducts.length} products</p>
        <Link href="/today" className="text-link">Reset filters</Link>
      </div>

      <div className="today-layout">
        <div className="today-feed">
          <div className="feed-toolbar"><span>Rank</span><span>Product</span><span>Traffic</span><span>Votes</span><span>Open</span></div>
          {results.map((product, index) => <ProductCard key={product.id} product={product} index={index + 1} compact returnTo={returnTo} headingLevel="h2" />)}
          {!results.length ? <div className="catalog-empty"><h2>No products match these filters</h2><p>Try a broader search or choose another category.</p><Link href="/today" className="text-link">Show all products →</Link></div> : null}
        </div>
        <aside className="today-sidebar">
          <div className="today-side-card spotlight-card">
            <div className="spotlight-top"><p className="eyebrow">Reading the records</p><span>Field notes</span></div>
            <h2>What counts as early signal?</h2>
            <p>Attention matters more when it is transparent. We show product-page visitors, outbound clicks, ownership, and record history together.</p>
            <div className="signal-legend"><span><i className="legend-dot verified-dot" /> Verified</span><span><i className="legend-dot traffic-dot" /> Traffic</span><span><i className="legend-dot history-dot" /> History</span></div>
          </div>
          <div className="today-side-card builder-card">
            <p className="eyebrow">Building something?</p>
            <strong>Start your permanent product record.</strong>
            <p>Free during the demo. No paid placement.</p>
            <Link href="/submit" className="button button-primary">Submit your product →</Link>
          </div>
        </aside>
      </div>
    </section>
  );
}
