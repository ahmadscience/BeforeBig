"use client";

import { useState } from "react";
import { catalogDemoProducts } from "@/data/catalog-demo";
import { catalogHref, sampleCatalogPage, sampleTerms, taxonomyPath, type TaxonomyKind } from "@/lib/catalog";

export function CatalogDemo() {
  const [mode, setMode] = useState("products");
  const [scope, setScope] = useState<{ kind: TaxonomyKind; key: string; label: string } | null>(null);
  const [draft, setDraft] = useState(""); const [search, setSearch] = useState("");
  const [page, setPage] = useState(1); const [sort, setSort] = useState(""); const [size, setSize] = useState(4);
  const query = { filters: { q: search, sort, ...(scope ? { [scope.kind === "category" ? "category" : "tag"]: scope.key } : {}) }, page, size };
  const data = sampleCatalogPage(catalogDemoProducts, query);
  const path = scope ? taxonomyPath(scope.kind, scope.key) : "/today";
  const terms = sampleTerms(catalogDemoProducts, mode === "categories" ? "category" : "tag");
  function open(kind: TaxonomyKind, key: string, label: string) { setScope({ kind, key, label }); setMode("products"); setPage(1); setSearch(""); setDraft(""); }
  return <div className="catalog-demo">
    <nav className="demo-tabs" aria-label="Catalog demo navigation">
      <button className="button button-ghost" onClick={() => { setScope(null); setMode("products"); setPage(1); setSearch(""); setDraft(""); }}>All products</button>
      <button className="button button-ghost" onClick={() => setMode("categories")}>Browse categories</button>
      <button className="button button-ghost" onClick={() => setMode("tags")}>Browse tags</button>
    </nav>
    {mode !== "products" ? <><h2>{mode === "categories" ? "Browse by purpose" : "Follow a tag"}</h2><div className="taxonomy-grid">{terms.map((term) => <button className="taxonomy-link" key={term.key} onClick={() => open(mode === "categories" ? "category" : "tag", term.key, term.label)}><strong>{term.label}</strong><span>{term.count} products →</span></button>)}</div></> : <>
      <p className="eyebrow">{scope ? scope.kind : "Sample catalog"}</p><h2>{scope?.label ?? "Find your next useful tool"}</h2>
      <form className="catalog-search" onSubmit={(event) => { event.preventDefault(); setSearch(draft.slice(0, 200)); setPage(1); }}>
        <label className="catalog-query">Search products<input type="search" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={200} placeholder="Try plan or support" /></label>
        <label>Sort by<select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}><option value="">Recommended</option><option value="name">Name A–Z</option></select></label>
        <label>Per page<select value={size} onChange={(event) => { setSize(Number(event.target.value)); setPage(1); }}><option value={4}>4</option><option value={12}>12</option></select></label>
        <button className="button button-primary">Search</button>
      </form>
      <div className="discovery-toolbar"><p role="status">{data.total ? (data.page - 1) * size + 1 : 0}–{Math.min(data.page * size, data.total)} of {data.total} matching products</p><span>Page {data.page} of {data.pages}</span></div>
      <code className="demo-url">{catalogHref(path, data, data.page)}</code>
      <div className="community-list">{data.products.map((product) => <article key={product.id} className="catalog-demo-row"><div><h3>{product.name}</h3><p>{product.tagline}</p><div className="catalog-demo-terms"><button onClick={() => open("category", product.category.toLowerCase(), product.category)}>{product.category}</button>{product.tags.map((tag) => <button key={tag} onClick={() => open("tag", tag.toLowerCase(), tag)}>#{tag}</button>)}</div></div><span className="tag">Sample</span></article>)}</div>
      {!data.total ? <p className="catalog-empty">No matching sample products. Try another word prefix.</p> : null}
      <nav className="catalog-pagination" aria-label="Demo result pages"><button className="button button-ghost" disabled={data.page === 1} onClick={() => setPage(data.page - 1)}>← Previous</button><span>Page {data.page} of {data.pages}</span><button className="button button-ghost" disabled={data.page === data.pages} onClick={() => setPage(data.page + 1)}>Next →</button></nav>
    </>}
  </div>;
}
