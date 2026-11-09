import { z } from "zod";
import { normalizePublicHttpUrl } from "@/lib/validation";

export const platforms = ["Web", "Windows", "macOS", "Linux", "Android", "iOS", "Self-hosted"] as const;

/** Unknown is explicit: free text pricing or tags cannot establish licensing/compatibility. */
export const catalogMetadataSchema = z.object({
  platforms: z.array(z.enum(platforms)).max(platforms.length).default([]),
  licenseType: z.enum(["unknown", "open-source", "proprietary"]).default("unknown"),
  pricingModel: z.enum(["unknown", "free", "freemium", "paid"]).default("unknown"),
  sourceUrl: z.string().trim().max(2048).default("").transform((value, context) => {
    if (!value) return "";
    try { return normalizePublicHttpUrl(value); }
    catch { context.addIssue({ code: "custom", message: "Source URL must be a public HTTP(S) address." }); return z.NEVER; }
  }),
}).refine((value) => value.licenseType !== "open-source" || Boolean(value.sourceUrl), {
  message: "Add a public source repository URL for an open-source claim.", path: ["sourceUrl"],
});
