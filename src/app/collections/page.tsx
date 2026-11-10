import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCommunityStore } from "@/db/community";
import { CommunityForm } from "@/components/community-form";

export const metadata: Metadata = { title: "Collections", robots: { index: false, follow: false } };

export default async function CollectionsPage() {
  const user = await getCurrentUser();
  const store = getCommunityStore();
  const [owned, published] = await Promise.all([store && user ? store.ownCollections(user.id) : [], store ? store.publicCollections() : []]);
  const active = owned.filter((collection) => !collection.deletedAt);
  const removed = owned.filter((collection) => collection.deletedAt);
  return <section className="shell page-section collections-page">
    <header className="community-page-heading"><div><p className="eyebrow">Your software field guide</p><h1>Keep the useful ones</h1><p className="muted">Build a shortlist for a project, a team, or whatever comes next.</p></div><Link href="/demo/community" className="button button-ghost">Try the demo →</Link></header>
    <div className="collections-layout">
      <section><h2>Your collections</h2>
        {user && store ? <>
          <div className="collections-grid">{active.map((collection) => <Link className="collection-card" key={collection.id} href={{ pathname: "/collections/" + collection.id }}><span className="tag">{collection.visibility}</span><h3>{collection.title}</h3><p>{collection.description || "A place for your saved products."}</p><span>Open collection →</span></Link>)}</div>
          {!active.length ? <p className="catalog-empty">No collections yet. Start with a title; new collections are private.</p> : null}
          {removed.length ? <details className="community-details"><summary>Removed collections ({removed.length})</summary>{removed.map((collection) => <div key={collection.id} className="community-row"><span>{collection.title}</span><CommunityForm operation="restore" fields={{ collectionId: collection.id }} label="Restore" /></div>)}</details> : null}
        </> : <div className="catalog-empty"><p>Sign in to create private shortlists and publish collections.</p><Link href="/sign-in?returnTo=/collections" className="button button-primary">Sign in</Link></div>}
      </section>
      {user && store ? <aside className="panel"><h2>Create a collection</h2><CommunityForm operation="create" label="Create collection">
        <label>Title<input name="title" required minLength={3} maxLength={80} placeholder="Tools for my next project" /></label>
        <label>Description<textarea name="description" maxLength={500} rows={3} /></label>
        <label>Visibility<select name="visibility" defaultValue="private"><option value="private">Private · only you</option><option value="public">Public · listed and shareable</option></select></label>
        <p className="muted">Public collections appear in community browsing. Titles, descriptions, and approved products are visible to everyone; your email stays private.</p>
      </CommunityForm></aside> : null}
    </div>
    <section className="public-collections"><h2>Community collections</h2><div className="collections-grid">{published.map((collection) => <Link className="collection-card" href={{ pathname: "/collections/" + collection.id }} key={collection.id}><span className="tag">Public</span><h3>{collection.title}</h3><p>{collection.description}</p><span>Explore collection →</span></Link>)}</div>{!published.length ? <p className="muted">No public collections yet.</p> : null}</section>
  </section>;
}
