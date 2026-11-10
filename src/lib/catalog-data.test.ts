import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ db: vi.fn(), search: vi.fn() }));
vi.mock("@/db/client", () => ({ getDb: mocks.db }));
vi.mock("@/db/catalog", () => ({ createCatalogStore: () => ({ search: mocks.search }) }));
import { searchCatalog } from "@/lib/catalog-data";
import { parseCatalogQuery } from "@/lib/catalog";

beforeEach(() => vi.resetAllMocks());
describe("catalog data sources", () => {
  it("uses labeled samples only when no database is configured", async () => {
    mocks.db.mockReturnValue(null);
    expect(await searchCatalog(parseCatalogQuery({}))).toMatchObject({ source: "sample", total: 4 });
    expect(mocks.search).not.toHaveBeenCalled();
  });
  it("keeps connected empty and no-match results empty instead of mixing fixtures", async () => {
    mocks.db.mockReturnValue({});
    const empty = { ...parseCatalogQuery({ q: "missing" }), products: [], total: 0, catalogTotal: 45, pages: 1, source: "database" };
    mocks.search.mockResolvedValue(empty);
    expect(await searchCatalog(parseCatalogQuery({ q: "missing" }))).toEqual(empty);
  });
  it("makes a failed read visibly different from a successful live query", async () => {
    mocks.db.mockReturnValue({}); mocks.search.mockRejectedValue(new Error("unavailable"));
    expect(await searchCatalog(parseCatalogQuery({}))).toMatchObject({ source: "fallback", total: 4 });
  });
});
