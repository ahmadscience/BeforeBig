import type { Metadata, Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { catalogDirectory } from "@/lib/catalog-data";
import { positivePage, taxonomyPath, type QueryParams, type TaxonomyKind } from "@/lib/catalog";
import { CatalogPagination } from "@/components/catalog-pagination";

export async function directoryMetadata(kind: TaxonomyKind, params: QueryParams): Promise<Metadata> {
  const rawPage = params.page; const page = positivePage(Array.isArray(rawPage) ? rawPage[0] : rawPage);
  const data = await catalogDirectory(kind, page);
  const path = kind === "category" ? "/categories" : "/tags";
  return { title: kind === "category" ? "Browse categories" : "Browse tags", alternates: { canonical: path + (data.page > 1 ? "?page=" + data.page : "") }, robots: { index: data.items.some((item) => item.indexableCount > 0), follow: true } };
}
export async function TaxonomyDirectory({ kind, params }: { kind: TaxonomyKind; params: QueryParams }) {
  const value = params.page; const requestedPage = positivePage(Array.isArray(value) ? value[0] : value);
  const data = await catalogDirectory(kind, requestedPage);
  const path = kind === "category" ? "/categories" : "/tags";
  const href = (page: number) => path + (page > 1 ? "?page=" + page : "");
  if (data.page !== requestedPage) redirect(href(data.page) as Route);
  return <section className="shell page-section taxonomy-directory">
    <Link href="/today" className="back-link">← Discover products</Link>
    <p className="page-kicker">The software field guide</p><h1>{kind === "category" ? "Browse by purpose" : "Follow a tag"}</h1>
    <p className="muted">{kind === "category" ? "Find a category that fits the work you have in mind." : "Explore shared features, audiences, and workflows."}</p>
    <nav className="catalog-browse" aria-label="Catalog directories"><Link href="/categories">Categories</Link><Link href="/tags">Tags</Link></nav>
    {data.source !== "database" ? <p className="catalog-notice">{data.source === "fallback" ? "Database unavailable · showing sample taxonomy" : "Sample taxonomy · fictional product records"}</p> : null}
    <p className="muted">{data.total} {kind === "category" ? "categories" : "tags"} · Page {data.page} of {data.pages}</p>
    <div className="taxonomy-grid">{data.items.map((item) => <Link className="taxonomy-link" href={{ pathname: taxonomyPath(kind, item.key) }} key={item.key}><strong>{item.label}</strong><span>{item.count} {item.count === 1 ? "product" : "products"} →</span></Link>)}</div>
    {!data.items.length ? <p className="catalog-empty">No public {kind === "category" ? "categories" : "tags"} yet.</p> : null}
    <CatalogPagination page={data.page} pages={data.pages} href={href} />
  </section>;
}
