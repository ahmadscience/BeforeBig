import { getDb } from "@/db/client";
import { createCatalogStore } from "@/db/catalog";
import { taxonomyPath } from "@/lib/catalog";
import type { MetadataRoute } from "next";
import { listIndexableProducts } from "@/db/products";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3247";
  let persisted: Awaited<ReturnType<typeof listIndexableProducts>> = [];
  try {
    persisted = await listIndexableProducts();
  } catch {
    // A provider outage must not block a deployment or remove the core public URLs.
  }
  let taxonomy: string[] = [];
  try {
    const db = getDb();
    if (db) taxonomy = (await createCatalogStore(db).sitemapTerms()).map((term) => taxonomyPath(term.kind as "category" | "tag", term.key));
  } catch { /* Keep core URLs available if the catalog provider is unavailable. */ }
  return [
    { url: baseUrl, changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/today`, changeFrequency: "daily", priority: 0.8 },
    ...(taxonomy.length ? [
      { url: baseUrl + "/categories", changeFrequency: "weekly" as const, priority: 0.6 },
      { url: baseUrl + "/tags", changeFrequency: "weekly" as const, priority: 0.6 },
      ...taxonomy.map((path) => ({ url: baseUrl + path, changeFrequency: "weekly" as const, priority: 0.5 })),
    ] : []),
    ...persisted.map((product) => ({ url: `${baseUrl}/${product.slug}`, lastModified: product.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
