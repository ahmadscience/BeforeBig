import { z } from "zod";

export const mediaLimits = { inputBytes: 4 * 1024 * 1024, outputBytes: 2 * 1024 * 1024, pixels: 12_000_000, dimension: 8192, items: 6 } as const;
export const mediaTypes = ["image/png", "image/jpeg", "image/webp"] as const;
export const mediaMetadataSchema = z.object({
  altText: z.string().trim().min(3, "Describe the image in at least 3 characters.").max(200),
  caption: z.string().trim().max(300).default(""),
  kind: z.enum(["screenshot", "image"]).default("screenshot"),
});
export const mediaUploadMetadataSchema = mediaMetadataSchema.extend({ rightsConfirmed: z.literal(true, { error: "Confirm that you have permission to publish this image." }) });
export const storedMediaDetailsSchema = z.object({
  width: z.number().int().min(1).max(2560), height: z.number().int().min(1).max(1600),
  byteSize: z.number().int().min(1).max(mediaLimits.outputBytes), sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
export type MediaMetadata = z.infer<typeof mediaMetadataSchema>;
export type MediaItem = { id: string; src: string; altText: string; caption: string; kind: "screenshot" | "image"; width: number; height: number; status: string; position: number; moderationNote?: string | null };
export type MediaState = { error?: string; message?: string };
export class MediaError extends Error { constructor(message: string, public status = 422) { super(message); } }

export function imageSignature(bytes: Uint8Array): typeof mediaTypes[number] | null {
  if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((value, index) => bytes[index] === value)) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4)) === "RIFF" && String.fromCharCode(...bytes.slice(8,12)) === "WEBP") return "image/webp";
  return null;
}
export function mediaObjectKey(id: string) {
  if (!z.string().uuid().safeParse(id).success) throw new MediaError("Invalid media identifier.", 400);
  return "beforebig/media/" + id + ".webp";
}
export function assertMediaKey(key: string) {
  const match = /^beforebig\/media\/([0-9a-f-]{36})\.webp$/.exec(key);
  if (!match || mediaObjectKey(match[1]) !== key) throw new MediaError("Invalid storage key.", 400);
  return match[1];
}
