import Link from "next/link";
import { CommunityForm } from "@/components/community-form";
import { getCommunityStore } from "@/db/community";
import type { Product } from "@/lib/types";

export async function CommunityPanel({ product, catalog, userId }: { product: Product; catalog: Product[]; userId?: string }) {
  const store = getCommunityStore();
  const connected = Boolean(store && product.source !== "sample" && product.status === "approved");
  const [recommendations, own, saved] = await Promise.all([
    connected ? store!.listAlternatives(product.id, userId) : [],
    connected && userId ? store!.ownRecommendations(product.id, userId) : [],
    store && userId ? store.ownCollections(userId) : [],
  ]);
  const choices = catalog.filter((candidate) => candidate.slug !== product.slug && candidate.status === "approved" && candidate.source !== "sample");
  const activeCollections = saved.filter((collection) => !collection.deletedAt);
  return <>
    <section className="product-block community-panel" id="community-alternatives">
      <div className="block-heading"><div><p className="eyebrow">From the community</p><h2>Recommended alternatives</h2></div><span className="muted">{recommendations.length} approved</span></div>
      {recommendations.length ? <div className="community-list">{recommendations.map((recommendation) => <article key={recommendation.id}>
        <h3><Link href={{ pathname: "/" + recommendation.targetSlug }}>{recommendation.targetName} →</Link></h3>
        <p>{recommendation.tagline}</p><blockquote>{recommendation.reason}</blockquote>
        <div className="community-row"><span>{recommendation.supportCount} community {recommendation.supportCount === 1 ? "supporter" : "supporters"}</span>
          {userId && !recommendation.own ? <CommunityForm operation="support" fields={{ recommendationId: recommendation.id }} label={recommendation.viewerSupported ? "Remove support" : "Support this alternative"} /> : null}
          {!userId ? <Link href={{ pathname: "/sign-in", query: { returnTo: "/" + product.slug } }}>Sign in to support</Link> : null}
        </div>
      </article>)}</div> : <p className="empty-copy">No community recommendations have been approved yet.</p>}
      {connected && userId && choices.length ? <details className="community-details"><summary>Recommend an alternative</summary>
        <CommunityForm operation="propose" fields={{ sourceSlug: product.slug }} label="Submit for moderation">
          <label>Alternative product<select name="targetSlug" required><option value="">Choose an approved product</option>{choices.map((choice) => <option key={choice.id} value={choice.slug}>{choice.name}</option>)}</select></label>
          <label>Why is it an alternative?<textarea name="reason" required minLength={30} maxLength={1000} rows={4} placeholder="Explain the shared use case and the differences that matter." /></label>
          <p className="muted">30–1,000 characters. Your reason becomes public after approval. Owners and editors cannot recommend their own products.</p>
        </CommunityForm>
      </details> : connected && !userId ? <Link href={{ pathname: "/sign-in", query: { returnTo: "/" + product.slug } }} className="text-link">Sign in to recommend an alternative →</Link> : <p className="muted">Recommendations require approved, database-backed records. <Link href="/demo/community">Try the interactive demo →</Link></p>}
      {own.length ? <details className="community-details"><summary>Your recommendations</summary>{own.map((recommendation) => <article key={recommendation.id} className="community-proposal">
        <strong>{recommendation.targetName}</strong><span className="tag">{recommendation.status}</span><p>{recommendation.reason}</p>
        {["pending", "approved"].includes(recommendation.status) ? <CommunityForm operation="withdraw" fields={{ recommendationId: recommendation.id }} label="Withdraw recommendation" /> : null}
      </article>)}</details> : null}
    </section>
    <section className="product-block community-panel">
      <p className="eyebrow">Keep a shortlist</p><h2>Save to a collection</h2>
      {connected && userId && activeCollections.length ? <CommunityForm operation="save" fields={{ productSlug: product.slug }} label="Save product">
        <label>Collection<select name="collectionId" required>{activeCollections.map((collection) => <option key={collection.id} value={collection.id}>{collection.title} · {collection.visibility}</option>)}</select></label>
      </CommunityForm> : <p className="muted">{!connected ? "Sample and unapproved products cannot be saved." : userId ? "Create a collection to start saving products." : "Sign in to save products to your own collections."}</p>}
      <Link href="/collections" className="text-link">Your collections →</Link>
    </section>
  </>;
}
