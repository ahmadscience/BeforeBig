import type { Metadata, Route } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listProductsForUser } from "@/db/products";
import { signOut } from "@/app/auth/actions";

export const metadata: Metadata = { title: "Founder dashboard", robots: { index: false, follow: false } };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <section className="shell auth-section">
        <div className="auth-card">
          <p className="eyebrow">Founder workspace</p>
          <h1>Your products, one calm dashboard.</h1>
          <p>Sign in to edit records, verify ownership, publish updates, and see traffic.</p>
          <Link href="/sign-in?returnTo=/dashboard" className="button button-primary">Sign in with email →</Link>
        </div>
      </section>
    );
  }

  const memberships = await listProductsForUser(user.id);
  return (
    <section className="shell dashboard-section">
      <div className="dashboard-top">
        <div><p className="eyebrow">Founder workspace</p><h1>Build trust, <em>one record at a time.</em></h1><p className="muted">Signed in as {user.email}</p></div>
        <div className="founder-row-actions"><Link href="/settings/privacy" className="button button-ghost">Privacy & data</Link><Link href="/collections" className="button button-ghost">Your collections</Link><form action={signOut}><button className="button button-ghost" type="submit">Sign out</button></form><Link href="/submit" className="button button-primary">Add product →</Link></div>
      </div>
      {memberships.length ? (
        <div className="founder-product-list">
          {memberships.map(({ product, membershipRole }) => (
            <article className="founder-product-row" key={product.id}>
              <div className="product-icon" aria-hidden="true">{product.name.slice(0, 1)}</div>
              <div><strong>{product.name}</strong><span>{product.tagline}</span><small>{product.status} · {product.verificationStatus.replaceAll("_", " ")} · {membershipRole}</small></div>
              <div className="founder-row-actions">
                <Link href={`/${product.slug}`} className="button button-ghost">Public page</Link>
                <Link href={`/dashboard/products/${product.slug}` as Route} className="button button-primary">Manage →</Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-mark">B/</span>
          <h2>No product records yet.</h2>
          <p>Start with a public website URL. You can edit the draft before verification.</p>
          <Link href="/submit" className="button button-primary">Create your first draft →</Link>
        </div>
      )}
      <p className="dashboard-footnote"><span className="status-dot" /> Traffic delivery and payments remain intentionally disabled in the free demo.</p>
    </section>
  );
}
