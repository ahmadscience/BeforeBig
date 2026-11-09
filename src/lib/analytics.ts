import { createHmac, randomUUID } from "node:crypto";
import { and, count, countDistinct, eq } from "drizzle-orm";
import { analyticsEvents } from "@/db/schema";
import { getDb } from "@/db/client";
import type { AnalyticsEventInput } from "@/lib/analytics-types";

function hashSessionId(sessionId: string | undefined) {
  if (!sessionId) return null;
  const secret = process.env.ANALYTICS_HASH_SALT;
  if (!secret) return null;
  return createHmac("sha256", secret).update(sessionId).digest("hex");
}

export async function recordAnalyticsEvent(input: AnalyticsEventInput) {
  const db = getDb();
  if (!db) return;

  await db.insert(analyticsEvents).values({
    id: randomUUID(),
    eventType: input.eventType,
    entitySlug: input.entitySlug,
    surfaceType: input.surfaceType,
    sessionHash: hashSessionId(input.sessionId),
    occurredAt: new Date(),
  });
}

export async function getInternalProductAnalytics(slug: string) {
  const db = getDb();
  if (!db) return null;

  const [visitors, pageViews, outboundClicks] = await Promise.all([
    db
      .select({ value: countDistinct(analyticsEvents.sessionHash) })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.entitySlug, slug), eq(analyticsEvents.eventType, "product_page_view"))),
    db
      .select({ value: count() })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.entitySlug, slug), eq(analyticsEvents.eventType, "product_page_view"))),
    db
      .select({ value: count() })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.entitySlug, slug), eq(analyticsEvents.eventType, "product_outbound_click"))),
  ]);

  return {
    beforeBigVisitors: Number(visitors[0]?.value ?? 0),
    beforeBigPageViews: Number(pageViews[0]?.value ?? 0),
    outboundClicks: Number(outboundClicks[0]?.value ?? 0),
  };
}
