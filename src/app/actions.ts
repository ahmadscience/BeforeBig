"use server";

import { draftFromUrl, productSubmissionSchema } from "@/lib/validation";
import { persistProductDraft } from "@/db/products";
import { appConfig } from "@/lib/config";
import { AuthenticationError, assertUser } from "@/lib/auth";
import { consumeRateLimit } from "@/lib/rate-limit";

type DraftResult = ReturnType<typeof draftFromUrl> & {
  href?: string;
};

export type SubmissionState = {
  error?: string;
  message?: string;
  storage?: "saved" | "disabled" | "unavailable";
  draft?: DraftResult;
  signInHref?: string;
};

export async function createProductDraft(_previousState: SubmissionState, formData: FormData): Promise<SubmissionState> {
  const parsed = productSubmissionSchema.safeParse({ url: formData.get("url") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the URL and try again." };

  let draft: ReturnType<typeof draftFromUrl>;
  try {
    draft = draftFromUrl(parsed.data.url);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "That URL could not be used." };
  }

  if (!appConfig.submissionPersistenceEnabled) {
    return {
      draft,
      storage: "disabled",
      message: "Safe preview created. Turso saving stays off until authentication and rate limiting are enabled.",
    };
  }

  try {
    const user = await assertUser();
    const rateLimit = await consumeRateLimit({ action: "product_submit", actorKey: user.id, limit: 10, windowMs: 24 * 60 * 60_000 });
    if (!rateLimit.allowed) {
      return { error: rateLimit.reason === "rate_limited" ? "You have reached today’s submission limit." : "Submission security is not configured yet." };
    }
    const result = await persistProductDraft(draft, user.id);
    if (!result) {
      return {
        draft,
        storage: "unavailable",
        message: "Safe preview created, but persistent storage is not configured yet.",
      };
    }

    return {
      draft: { ...draft, slug: result.product.slug, href: `/${result.product.slug}` },
      storage: "saved",
      message: result.created ? "Draft saved to Turso." : "This domain already has a draft, so we opened the existing record.",
    };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return { error: "Sign in before saving this draft.", signInHref: "/sign-in?returnTo=/submit" };
    }
    return { error: "The draft could not be saved right now. Try again in a moment." };
  }
}
