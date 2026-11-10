import { taxonomyPath } from "@/lib/catalog";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { VoteButton } from "@/components/vote-button";
import { DownvoteButton } from "@/components/downvote-button";
import { Badge } from "@/components/ui/badge";

export function ProductCard({ product, index, compact = false, returnTo = "/today", headingLevel = "h3" }: { product: Product; index?: number; compact?: boolean; returnTo?: string; headingLevel?: "h2" | "h3" }) {
  const isSample = product.source === "sample" || product.id.startsWith("prod_");
  const downvotesEnabled = true;
  const Heading = headingLevel;
  if (compact) {
    return (
      <article className={`product-card product-card-compact accent-${product.accent}`}>
        <span className="compact-rank">{index ? String(index).padStart(2, "0") : "–"}</span>
        <div className="product-icon" aria-hidden="true">{product.name.slice(0, 1)}</div>
        <div className="compact-main">
          <div className="compact-title-row">
            <Heading><Link href={`/${product.slug}`}>{product.name}</Link></Heading>
            <Badge className="card-stage" variant="secondary">{product.stage}</Badge>
            {product.verificationStatus !== "unverified" ? <span className="compact-verified" title="Verified product">✓</span> : null}
          </div>
          <p>{product.tagline}</p>
          <div className="compact-meta"><Link href={{ pathname: taxonomyPath("category", product.category) }}>{product.category}</Link>{product.tags[0] ? <Link href={{ pathname: taxonomyPath("tag", product.tags[0]) }}>{product.tags[0]}</Link> : null}</div>
        </div>
        <div className="compact-signals">
          <span><strong>{product.stats.qualifiedVisits.toLocaleString()}</strong> clicks</span>
          <span><strong>{product.stats.views.toLocaleString()}</strong> views</span>
        </div>
        <div className="reaction-buttons reaction-buttons-compact">
          <VoteButton slug={product.slug} count={product.stats.upvotes} hasVoted={product.viewerHasVoted} returnTo={returnTo} sample={isSample} />
          <DownvoteButton slug={product.slug} count={product.stats.downvotes} hasDownvoted={product.viewerHasDownvoted} downvoteStatus={product.viewerDownvoteStatus} returnTo={returnTo} sample={isSample} enabled={downvotesEnabled} />
        </div>
        <Link className="compact-open" href={`/${product.slug}`} aria-label={`View ${product.name}`}>View <span aria-hidden="true">→</span></Link>
      </article>
    );
  }

  return (
    <article className={`product-card accent-${product.accent}`}>
      <div className="card-topline">
        <span className="rank">{index ? `0${index}` : "NEW"}</span>
          <Badge className="card-stage" variant="secondary">{product.stage}</Badge>
      </div>
      <div className="product-icon" aria-hidden="true">{product.name.slice(0, 1)}</div>
      <div className="card-copy">
        <Heading><Link href={`/${product.slug}`}>{product.name}</Link></Heading>
        <p>{product.tagline}</p>
      </div>
      <div className="tag-row">
        {product.tags.map((tag) => <Link key={tag} className="tag" href={{ pathname: taxonomyPath("tag", tag) }}>{tag}</Link>)}
      </div>
      <div className="card-footer">
        <Link href={{ pathname: taxonomyPath("category", product.category) }}>{product.category}</Link>
        <div className="reaction-buttons reaction-buttons-compact">
          <VoteButton slug={product.slug} count={product.stats.upvotes} hasVoted={product.viewerHasVoted} returnTo={returnTo} sample={isSample} />
          <DownvoteButton slug={product.slug} count={product.stats.downvotes} hasDownvoted={product.viewerHasDownvoted} downvoteStatus={product.viewerDownvoteStatus} returnTo={returnTo} sample={isSample} enabled={downvotesEnabled} />
        </div>
      </div>
    </article>
  );
}
