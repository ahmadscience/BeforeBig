import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { SubmitForm } from "@/components/submit-form";
import { listDiscoveryProducts } from "@/lib/products";
import { AnalyticsBeacon } from "@/components/analytics-beacon";
import { getCurrentUser } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const user = await getCurrentUser();
  const discoveryProducts = await listDiscoveryProducts(user?.id);
  const featuredProduct = discoveryProducts[0];
  const liveCount = discoveryProducts.filter((product) => product.source !== "sample" && !product.id.startsWith("prod_") && !product.id.startsWith("demo_")).length;
  const demoCount = discoveryProducts.filter((product) => product.source !== "sample" && product.id.startsWith("demo_")).length;
  const recordLabel = liveCount
    ? `${liveCount} live ${liveCount === 1 ? "record" : "records"}`
    : demoCount
      ? `${demoCount} Turso-backed demo ${demoCount === 1 ? "record" : "records"}`
      : discoveryProducts.length ? `${discoveryProducts.length} sample records` : "No public records yet";

  return (
    <>
      <AnalyticsBeacon eventType="page_view" surfaceType="home" />
      <section className="hero shell">
        <div className="hero-copy">
          <Badge className="hero-status" variant="outline">Community catalog · {recordLabel}</Badge>
          <h1>Find useful products <span>before they get big.</span></h1>
          <p className="hero-lede">A curated discovery feed for products still earning their reputation. Real traffic, clear ownership, no paid ranking.</p>
          <div className="hero-actions">
            <Button asChild size="sm"><Link href="/today">Explore products <span aria-hidden="true">→</span></Link></Button>
            <Button asChild size="sm" variant="ghost"><Link href="/submit">Submit a product</Link></Button>
          </div>
          <div className="hero-proof" aria-label="BeforeBig product signals">
            <div><strong>100%</strong><span>free demo</span></div>
            <div><strong>0</strong><span>paid placements</span></div>
            <div><strong>1</strong><span>permanent record</span></div>
          </div>
        </div>
        {featuredProduct ? <Link className={`hero-feature accent-${featuredProduct.accent}`} href={`/${featuredProduct.slug}`}>
          <div className="feature-topline"><span>Product to watch</span><span>Featured record</span></div>
          <div className="feature-product">
            <span className="product-icon" aria-hidden="true">{featuredProduct.name.slice(0, 1)}</span>
            <div><span className="feature-stage">{featuredProduct.stage}</span><h2>{featuredProduct.name}</h2></div>
          </div>
          <p>{featuredProduct.tagline}</p>
          <div className="feature-metrics">
            <div><strong>{featuredProduct.stats.views.toLocaleString()}</strong><span>visitors</span></div>
            <div><strong>{featuredProduct.stats.qualifiedVisits}</strong><span>product clicks</span></div>
            <div><strong>{featuredProduct.stats.upvotes.toLocaleString()}</strong><span>{featuredProduct.source === "sample" || featuredProduct.id.startsWith("prod_") ? "sample upvotes" : "upvotes"}</span></div>
          </div>
          <div className="feature-link">Open product record <span aria-hidden="true">↗</span></div>
        </Link> : <div className="hero-feature"><p className="eyebrow">A new field guide</p><h2>The catalog is ready for its first product</h2><p>Submit a product to start building a useful public record.</p><Link href="/submit" className="text-link">Create a product record →</Link></div>}
      </section>

      <section className="shell section-block home-shortlist">
        <div className="section-heading section-heading-row">
          <div><p className="eyebrow">The shortlist</p><h2>Products worth an early look</h2></div>
          <div className="section-heading-aside"><span>Explore the catalog</span><Link href="/today">See the full feed →</Link></div>
        </div>
        <div className="home-product-list">
          {discoveryProducts.slice(0, 8).map((product, index) => <ProductCard key={product.id} product={product} index={index + 1} compact returnTo="/" />)}
        </div>
      </section>

      <section className="shell value-section">
        <div className="value-intro"><p className="eyebrow">How BeforeBig works</p><h2>A product record that gets more useful over time.</h2><p>Discovery is only the start. Every product keeps one public history of ownership, attention, and progress.</p></div>
        <div className="value-steps">
          <div><span>01</span><strong>Find it early</strong><p>Browse a small, ranked feed instead of an endless directory.</p></div>
          <div><span>02</span><strong>See real signal</strong><p>Compare visitors, product clicks, verification, and product history.</p></div>
          <div><span>03</span><strong>Watch it grow</strong><p>Return to the same permanent record as evidence accumulates.</p></div>
        </div>
      </section>

      <section className="shell submit-section"><SubmitForm /></section>
    </>
  );
}
