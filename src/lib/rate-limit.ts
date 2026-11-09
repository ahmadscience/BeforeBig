import { randomUUID } from "node:crypto";
import { and, count, eq, gte } from "drizzle-orm";
import { getDb } from "@/db/client";
import { rateLimitEvents } from "@/db/schema";
import { keyedHash } from "@/lib/security";

type RateLimitOptions = {
  action: string;
  actorKey: string;
  limit: number;
  windowMs: number;
};

export async function consumeRateLimit({ action, actorKey, limit, windowMs }: RateLimitOptions) {
  const db = getDb();
  if (!db) return { allowed: false, reason: "storage_unavailable" as const };
  const salt = process.env.RATE_LIMIT_HASH_SALT ?? process.env.ANALYTICS_HASH_SALT;
  if (!salt) return { allowed: false, reason: "configuration_missing" as const };

  const actorKeyHash = keyedHash(actorKey, salt);
  const windowStart = new Date(Date.now() - windowMs);
  const [result] = await db
    .select({ value: count() })
    .from(rateLimitEvents)
    .where(and(eq(rateLimitEvents.action, action), eq(rateLimitEvents.actorKeyHash, actorKeyHash), gte(rateLimitEvents.occurredAt, windowStart)));

  if (Number(result?.value ?? 0) >= limit) return { allowed: false, reason: "rate_limited" as const };

  await db.insert(rateLimitEvents).values({
    id: randomUUID(),
    action,
    actorKeyHash,
    occurredAt: new Date(),
  });
  return { allowed: true as const };
}
