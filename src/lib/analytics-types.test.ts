import { describe, expect, it } from "vitest";
import { analyticsEventSchema } from "@/lib/analytics-types";

describe("analytics event contract", () => {
  it("accepts a product page view with an anonymous session", () => {
    expect(analyticsEventSchema.parse({
      eventType: "product_page_view",
      entitySlug: "taskpilot",
      surfaceType: "product",
      sessionId: "0123456789abcdef-1234567890",
    })).toMatchObject({ eventType: "product_page_view", entitySlug: "taskpilot" });
  });

  it("rejects an unknown event type", () => {
    expect(analyticsEventSchema.safeParse({ eventType: "user_email" }).success).toBe(false);
  });

  it("rejects unsafe entity slugs", () => {
    expect(analyticsEventSchema.safeParse({ eventType: "product_page_view", entitySlug: "../../users" }).success).toBe(false);
  });
});
