import { describe, expect, it } from "vitest";
import data from "@/data/demo-products.json";
import type { Product } from "@/lib/types";
import { filterProducts, relatedProducts } from "@/lib/discovery";

const products = data as Product[];

describe("catalog discovery", () => {
  it("matches words across fields regardless of case and combines filters", () => {
    const product = products[0];
    expect(filterProducts(products, { q: "TASKPILOT agencies", category: product.category, verified: "true" })).toEqual([product]);
    expect(filterProducts(products, { q: product.name, category: "Unknown" })).toEqual([]);
    expect(filterProducts(products, { q: "  " })).toHaveLength(products.length);
  });

  it("filters structured metadata without inferring values from price or tags", () => {
    const record: Product = { ...products[0], platforms: ["Linux"], licenseType: "open-source", pricingModel: "free" };
    expect(filterProducts([record], { platform: "Linux", license: "open-source", pricing: "free" })).toHaveLength(1);
    expect(filterProducts([record], { platform: "Windows" })).toEqual([]);
    expect(filterProducts(products, { license: "open-source" })).toEqual([]);
    expect(filterProducts(products, { license: "unknown", pricing: "unknown" })).toHaveLength(products.length);
  });

  it("sorts a copy without changing repository order", () => {
    const input = [{ ...products[0], stats: { ...products[0].stats, upvotes: 1 } }, { ...products[1], stats: { ...products[1].stats, upvotes: 5 } }];
    expect(filterProducts(input, { sort: "votes" })[0].slug).toBe(products[1].slug);
    expect(input[0].slug).toBe(products[0].slug);
    expect(filterProducts(input, { sort: "unknown" })).toEqual(input);
    expect(filterProducts(input, { sort: "newest" })[0].slug).toBe(products[0].slug);
  });

  it("excludes unverified records only when requested", () => {
    const input: Product[] = [{ ...products[0], verificationStatus: "unverified" }];
    expect(filterProducts(input, { verified: "true" })).toEqual([]);
    expect(filterProducts(input, {})).toHaveLength(1);
  });

  it("suggests relevant records, excluding the product itself and unrelated records", () => {
    const product = products[0];
    const sameCategory = { ...product, slug: "same-category", tags: [] };
    const sharedTag = { ...products[1], tags: [product.tags[0].toLowerCase()] };
    const unrelated = { ...products[2], tags: [], category: "Unrelated" };
    expect(relatedProducts(product, [product, sharedTag, unrelated, sameCategory])).toEqual([sameCategory, sharedTag]);
    expect(relatedProducts(product, [product, unrelated])).toEqual([]);
  });
});
