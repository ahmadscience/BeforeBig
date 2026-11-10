import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getMediaStore } from "@/db/media";
import { getMediaStorage } from "@/lib/media-storage";
import { MediaError } from "@/lib/media";
import { mediaErrorResponse } from "@/lib/media-http";
import { readMedia } from "@/lib/media-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const parsed = z.string().uuid().safeParse((await params).id); if (!parsed.success) throw new MediaError("Media not found.", 404);
    const store = getMediaStore(); if (!store) throw new MediaError("Media not found.", 404);
    const actor = await getCurrentUser();
    // Check permissions before touching storage, including a disabled/misconfigured provider.
    if (!await store.readable(parsed.data, actor)) throw new MediaError("Media not found.", 404);
    const storage = getMediaStorage(); if (!storage) throw new MediaError("Media is temporarily unavailable.", 503);
    const bytes = await readMedia(store, storage, parsed.data, actor);
    return new Response(new Uint8Array(bytes), { headers: {
      "Content-Type": "image/webp", "Content-Length": String(bytes.length), "Content-Disposition": 'inline; filename="' + parsed.data + '.webp"',
      "Cache-Control": "private, no-store", "Vary": "Cookie", "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin", "Content-Security-Policy": "default-src 'none'; sandbox",
    } });
  } catch (error) { return mediaErrorResponse(error); }
}
