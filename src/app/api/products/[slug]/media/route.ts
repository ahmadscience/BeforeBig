import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getMediaStore } from "@/db/media";
import { getMediaStorage } from "@/lib/media-storage";
import { MediaError } from "@/lib/media";
import { assertMediaOrigin, mediaErrorResponse } from "@/lib/media-http";
import { uploadMedia } from "@/lib/media-service";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    assertMediaOrigin(request);
    const user = await getCurrentUser(); if (!user) throw new MediaError("Sign in before uploading images.", 401);
    const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80).parse((await params).slug);
    const store = getMediaStore(); if (!store) throw new MediaError("Database storage is not configured.", 503);
    await store.assertEditable(user, slug);
    if (process.env.MEDIA_UPLOADS_ENABLED !== "true") throw new MediaError("Image uploads are disabled on this instance.", 503);
    const storage = getMediaStorage(); if (!storage) throw new MediaError("Private media storage is not configured.", 503);
    const limit = await consumeRateLimit({ action: "media_upload", actorKey: user.id, limit: 20, windowMs: 60 * 60_000 });
    if (!limit.allowed) throw new MediaError("Uploads are temporarily limited. Try again later.", 429);
    const item = await uploadMedia(store, storage, user, slug, request);
    revalidatePath("/[slug]", "page"); revalidatePath("/dashboard/products/[slug]", "page"); revalidatePath("/admin/moderation");
    return Response.json({ item, message: "Image uploaded for review. It is not public yet." }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return mediaErrorResponse(error); }
}
