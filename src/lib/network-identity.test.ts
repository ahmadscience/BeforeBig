import { describe, expect, it } from "vitest";
import { clientNetworkAddress, normalizeNetworkAddress } from "@/lib/network-identity";

describe("network identity normalization", () => {
  it("accepts canonical IP formats without retaining forwarding noise", () => {
    expect(normalizeNetworkAddress("203.0.113.7, 10.0.0.2")).toBe("203.0.113.7");
    expect(normalizeNetworkAddress("203.0.113.7:443")).toBe("203.0.113.7");
    expect(normalizeNetworkAddress("[2001:db8::1]:443")).toBe("2001:db8::1");
  });

  it("rejects malformed addresses and prefers Vercel's forwarding header", () => {
    expect(normalizeNetworkAddress("attacker-controlled")).toBeNull();
    const requestHeaders = new Headers({
      "x-vercel-forwarded-for": "198.51.100.9",
      "x-forwarded-for": "203.0.113.10",
    });
    expect(clientNetworkAddress(requestHeaders)).toBe("198.51.100.9");
  });
});
