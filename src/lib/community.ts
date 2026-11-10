import { z } from "zod";

const slug = z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80);
export const recommendationSchema = z.object({
  sourceSlug: slug,
  targetSlug: slug,
  reason: z.string().trim().min(30, "Explain the alternative in at least 30 characters.").max(1000),
}).refine((value) => value.sourceSlug !== value.targetSlug, { message: "Choose a different product.", path: ["targetSlug"] });

export const collectionSchema = z.object({
  title: z.string().trim().min(3, "Use at least 3 characters for the title.").max(80),
  description: z.string().trim().max(500).default(""),
  visibility: z.enum(["private", "public"]).default("private"),
});
export const idSchema = z.string().uuid();
export type CommunityState = { error?: string; message?: string; href?: string };
export class CommunityError extends Error {}

/** Only approved records can acquire public community associations. */
export function isCommunityProduct(status: string) { return status === "approved"; }
