"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { findPersistedProductRowBySlug } from "@/db/products";
import { toggleProductVote } from "@/db/votes";
import { getCurrentUser } from "@/lib/auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestNetworkIdentity } from "@/lib/network-identity";
import { safeReturnPath } from "@/lib/security";
import { productAcceptsVotes } from "@/lib/votes";

const voteInput = z.object({
  slug: z.string().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  returnTo: z.string().max(300),
});

export type VoteActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  count?: number;
  voted?: boolean;
};

export async function toggleVoteAction(_previous: VoteActionState, formData: FormData): Promise<VoteActionState> {
  const parsed = voteInput.safeParse({ slug: formData.get("slug"), returnTo: formData.get("returnTo") });
  if (!parsed.success) return { status: "error", message: "That vote request was invalid." };

  const returnTo = safeReturnPath(parsed.data.returnTo, "/today");
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);

  const product = await findPersistedProductRowBySlug(parsed.data.slug);
  if (!product || !productAcceptsVotes(product.status)) {
    return { status: "error", message: "This product is not open for voting." };
  }

  const network = await getRequestNetworkIdentity();
  if (!network) return { status: "error", message: "Voting security is not configured yet." };
  const [userLimit, networkLimit] = await Promise.all([
    consumeRateLimit({ action: "product_vote_user", actorKey: user.id, limit: 60, windowMs: 60 * 60_000 }),
    consumeRateLimit({ action: "product_vote_network", actorKey: network.address, limit: 120, windowMs: 60 * 60_000 }),
  ]);
  if (!userLimit.allowed || !networkLimit.allowed) {
    return { status: "error", message: "Voting is temporarily limited. Try again later." };
  }

  const result = await toggleProductVote(product.id, user.id, network.reactionKeyHash);
  if (!result) return { status: "error", message: "Voting is unavailable until Turso is configured." };
  if (result.reason === "network_conflict") return { status: "error", message: "This network has already reacted to this product." };

  revalidatePath("/");
  revalidatePath("/today");
  revalidatePath(`/${product.slug}`);
  return { status: "success", count: result.count ?? undefined, voted: result.voted };
}
