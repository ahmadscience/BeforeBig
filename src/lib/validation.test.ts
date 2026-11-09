import { describe, expect, it } from "vitest";
import { draftFromUrl, normalizePublicHttpUrl, productSlugFromDomain } from "./validation";

describe("URL submission safety", () => {
  it("normalizes a public HTTPS URL and removes fragments", () => {
    expect(normalizePublicHttpUrl(" HTTPS://Example.com/product#pricing ")).toBe("https://example.com/product");
  });

  it("rejects credentials and local destinations", () => {
    expect(() => normalizePublicHttpUrl("https://user:password@example.com")).toThrow(/credentials/);
    expect(() => normalizePublicHttpUrl("http://127.0.0.1:3000")).toThrow(/public website/);
    expect(() => normalizePublicHttpUrl("http://192.168.1.12")).toThrow(/public website/);
    expect(() => normalizePublicHttpUrl("http://localhost/admin")).toThrow(/public website/);
  });

  it("creates a provisional draft without fetching remote HTML", () => {
    expect(draftFromUrl("https://taskpilot.app")).toMatchObject({
      name: "Taskpilot",
      url: "https://taskpilot.app/",
      normalizedDomain: "taskpilot.app",
      slug: "taskpilot",
      category: "Uncategorized",
    });
  });

  it("creates a stable, URL-safe slug from the normalized domain", () => {
    expect(productSlugFromDomain("my-great_product.example")).toBe("my-great-product");
  });
});
