import type { Metadata } from "next";
import Link from "next/link";
import { listDiscoveryProducts } from "@/lib/products";
import type { Product } from "@/lib/types";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Compare products", robots: { index: false, follow: true } };

const rows: { label: string; value: (product: Product) => string }[] = [
  { label: "Purpose", value: (product) => product.tagline },
  { label: "Category", value: (product) => product.category },
  { label: "Best for", value: (product) => product.bestFor },
  { label: "Not best for", value: (product) => product.notBestFor },
  { label: "Starting price", value: (product) => product.price },
  { label: "Stage", value: (product) => product.stage },
  { label: "Ownership", value: (product) => product.verificationStatus.replaceAll("_", " ") },
  { label: "Platforms", value: (product) => product.platforms?.join(", ") || "Unknown" },
  { label: "Software license", value: (product) => product.licenseType ?? "unknown" },
  { label: "Pricing model", value: (product) => product.pricingModel ?? "unknown" },
  { label: "Source repository", value: (product) => product.sourceUrl || "Not provided" },
  { label: "Tags", value: (product) => product.tags.join(", ") },
];

export default async function ComparePage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const catalog = await listDiscoveryProducts();
  // Resolve selections against the public feed: query strings cannot reveal private records.
  const slugs = [query.a, query.b, query.c].map((value) => typeof value === "string" ? value : "");
  const selected = catalog.filter((product) => slugs.includes(product.slug));
  return <section className="shell page-section compare-page">
    <p className="page-kicker">The field guide</p>
    <h1>Compare product fit</h1>
    <p className="muted">Choose two or three products. Compare what each record says, then explore the details.</p>
    <form action="/compare" className="compare-picker" method="get">
      {["a", "b", "c"].map((name, index) => <label key={name}>Product {index + 1}{index === 2 ? " (optional)" : ""}
        <select name={name} defaultValue={slugs[index]} required={index < 2}><option value="">Choose a product</option>{catalog.map((product) => <option key={product.slug} value={product.slug}>{product.name}</option>)}</select>
      </label>)}
      <Button type="submit">Compare</Button>
      <Link href="/compare" className="text-link">Reset</Link>
    </form>
    {selected.length >= 2 ? <div className="comparison-scroll" role="region" aria-label="Product comparison" tabIndex={0}>
      <table className="comparison-table">
        <caption>Prices and fit are founder-provided claims. Ownership verification does not endorse them. Demo records are illustrative.</caption>
        <thead><tr><th scope="col">Product details</th>{selected.map((product) => <th scope="col" key={product.slug}><Link href={`/${product.slug}`}>{product.name} →</Link></th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row.label}><th scope="row">{row.label}</th>{selected.map((product) => <td key={product.slug}>{row.value(product) || "Not specified"}</td>)}</tr>)}</tbody>
      </table>
    </div> : <p className="catalog-empty">Select at least two different products to see their details side by side.</p>}
  </section>;
}
