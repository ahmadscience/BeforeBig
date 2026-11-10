import { describe, expect, it } from "vitest";
import fixtures from "@/data/demo-products.json";
import type { Product } from "@/lib/types";
import { catalogHref, decodeTaxonomyParam, filterSampleCatalog, ftsQuery, pageWindow, parseCatalogQuery, sampleCatalogPage, taxonomyPath, termKey } from "@/lib/catalog";

describe("catalog contracts", () => {
  it("bounds inputs, normalizes duplicate query values, and rejects invalid pages and sizes", () => {
    const query = parseCatalogQuery({ q: ["  release  ", "ignored"], page: "-1", size: "5000", sort: "injected", verified: "false" });
    expect(query).toEqual({ filters: { q: "release" }, page: 1, size: 12 });
    expect(parseCatalogQuery({ q: "x".repeat(500), page: "Infinity" }).filters.q).toHaveLength(200);
    expect(pageWindow(25, 99, 12)).toEqual({ page: 3, pages: 3, offset: 24 });
    expect(pageWindow(0, 5, 12)).toEqual({ page: 1, pages: 1, offset: 0 });
  });
  it("quotes literal word prefixes instead of accepting FTS syntax", () => {
    expect(ftsQuery('"plan" OR team*')).toBe('"plan"* AND "OR"* AND "team"*');
    expect(ftsQuery("!!!")).toBe("");
  });
  it("preserves filters and scope in navigation but resets pagination for new searches", () => {
    const query = parseCatalogQuery({ q: "plan", tag: "AI", category: "Finance", page: "2", size: "24" });
    expect(catalogHref("/today", query, 3)).toBe("/today?q=plan&category=Finance&tag=AI&size=24&page=3");
    expect(catalogHref("/categories/finance", query, 1)).toBe("/categories/finance?q=plan&tag=AI&size=24");
    expect(catalogHref("/tags/ai", query, 2)).not.toContain("tag=");
  });
  it("uses reversible taxonomy keys rather than collapsing C++ and C#", () => {
    expect(decodeTaxonomyParam("project%20management")).toBe("project management");
    expect(decodeTaxonomyParam("c%2B%2B")).toBe("c++");
    expect(decodeTaxonomyParam("%252B")).toBe("%2B");
    expect(decodeTaxonomyParam("broken%ZZ")).toBeNull();
    expect(termKey("  Developer Tools  ")).toBe("developer tools");
    expect(taxonomyPath("category", "Project management")).toBe("/categories/project%20management");
    expect(taxonomyPath("tag", "C++")).toBe("/tags/c%2B%2B");
    expect(taxonomyPath("tag", "C#")).toBe("/tags/c%23");
  });
  it("keeps sample mode paginated, prefix-matched, and visibly separate from database results", () => {
    const products = fixtures as Product[];
    const query = parseCatalogQuery({ q: "task agen" });
    expect(filterSampleCatalog(products, query.filters).map((product) => product.slug)).toEqual(["taskpilot"]);
    expect(filterSampleCatalog(products, { q: "pilot" })).toEqual([]);
    expect(sampleCatalogPage(products, parseCatalogQuery({ size: "4", page: "99" }), "fallback")).toMatchObject({ source: "fallback", page: 1, pages: 1, total: 4 });
    expect(filterSampleCatalog([{ ...products[0], status: "draft" }], {})).toEqual([]);
  });
});
