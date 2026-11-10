"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getCommunityStore } from "@/db/community";
import { CommunityError, type CommunityState, idSchema } from "@/lib/community";

const operationSchema = z.enum(["propose", "support", "withdraw", "moderate", "create", "edit", "archive", "restore", "save", "remove"]);

export async function communityAction(_previous: CommunityState, formData: FormData): Promise<CommunityState> {
  let destination: string | undefined;
  let result: CommunityState = {};
  try {
    const operation = operationSchema.parse(formData.get("operation"));
    const user = await getCurrentUser();
    if (!user) return { error: "Sign in to use recommendations and collections." };
    const store = getCommunityStore();
    if (!store) return { error: "Connect your own database to save changes." };
    const limited = await consumeRateLimit({ action: "community_" + operation, actorKey: user.id, limit: operation === "propose" ? 10 : 60, windowMs: 60 * 60_000 });
    if (!limited.allowed) return { error: "Changes are temporarily limited. Please try again later." };
    const input = Object.fromEntries(formData);
    let message = "Changes saved.";
    let href: string | undefined;
    if (operation === "propose") {
      await store.propose(user, input); message = "Recommendation submitted for moderation. It is not public yet.";
    } else if (operation === "support") {
      const supported = await store.toggleSupport(user, idSchema.parse(input.recommendationId));
      message = supported ? "Support added." : "Support removed.";
    } else if (operation === "withdraw") {
      await store.withdraw(user, idSchema.parse(input.recommendationId)); message = "Recommendation withdrawn.";
    } else if (operation === "moderate") {
      await store.moderate(user, idSchema.parse(input.recommendationId), z.enum(["approved", "rejected"]).parse(input.decision));
      message = "Moderation decision saved.";
    } else if (operation === "create") {
      const id = await store.createCollection(user, input); href = "/collections/" + id; message = "Collection created.";
    } else {
      const id = idSchema.parse(input.collectionId);
      if (operation === "edit") await store.editCollection(user, id, input);
      else if (operation === "archive" || operation === "restore") {
        await store.archiveCollection(user, id, operation === "restore");
        message = operation === "restore" ? "Collection restored." : "Collection removed. You can restore it from your collections.";
        href = "/collections";
        if (operation === "archive") destination = href;
      } else {
        const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80).parse(input.productSlug);
        await store.saveProduct(user, id, slug, operation === "remove");
        message = operation === "remove" ? "Product removed from collection." : "Product saved to collection.";
        href = "/collections/" + id;
      }
    }
    revalidatePath("/collections", "layout");
    revalidatePath("/[slug]", "page");
    revalidatePath("/admin/moderation");
    result = { message, href };
  } catch (error) {
    if (error instanceof CommunityError) return { error: error.message };
    if (error instanceof z.ZodError) return { error: error.issues[0]?.message ?? "Check your details." };
    // Provider errors may contain connection details; only a generic response crosses the boundary.
    return { error: "Changes could not be saved. Check your connection and try again." };
  }
  if (destination) redirect("/collections");
  return result;
}
