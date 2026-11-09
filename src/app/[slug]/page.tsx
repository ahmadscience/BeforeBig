import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { relatedProducts } from "@/lib/discovery";
import { findProductBySlug, listDiscoveryProducts } from "@/lib/products";
import { AnalyticsBeacon } from "@/components/analytics-beacon";
import { ProductAnalytics } from "@/components/product-analytics";
import { TrackedProductLink } from "@/components/tracked-link";
import { ReviewForm } from "@/components/review-form";
import { VoteButton } from "@/components/vote-button";
import { DownvoteButton } from "@/components/downvote-button";
import { getPublicProductContent } from "@/db/content";
import { getProductDownvoteState } from "@/db/downvotes";
import { getProductVoteState } from "@/db/votes";
import { getCurrentUser } from "@/lib/auth";

type ProductPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await findProductBySlug(slug);
  if (!product) return {};
  const noIndex = product.id.startsWith("prod_") || product.id.startsWith("demo_") || product.status !== "approved" || product.verificationStatus === "unverified";
  return {
    title: `${product.name}: ${product.tagline}`,
    description: product.description,
    alternates: { canonical: `/${product.slug}` },
    robots: noIndex ? { index: false, follow: true } : { index: true, follow: true },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await findProductBySlug(slug);
  if (!product) notFound();
  const related = relatedProducts(product, await listDiscoveryProducts());
  const isVerified = product.verificationStatus !== "unverified";
  const isFixture = product.source === "sample" || product.id.startsWith("prod_");
  const isDemo = !isFixture && product.id.startsWith("demo_");
  const isPersisted = !isFixture;
  const downvotesEnabled = true;
  const [content, user] = await Promise.all([getPublicProductContent(slug), isPersisted ? getCurrentUser() : Promise.resolve(null)]);
  const [voteState, downvoteState] = isPersisted
    ? await Promise.all([getProductVoteState(product.id, user?.id), getProductDownvoteState(product.id, user?.id)])
    : [
        { count: product.stats.upvotes, viewerHasVoted: false },
        { count: product.stats.downvotes, viewerHasDownvoted: false, viewerDownvoteStatus: undefined },
      ];
  return (
    <section className={`shell product-page accent-${product.accent}`}>
      <AnalyticsBeacon eventType="product_page_view" entitySlug={product.slug} surfaceType="product" />
      {isFixture ? <div className="noindex-banner"><span>●</span> Sample record · demo data · not indexed</div> : null}
      {isDemo ? <div className="noindex-banner"><span>●</span> Turso-backed demo · live counters · not indexed</div> : null}
      {isPersisted && !isVerified ? <div className="noindex-banner"><span>●</span> Preview record · public but not indexed until verified</div> : null}
      <div className="product-breadcrumb"><Link href="/today">Discover</Link><span>›</span><span>{product.category}</span><span>›</span><span>{product.name}</span></div>
      <header className="product-hero">
        <div className="product-identity">
          <div className="product-icon product-icon-large" aria-hidden="true">{product.name.slice(0, 1)}</div>
          <div className="product-title">
            <div className="tag-row"><span className="tag">{product.stage}</span><span className="tag">{product.category}</span></div>
            <h1>{product.name}</h1>
            <p>{product.tagline}</p>
          </div>
        </div>
        <div className="product-hero-actions">
          <div className="reaction-buttons reaction-buttons-large">
            <VoteButton slug={product.slug} count={voteState.count} hasVoted={voteState.viewerHasVoted} returnTo={`/${product.slug}`} sample={!isPersisted} size="large" />
            <DownvoteButton slug={product.slug} count={downvoteState.count} hasDownvoted={downvoteState.viewerHasDownvoted} downvoteStatus={downvoteState.viewerDownvoteStatus} returnTo={`/${product.slug}`} sample={!isPersisted} enabled={downvotesEnabled} size="large" />
          </div>
          {isVerified ? <span className="verified"><span>✓</span> {product.verificationStatus === "founder_verified" ? "Founder verified" : "Domain verified"}</span> : <span className="unverified">Unverified record</span>}
          {!isVerified && isPersisted ? <Link href={`/claim/${product.slug}` as Route} className="button button-ghost">Claim record</Link> : null}
          {isPersisted ? <TrackedProductLink href={`/go/${product.slug}`} className="button button-primary" target="_blank" rel="noreferrer" productSlug={product.slug}>Visit website <span aria-hidden="true">↗</span></TrackedProductLink> : null}
        </div>
      </header>
      <ProductAnalytics live={isPersisted} metrics={{ beforeBigVisitors: product.stats.views, beforeBigPageViews: product.stats.views, outboundClicks: product.stats.qualifiedVisits, googleAnalyticsVisitors: null, googleAnalyticsClicks: null }} />
      <div className="product-layout">
        <div className="product-main">
          <section className="product-overview">
            <p className="eyebrow">About the product</p>
            <p className="product-description">{product.description}</p>
          </section>
          <section className="fact-grid" aria-label="Product fit">
            <div><span>Best for</span><strong>{product.bestFor}</strong></div>
            <div><span>Not best for</span><strong>{product.notBestFor}</strong></div>
            <div><span>Starting price</span><strong>{product.price}</strong></div>
            <div><span>Platforms</span><strong>{product.platforms?.join(", ") || "Unknown"}</strong></div>
            <div><span>License / pricing model</span><strong>{product.licenseType ?? "unknown"} / {product.pricingModel ?? "unknown"}</strong></div>
            {product.sourceUrl ? <div><span>Source repository (founder-provided)</span><a href={product.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">View source ↗</a></div> : null}
            <div><span>Primary category</span><strong>{product.category}</strong></div>
          </section>
          <section className="product-block">
            <div className="block-heading"><div><p className="eyebrow">Record history</p><h2>Evidence over time</h2></div><span className="muted">One permanent record</span></div>
            <div className="timeline">
              <div><span className="timeline-dot mint" /><strong>Product submitted</strong><small>{product.launchedAt} · public preview created</small></div>
              <div><span className={`timeline-dot ${isVerified ? "mint" : "gray"}`} /><strong>{isVerified ? "Ownership verified" : "Ownership verification pending"}</strong><small>{isVerified ? "Evidence linked to the product record" : "Founder has not claimed this record yet"}</small></div>
              <div><span className="timeline-dot gray" /><strong>Updates and reviews</strong><small>Unlock as people use and respond to the product</small></div>
            </div>
          </section>
          <section className="product-block">
            <div className="block-heading"><div><p className="eyebrow">Founder updates</p><h2>What changed</h2></div><span className="muted">{content.updates.length} published</span></div>
            {content.updates.length ? <div className="content-list">{content.updates.map((update) => <article key={update.id}><time>{update.createdAt.toISOString().slice(0, 10)}</time><h3>{update.title}</h3><p>{update.body}</p></article>)}</div> : <p className="empty-copy">No founder updates have been published yet.</p>}
          </section>
          <section className="product-block">
            <div className="block-heading"><div><p className="eyebrow">Structured reviews</p><h2>Experience, with context</h2></div><span className="muted">{content.reviews.length} published</span></div>
            {content.reviews.length ? <div className="review-list">{content.reviews.map((review) => <article key={review.id}><div><strong>{review.rating}/5</strong><span>{review.displayName || "Community member"}</span><time>{review.createdAt.toISOString().slice(0, 10)}</time></div><p>{review.body}</p></article>)}</div> : <p className="empty-copy">No moderated reviews yet.</p>}
            {isPersisted ? <ReviewForm slug={product.slug} /> : <p className="form-note">Reviews are disabled for demo fixture records.</p>}
          </section>
        </div>
        <aside className="product-side">
          <div className="side-panel record-status-panel">
            <div className="side-panel-top"><p className="eyebrow">Record status</p><span>{isVerified ? "Verified" : "Preview"}</span></div>
            <strong>{product.stage}</strong><span>current product stage</span>
            <div className="side-stat"><span>Ownership</span><strong>{isVerified ? "Verified" : "Unverified"}</strong></div>
            <div className="side-stat"><span>Search indexing</span><strong>{isPersisted && !isDemo && isVerified && product.status === "approved" ? "Allowed" : "Noindex"}</strong></div>
            <div className="side-stat"><span>Community upvotes</span><strong>{voteState.count.toLocaleString()}{!isPersisted ? " sample" : ""}</strong></div>
            <div className="side-stat"><span>Reasoned downvotes</span><strong>{downvoteState.count.toLocaleString()}{!isPersisted ? " sample" : ""}</strong></div>
            <div className="side-stat"><span>Community reviews</span><strong>{product.stats.reviews}</strong></div>
          </div>
          <div className="side-panel related-products">
            <p className="eyebrow">Explore alternatives</p>
            <h2>Related products</h2>
            <Link href={{ pathname: "/compare", query: { a: product.slug } }}>Compare this product →</Link>
            <p>Suggestions share a category or tag. They are not community-endorsed replacements.</p>
            {related.map((candidate) => <Link key={candidate.slug} href={`/${candidate.slug}`}><strong>{candidate.name}</strong><span>{candidate.tagline}</span><small>{candidate.price}</small></Link>)}
            {!related.length ? <p>No related records yet.</p> : null}
            <Link href={{ pathname: "/today", query: { category: product.category } }}>Browse this category →</Link>
          </div>
          <div className="side-panel record-actions">
            <p className="eyebrow">Ranking policy</p>
            <p>Community upvotes help rank live products. One signed-in user gets one vote; payment never changes discovery rank.</p>
          </div>
        </aside>
      </div>
      <div className="product-footer-cta"><div><p className="eyebrow">Building something early?</p><h2>Start a transparent product record.</h2></div><Link href="/submit" className="button button-primary">Submit your product →</Link></div>
    </section>
  );
}
