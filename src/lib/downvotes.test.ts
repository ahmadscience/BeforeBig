import { describe, expect, it } from "vitest";
import { downvoteReasonSchema } from "@/lib/downvotes";
import { recaptchaHostnameAllowed } from "@/lib/recaptcha";

describe("reasoned downvotes", () => {
  it("requires a meaningful written reason", () => {
    expect(downvoteReasonSchema.safeParse("Too vague").success).toBe(false);
    expect(downvoteReasonSchema.safeParse("The pricing claim is misleading because the required add-on is omitted.").success).toBe(true);
    expect(downvoteReasonSchema.safeParse("x".repeat(501)).success).toBe(false);
  });

  it("accepts reCAPTCHA results only from an allowlisted hostname", () => {
    expect(recaptchaHostnameAllowed("beforebig.example", ["beforebig.example", "localhost"])).toBe(true);
    expect(recaptchaHostnameAllowed("evil.example", ["beforebig.example", "localhost"])).toBe(false);
    expect(recaptchaHostnameAllowed(undefined, ["beforebig.example"])).toBe(false);
  });
});
