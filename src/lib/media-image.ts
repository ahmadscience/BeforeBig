import { createHash } from "node:crypto";
import sharp from "sharp";
import { imageSignature, mediaLimits, mediaTypes, MediaError } from "@/lib/media";

export { readBoundedBody } from "@/lib/request-body";

function rejectAnimation(bytes: Buffer, type: string) {
  // APNG's control chunk is checked explicitly: some decoders expose only its first frame.
  if (type === "image/png") {
    let offset = 8;
    while (offset + 12 <= bytes.length) {
      const size = bytes.readUInt32BE(offset);
      if (size > bytes.length - offset - 12) throw new MediaError("The image is truncated or invalid.");
      if (bytes.toString("ascii", offset + 4, offset + 8) === "acTL") throw new MediaError("Animated images are not supported.");
      offset += size + 12;
    }
  }
  if (type === "image/webp") {
    let offset = 12;
    while (offset + 8 <= bytes.length) {
      const size = bytes.readUInt32LE(offset + 4); const kind = bytes.toString("ascii", offset, offset + 4);
      if (size > bytes.length - offset - 8) throw new MediaError("The image is truncated or invalid.");
      if (kind === "ANIM" || kind === "ANMF" || (kind === "VP8X" && size > 0 && (bytes[offset + 8] & 2))) throw new MediaError("Animated images are not supported.");
      offset += 8 + size + (size % 2);
    }
  }
}

// Bound decoder memory per Node process; durable account limits protect across instances.
let activeDecodes = 0;
export async function normalizeMediaImage(bytes: Buffer, declaredType: string) {
  if (!bytes.length || bytes.length > mediaLimits.inputBytes) throw new MediaError("Choose an image no larger than 4 MiB.", 413);
  const type = imageSignature(bytes);
  if (!type || !mediaTypes.includes(declaredType as typeof mediaTypes[number]) || type !== declaredType) throw new MediaError("Use a real PNG, JPEG, or WebP image with the correct file type.", 415);
  rejectAnimation(bytes, type);
  if (activeDecodes >= 2) throw new MediaError("Image processing is busy. Please try again shortly.", 429);
  activeDecodes++;
  try {
    const options = { failOn: "warning" as const, limitInputPixels: mediaLimits.pixels, sequentialRead: true };
    const metadata = await sharp(bytes, options).metadata();
    if (!metadata.width || !metadata.height || metadata.width < 32 || metadata.height < 32 || metadata.width > mediaLimits.dimension || metadata.height > mediaLimits.dimension || metadata.width * metadata.height > mediaLimits.pixels) throw new MediaError("Use an image at least 32 × 32 pixels, at most 8,192 pixels per side, and no more than 12 megapixels.");
    if ((metadata.pages ?? 1) > 1) throw new MediaError("Animated or multi-page images are not supported.");
    const expected = type === "image/jpeg" ? "jpeg" : type === "image/png" ? "png" : "webp";
    if (metadata.format !== expected) throw new MediaError("The decoded image format does not match its type.");
    // A fresh raster is stored, never the source bytes. Sharp strips metadata unless explicitly kept.
    const result = await sharp(bytes, options).rotate().resize({ width: 2560, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 }).timeout({ seconds: 10 }).toBuffer({ resolveWithObject: true });
    if (result.data.length > mediaLimits.outputBytes) throw new MediaError("The processed image is too large. Use a smaller image.", 413);
    return { bytes: result.data, width: result.info.width, height: result.info.height, byteSize: result.data.length, sha256: createHash("sha256").update(result.data).digest("hex") };
  } catch (error) {
    if (error instanceof MediaError) throw error;
    throw new MediaError("The image could not be safely decoded. Try a smaller, non-animated PNG, JPEG, or WebP.");
  } finally { activeDecodes--; }
}
