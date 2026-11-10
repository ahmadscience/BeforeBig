import { CommunityForm } from "@/components/community-form";
import { getCommunityStore } from "@/db/community";
import type { Metadata } from "next";
import { and, asc, eq, inArray, notLike } from "drizzle-orm";
import { moderateDownvote, moderateProduct, moderateReview } from "@/app/admin/moderation/actions";
import { requireModerator } from "@/lib/auth";
import { getDb } from "@/db/client";
import { productDownvotes, products, reviews, users } from "@/db/schema";

export const metadata: Metadata = { title: "Moderation", robots: { index: false, follow: false } };

export default async function ModerationPage() {
  const moderator = await requireModerator();
  const alternativeQueue = await getCommunityStore()?.queue(moderator) ?? [];
  const db = getDb();
  const [productQueue, reviewQueue, downvoteQueue] = db ? await Promise.all([
    db.select().from(products).where(and(inArray(products.status, ["draft", "public", "suspended"]), notLike(products.id, "demo_%"))).orderBy(asc(products.updatedAt)),
    db
      .select({ review: reviews, productName: products.name, productSlug: products.slug, authorEmail: users.email })
      .from(reviews)
      .innerJoin(products, eq(reviews.productId, products.id))
      .innerJoin(users, eq(reviews.authorUserId, users.id))
      .where(and(eq(reviews.status, "pending")))
      .orderBy(asc(reviews.createdAt)),
    db
      .select({ downvote: productDownvotes, productName: products.name, productSlug: products.slug, authorEmail: users.email })
      .from(productDownvotes)
      .innerJoin(products, eq(productDownvotes.productId, products.id))
      .innerJoin(users, eq(productDownvotes.userId, users.id))
      .where(eq(productDownvotes.status, "pending"))
      .orderBy(asc(productDownvotes.createdAt)),
  ]) : [[], [], []];
  return (
    <section className="shell manage-section">
      <div className="manage-heading"><div><p className="eyebrow">Admin</p><h1>Moderation queue</h1><p>Approval controls indexing. Verification and content quality remain separate checks.</p></div></div>
      <section className="panel community-moderation"><h2>Alternative recommendations <span>{alternativeQueue.length}</span></h2>
        {alternativeQueue.map((recommendation) => <article className="moderation-item" key={recommendation.id}>
          <h3>{recommendation.targetName} as an alternative to {recommendation.sourceName}</h3><p>{recommendation.reason}</p>
          {recommendation.authorId === moderator.id ? <p className="muted">Another moderator must review your recommendation.</p> : <div className="community-row">
            <CommunityForm operation="moderate" fields={{ recommendationId: recommendation.id, decision: "approved" }} label="Approve alternative" />
            <CommunityForm operation="moderate" fields={{ recommendationId: recommendation.id, decision: "rejected" }} label="Reject alternative" />
          </div>}
        </article>)}
        {!alternativeQueue.length ? <p className="muted">No alternatives need attention.</p> : null}
      </section>
      <div className="moderation-grid">
        <section className="panel"><h2>Product records <span>{productQueue.length}</span></h2>
          {productQueue.length ? productQueue.map((product) => (
            <article className="moderation-item" key={product.id}>
              <div><strong>{product.name}</strong><p>{product.tagline}</p><small>{product.status} · {product.verificationStatus.replaceAll("_", " ")}</small></div>
              <form action={moderateProduct}>
                <input type="hidden" name="productId" value={product.id} /><input type="hidden" name="slug" value={product.slug} />
                <input name="note" maxLength={500} placeholder="Optional internal note" />
                <div><button name="action" value="approve" disabled={product.verificationStatus === "unverified"}>Approve</button><button name="action" value="reject">Return</button><button name="action" value="suspend">Suspend</button></div>
              </form>
            </article>
          )) : <p className="muted">No products need attention.</p>}
        </section>
        <section className="panel"><h2>Reviews <span>{reviewQueue.length}</span></h2>
          {reviewQueue.length ? reviewQueue.map(({ review, productName, productSlug, authorEmail }) => (
            <article className="moderation-item" key={review.id}>
              <div><strong>{review.rating}/5 for {productName}</strong><p>{review.body}</p><small>{authorEmail}</small></div>
              <form action={moderateReview}>
                <input type="hidden" name="reviewId" value={review.id} /><input type="hidden" name="productSlug" value={productSlug} />
                <button name="decision" value="published">Publish</button><button name="decision" value="rejected">Reject</button>
              </form>
            </article>
          )) : <p className="muted">No reviews need attention.</p>}
        </section>
        <section className="panel"><h2>Reasoned downvotes <span>{downvoteQueue.length}</span></h2>
          {downvoteQueue.length ? downvoteQueue.map(({ downvote, productName, productSlug, authorEmail }) => (
            <article className="moderation-item" key={downvote.id}>
              <div><strong>Concern about {productName}</strong><p>{downvote.reason}</p><small>{authorEmail} · registered account · IP-limited reaction</small></div>
              <form action={moderateDownvote}>
                <input type="hidden" name="downvoteId" value={downvote.id} /><input type="hidden" name="productSlug" value={productSlug} />
                <button name="decision" value="approved">Approve signal</button><button name="decision" value="rejected">Reject</button>
              </form>
            </article>
          )) : <p className="muted">No downvotes need attention.</p>}
        </section>
      </div>
    </section>
  );
}
