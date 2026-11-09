"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { submitProductDownvote, withdrawProductDownvote } from "@/db/downvotes";
import { findPersistedProductRowBySlug } from "@/db/products";
import { getCurrentUser } from "@/lib/auth";
import { downvoteReasonSchema } from "@/lib/downvotes";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestNetworkIdentity } from "@/lib/network-identity";
import { safeReturnPath } from "@/lib/security";
import { productAcceptsVotes } from "@/lib/votes";

const slugSchema = z.string().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const submitInput = z.object({
  slug: slugSchema,
  reason: downvoteReasonSchema,
});
const withdrawInput = z.object({ slug: slugSchema, returnTo: z.string().max(300) });

export type DownvoteActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  count?: number;
  downvoted?: boolean;
};

function refreshProductPaths(slug: string) {
  revalidatePath("/");
  revalidatePath("/today");
  revalidatePath(`/${slug}`);
}

export async function submitDownvoteAction(_previous: DownvoteActionState, formData: FormData): Promise<DownvoteActionState> {
  const slugValue = formData.get("slug");
  const parsed = submitInput.safeParse({
    slug: slugValue,
    reason: formData.get("reason"),
  });
  const downvotePath = slugSchema.safeParse(slugValue).success ? `/${String(slugValue)}/downvote` : "/today";
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Complete the written reason." };
  }

  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?returnTo=${encodeURIComponent(downvotePath)}`);
  const product = await findPersistedProductRowBySlug(parsed.data.slug);
  if (!product || !productAcceptsVotes(product.status)) return { status: "error", message: "This product is not open for downvotes." };

  const network = await getRequestNetworkIdentity();
  if (!network) return { status: "error", message: "Reaction security is not configured yet." };
  const [userLimit, networkLimit] = await Promise.all([
    consumeRateLimit({ action: "product_downvote_user", actorKey: user.id, limit: 12, windowMs: 24 * 60 * 60_000 }),
    consumeRateLimit({ action: "product_downvote_network", actorKey: network.address, limit: 20, windowMs: 24 * 60 * 60_000 }),
  ]);
  if (!userLimit.allowed || !networkLimit.allowed) return { status: "error", message: "Downvoting is temporarily limited. Try again later." };

  const result = await submitProductDownvote(product.id, user.id, parsed.data.reason, network.reactionKeyHash);
  if (!result) return { status: "error", message: "Downvoting is unavailable until Turso is configured." };
  if (result.reason === "network_conflict") return { status: "error", message: "This network has already reacted to this product." };
  refreshProductPaths(product.slug);
  redirect(`/${product.slug}?downvoted=1`);
}

export async function withdrawDownvoteAction(_previous: DownvoteActionState, formData: FormData): Promise<DownvoteActionState> {
  const parsed = withdrawInput.safeParse({ slug: formData.get("slug"), returnTo: formData.get("returnTo") });
  if (!parsed.success) return { status: "error", message: "That request was invalid." };
  const returnTo = safeReturnPath(parsed.data.returnTo, "/today");
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  const product = await findPersistedProductRowBySlug(parsed.data.slug);
  if (!product || !productAcceptsVotes(product.status)) return { status: "error", message: "This product is not open for downvotes." };

  const rateLimit = await consumeRateLimit({ action: "product_downvote_withdraw", actorKey: user.id, limit: 60, windowMs: 60 * 60_000 });
  if (!rateLimit.allowed) return { status: "error", message: "This action is temporarily limited." };
  const result = await withdrawProductDownvote(product.id, user.id);
  if (!result) return { status: "error", message: "Downvoting is unavailable until Turso is configured." };
  refreshProductPaths(product.slug);
  return { status: "success", count: result.count, downvoted: false };
}
