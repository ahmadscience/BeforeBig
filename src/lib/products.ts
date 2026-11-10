import { demoProducts } from "@/data/products";
import { searchCatalog } from "@/lib/catalog-data";
export { demoProducts } from "@/data/products";
import { findPersistedProductBySlug } from "@/db/products";


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
  // Home/related selectors are bounded shortlists. The full catalog lives behind paginated queries.
  return (await searchCatalog({ filters: {}, page: 1, size: 24 }, viewerUserId)).products;
}
