import demoProductData from "@/data/demo-products.json";
import { findPersistedProductBySlug, listDiscoverablePersistedProducts } from "@/db/products";
import type { Product } from "@/lib/types";

export const demoProducts = (demoProductData as Product[]).map((product) => ({ ...product, source: "sample" as const }));

export function getProductBySlug(slug: string) {
  return demoProducts.find((product) => product.slug === slug);
}

export function getApprovedProducts() {
  return demoProducts.filter((product) => product.status === "approved");
}

export async function findProductBySlug(slug: string) {
  try {
    return (await findPersistedProductBySlug(slug)) ?? getProductBySlug(slug);
  } catch {
    return getProductBySlug(slug);
  }
}

export async function listDiscoveryProducts(viewerUserId?: string) {
  let persisted: Product[] = [];
  try {
    persisted = await listDiscoverablePersistedProducts(viewerUserId);
  } catch {
    // Keep discovery usable if the remote Turso database is temporarily unavailable.
  }
  const persistedSlugs = new Set(persisted.map((product) => product.slug));
  const samples = demoProducts.filter((product) => !persistedSlugs.has(product.slug));
  return [...persisted, ...samples];
}
