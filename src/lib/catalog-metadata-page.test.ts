import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ term: vi.fn() }));
vi.mock("@/lib/catalog-data", () => ({ catalogTerm: mocks.term }));
import { taxonomyMetadata } from "@/lib/catalog-metadata-page";

beforeEach(() => { vi.resetAllMocks(); mocks.term.mockResolvedValue({ item: { key: "c++", label: "C++", count: 30, indexableCount: 20 }, source: "database" }); });
describe("taxonomy metadata", () => {
  it("gives unfiltered pages a punctuation-safe canonical URL", async () => {
    expect(await taxonomyMetadata("tag", "c++", { page: "2" })).toMatchObject({ title: "C++ tag", alternates: { canonical: "/tags/c%2B%2B?page=2" }, robots: { index: true, follow: true } });
  });
  it("keeps filtered and alternate-page-size variants out of the search index", async () => {
    expect(await taxonomyMetadata("tag", "c++", { q: "plan" })).toMatchObject({ robots: { index: false } });
    expect(await taxonomyMetadata("tag", "c++", { size: "48" })).toMatchObject({ robots: { index: false } });
  });
  it("never indexes sample-only, unverified-only, or missing terms", async () => {
    mocks.term.mockResolvedValue({ item: { key: "sample", label: "Sample", count: 4, indexableCount: 0 }, source: "sample" });
    expect(await taxonomyMetadata("tag", "sample", {})).toMatchObject({ robots: { index: false } });
    mocks.term.mockResolvedValue({ item: null, source: "database" });
    expect(await taxonomyMetadata("tag", "unknown", {})).toMatchObject({ robots: { index: false } });
  });
});
