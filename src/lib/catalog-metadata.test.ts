import { describe, expect, it } from "vitest";
import { catalogMetadataSchema } from "@/lib/catalog-metadata";

describe("catalog metadata claims", () => {
  it("keeps absent metadata unknown for existing records", () => {
    expect(catalogMetadataSchema.parse({})).toEqual({ platforms: [], licenseType: "unknown", pricingModel: "unknown", sourceUrl: "" });
  });
  it("requires public source evidence for open-source claims", () => {
    expect(catalogMetadataSchema.safeParse({ licenseType: "open-source" }).success).toBe(false);
    expect(catalogMetadataSchema.safeParse({ licenseType: "open-source", sourceUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(catalogMetadataSchema.safeParse({ licenseType: "open-source", sourceUrl: "http://127.0.0.1/source" }).success).toBe(false);
    expect(catalogMetadataSchema.safeParse({ licenseType: "open-source", sourceUrl: "https://github.com/example/project", platforms: ["Linux"] }).success).toBe(true);
  });
  it("rejects unsupported platform and pricing values", () => {
    expect(catalogMetadataSchema.safeParse({ platforms: ["Anything"] }).success).toBe(false);
    expect(catalogMetadataSchema.safeParse({ pricingModel: "cheap" }).success).toBe(false);
  });
});
