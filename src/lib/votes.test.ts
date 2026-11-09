import { describe, expect, it } from "vitest";
import { productAcceptsVotes } from "@/lib/votes";

describe("product vote eligibility", () => {
  it("allows only products that are publicly visible", () => {
    expect(productAcceptsVotes("public")).toBe(true);
    expect(productAcceptsVotes("approved")).toBe(true);
    expect(productAcceptsVotes("draft")).toBe(false);
    expect(productAcceptsVotes("suspended")).toBe(false);
    expect(productAcceptsVotes("discontinued")).toBe(false);
  });
});
