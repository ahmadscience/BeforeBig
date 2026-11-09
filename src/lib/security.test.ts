import { describe, expect, it } from "vitest";
import { createOpaqueToken, hashOpaqueToken, safeReturnPath } from "@/lib/security";

describe("security helpers", () => {
  it("creates high-entropy opaque tokens and hashes them deterministically", () => {
    const token = createOpaqueToken();
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(hashOpaqueToken(token)).toHaveLength(64);
    expect(hashOpaqueToken(token)).toBe(hashOpaqueToken(token));
  });

  it("only accepts same-origin relative return paths", () => {
    expect(safeReturnPath("/dashboard/products/acme")).toBe("/dashboard/products/acme");
    expect(safeReturnPath("//evil.example")).toBe("/dashboard");
    expect(safeReturnPath("/\\evil.example")).toBe("/dashboard");
    expect(safeReturnPath("https://evil.example")).toBe("/dashboard");
  });
});
