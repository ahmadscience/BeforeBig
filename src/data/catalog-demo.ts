import fixtures from "@/data/demo-products.json";
import type { Product } from "@/lib/types";

// Fictional browser-only catalog, large enough to exercise multiple result pages.
const names = ["TaskPilot", "ReplyRadar", "InvoiceFox", "PatchKit", "PlanLeaf", "FeedbackFern", "LedgerLine", "BuildTrail", "FocusFlow", "RelayDesk", "BillSprout", "ShipNote"];
export const catalogDemoProducts: Product[] = names.map((name, index) => ({
  ...(fixtures[index % fixtures.length] as Product), id: "sample_catalog_" + index, slug: name.toLowerCase(), name, source: "sample",
  status: "approved", stats: { upvotes: 0, downvotes: 0, views: 0, qualifiedVisits: 0, reviews: 0 },
}));
