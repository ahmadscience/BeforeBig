import { z } from "zod";
import { MediaError } from "@/lib/media";

export function assertMediaOrigin(request: Request, appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3247") {
  let expected: string;
  try { expected = new URL(appUrl).origin; } catch { throw new MediaError("Application origin is not configured.", 503); }
  if (request.headers.get("origin") !== expected) throw new MediaError("Upload from this application's own page.", 403);
}
export function mediaErrorResponse(error: unknown) {
  const status = error instanceof MediaError ? error.status : error instanceof z.ZodError ? 422 : 503;
  const message = error instanceof MediaError ? error.message : error instanceof z.ZodError ? error.issues[0]?.message : "Media is temporarily unavailable.";
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store", "Vary": "Cookie" } });
}
