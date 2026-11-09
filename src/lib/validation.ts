import { z } from "zod";

const blockedHostnames = new Set(["localhost", "localhost.localdomain", "metadata.google.internal"]);

function isPrivateIpv4(hostname: string) {
  const octets = hostname.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;
  const [a, b] = octets;
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
}

export function normalizePublicHttpUrl(input: string) {
  const parsed = new URL(input.trim());
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (!/^https?:$/.test(parsed.protocol)) throw new Error("Only HTTP and HTTPS URLs are supported.");
  if (parsed.username || parsed.password) throw new Error("URLs with embedded credentials are not supported.");
  if (blockedHostnames.has(hostname) || hostname.endsWith(".localhost") || isPrivateIpv4(hostname) || hostname === "::1") {
    throw new Error("That destination is not a public website.");
  }
  parsed.hostname = hostname;
  parsed.hash = "";
  return parsed.toString();
}

export const productSubmissionSchema = z.object({
  url: z.string().trim().min(1, "Add a product URL.").max(2048, "That URL is too long."),
});

export function normalizedDomainFromUrl(url: string) {
  return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
}

export function productSlugFromDomain(domain: string) {
  const primaryLabel = domain.split(".")[0] ?? "product";
  const slug = primaryLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return slug || "product";
}

export function draftFromUrl(input: string) {
  const url = normalizePublicHttpUrl(input);
  const hostname = normalizedDomainFromUrl(url);
  const name = hostname.split(".")[0].replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  return {
    url,
    normalizedDomain: hostname,
    slug: productSlugFromDomain(hostname),
    name,
    tagline: "A new product ready to be discovered.",
    category: "Uncategorized",
    note: "This demo does not fetch remote HTML yet. Metadata extraction will be added behind the SSRF-safe fetch adapter.",
  };
}
