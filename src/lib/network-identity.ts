import { isIP } from "node:net";
import { headers } from "next/headers";
import { keyedHash } from "@/lib/security";

export function normalizeNetworkAddress(value: string | null | undefined) {
  const first = value?.split(",")[0]?.trim();
  if (!first) return null;

  const bracketedIpv6 = first.match(/^\[([^\]]+)](?::\d+)?$/)?.[1];
  if (bracketedIpv6 && isIP(bracketedIpv6) === 6) return bracketedIpv6.toLowerCase();
  if (isIP(first)) return first.toLowerCase();

  const ipv4WithPort = first.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/)?.[1];
  if (ipv4WithPort && isIP(ipv4WithPort) === 4) return ipv4WithPort;
  return null;
}

export function clientNetworkAddress(requestHeaders: Headers) {
  return normalizeNetworkAddress(
    requestHeaders.get("x-vercel-forwarded-for")
      ?? requestHeaders.get("x-forwarded-for")
      ?? requestHeaders.get("x-real-ip"),
  );
}

export async function getRequestNetworkIdentity() {
  const requestHeaders = await headers();
  const address = clientNetworkAddress(requestHeaders)
    ?? (process.env.NODE_ENV === "production" ? null : "local-development");
  const secret = process.env.VOTE_IP_HASH_SALT ?? process.env.RATE_LIMIT_HASH_SALT ?? process.env.ANALYTICS_HASH_SALT;
  if (!address || !secret || secret.length < 32) return null;
  return {
    address,
    reactionKeyHash: keyedHash(`product-reaction:${address}`, secret),
  };
}
