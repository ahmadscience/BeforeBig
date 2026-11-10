"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getMediaStore } from "@/db/media";
import { getMediaStorage } from "@/lib/media-storage";
import { removeMedia } from "@/lib/media-service";
import { MediaError, type MediaState } from "@/lib/media";

export async function mediaAction(_previous: MediaState, formData: FormData): Promise<MediaState> {
  try {
    const actor = await getCurrentUser(); if (!actor) return { error: "Sign in to manage images." };
    const store = getMediaStore(); if (!store) return { error: "Database storage is not configured." };
    const input = Object.fromEntries(formData);
    const operation = z.enum(["metadata", "remove", "cover", "moderate"]).parse(input.operation);
    const id = z.string().uuid().parse(input.id);
    const limit = await consumeRateLimit({ action: "media_" + operation, actorKey: actor.id, limit: 60, windowMs: 60 * 60_000 });
    if (!limit.allowed) return { error: "Changes are temporarily limited. Try again later." };
    let message = "Changes saved.";
    if (operation === "metadata") { await store.edit(actor, id, input); message = "Image details saved. Changed details require moderation again."; }
    if (operation === "cover") { await store.cover(actor, id); message = "Gallery cover updated."; }
    if (operation === "moderate") {
      await store.moderate(actor, id, z.enum(["approved", "rejected"]).parse(input.decision), z.string().trim().max(500).parse(input.note ?? "")); message = "Media decision saved.";
    }
    if (operation === "remove") {
      let storage = null; try { storage = getMediaStorage(); } catch { /* Hide access even if object storage is misconfigured. */ }
      const result = await removeMedia(store, storage, actor, id);
      message = result.cleanupPending ? "Removed from the gallery. Private storage cleanup is pending an operator retry." : "Image removed from the gallery and storage.";
    }
    revalidatePath("/[slug]", "page"); revalidatePath("/dashboard/products/[slug]", "page"); revalidatePath("/admin/moderation");
    return { message };
  } catch (error) {
    if (error instanceof MediaError) return { error: error.message };
    if (error instanceof z.ZodError) return { error: error.issues[0]?.message ?? "Check the image details." };
    return { error: "Media changes could not be saved. Try again later." };
  }
}
