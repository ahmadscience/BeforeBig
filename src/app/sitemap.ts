import type { MetadataRoute } from "next";
import { listIndexableProducts } from "@/db/products";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3247";
  let persisted: Awaited<ReturnType<typeof listIndexableProducts>> = [];
  try {
    persisted = await listIndexableProducts();
  } catch {
    // A provider outage must not block a deployment or remove the core public URLs.
  }
  return [
    { url: baseUrl, changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/today`, changeFrequency: "daily", priority: 0.8 },
    ...persisted.map((product) => ({ url: `${baseUrl}/${product.slug}`, lastModified: product.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
