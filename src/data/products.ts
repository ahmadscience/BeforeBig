import fixtures from "@/data/demo-products.json";
import type { Product } from "@/lib/types";
export const demoProducts: Product[] = (fixtures as Product[]).map((product) => ({ ...product, source: "sample" }));
