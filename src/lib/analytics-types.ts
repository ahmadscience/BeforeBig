import { z } from "zod";

export const analyticsEventSchema = z.object({
  eventType: z.enum(["page_view", "product_page_view", "product_outbound_click"]),
  entitySlug: z.string().regex(/^[a-z0-9-]{1,80}$/).optional(),
  surfaceType: z.string().regex(/^[a-z0-9_-]{1,40}$/).optional(),
  sessionId: z.string().regex(/^[a-zA-Z0-9_-]{16,128}$/).optional(),
});

export type AnalyticsEventInput = z.infer<typeof analyticsEventSchema>;

export type ProductAnalytics = {
  beforeBigVisitors: number;
  beforeBigPageViews: number;
  outboundClicks: number;
  googleAnalyticsVisitors: number | null;
  googleAnalyticsClicks: number | null;
};
