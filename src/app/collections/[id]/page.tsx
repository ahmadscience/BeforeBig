import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCommunityStore } from "@/db/community";
import { idSchema } from "@/lib/community";
import { CommunityForm } from "@/components/community-form";

// Generic metadata avoids leaking private titles through an unauthenticated metadata request.
export const metadata: Metadata = { title: "Saved collection", robots: { index: false, follow: false } };

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const user = await getCurrentUser(); const store = getCommunityStore();
  const collection = store ? await store.readCollection(id, user?.id) : null;
  if (!collection) notFound();
  return <section className="shell page-section collections-page">
    <Link href="/collections" className="back-link">← Collections</Link>
    <header className="community-page-heading"><div><p className="eyebrow">{collection.visibility} collection</p><h1>{collection.title}</h1><p className="muted">{collection.description}</p></div><span>{collection.items.length} saved products</span></header>
    {collection.visibility === "public" ? <p className="muted">Share this page&apos;s URL to share the collection. Anyone can see its title, description, and approved products.</p> : <p className="muted">Only you can view this collection. Change its visibility to public to share it.</p>}
    <div className="community-list">{collection.items.map((product) => <article key={product.id} className="community-row"><div><h2><Link href={{ pathname: "/" + product.slug }}>{product.name} →</Link></h2><p>{product.tagline}</p><span className="muted">{product.category}</span></div>{collection.own ? <CommunityForm operation="remove" fields={{ collectionId: id, productSlug: product.slug }} label={"Remove " + product.name} /> : null}</article>)}</div>
    {!collection.items.length ? <div className="catalog-empty"><h2>No visible products yet</h2><p>Save approved products from their product pages. Records under review or suspended are hidden.</p><Link href="/today" className="button button-primary">Discover products →</Link></div> : null}
    {collection.own ? <details className="community-details"><summary>Edit collection</summary><CommunityForm operation="edit" fields={{ collectionId: id }} label="Save collection">
      <label>Title<input name="title" defaultValue={collection.title} required minLength={3} maxLength={80} /></label>
      <label>Description<textarea name="description" defaultValue={collection.description} maxLength={500} rows={3} /></label>
      <label>Visibility<select name="visibility" defaultValue={collection.visibility}><option value="private">Private · only you</option><option value="public">Public · listed and shareable</option></select></label>
    </CommunityForm>
    <details className="community-details"><summary>Remove this collection</summary><p>This immediately hides its public link and keeps a restorable copy in your removed collections.</p><CommunityForm operation="archive" fields={{ collectionId: id }} label="Remove collection" /></details></details> : null}
  </section>;
}
