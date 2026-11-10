import type { Metadata } from "next";
import { CatalogDemo } from "@/components/catalog-demo";
export const metadata: Metadata = { title: "Catalog discovery demo", robots: { index: false, follow: false } };
export default function CatalogDemoPage() {
  return <section className="shell page-section taxonomy-directory"><p className="eyebrow">BeforeBig playground</p><h1>Find a useful trail</h1><p className="catalog-notice">Fictional sample data. This browser-only preview demonstrates search, pagination, categories, and tags; it does not query a live search index or save changes.</p><CatalogDemo /></section>;
}
