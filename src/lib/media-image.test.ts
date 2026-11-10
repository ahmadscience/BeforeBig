import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { normalizeMediaImage, readBoundedBody } from "@/lib/media-image";
import { mediaLimits } from "@/lib/media";

const raster = (width = 64, height = 64) => sharp({ create: { width, height, channels: 3, background: "#c74625" } });
describe("image normalization", () => {
  it.each(["png", "jpeg", "webp"] as const)("decodes %s bytes and stores a fresh metadata-free WebP", async (format) => {
    const source = await raster().withMetadata({ exif: { IFD0: { Artist: "Private person", Copyright: "Private metadata" } } }).toFormat(format).toBuffer();
    const output = await normalizeMediaImage(source, "image/" + format);
    const metadata = await sharp(output.bytes).metadata();
    expect(metadata.format).toBe("webp"); expect(metadata.exif).toBeUndefined(); expect(metadata.icc).toBeUndefined();
    expect(output.width).toBe(64); expect(output.height).toBe(64); expect(output.byteSize).toBe(output.bytes.length); expect(output.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(output.bytes.equals(source)).toBe(false);
  });
  it("resizes large images, applies orientation, and rejects excessive dimensions/pixels", async () => {
    const resized = await normalizeMediaImage(await raster(3000, 2000).png().toBuffer(), "image/png");
    expect(resized.width).toBe(2400); expect(resized.height).toBe(1600);
    const rotated = await normalizeMediaImage(await raster(64, 128).withMetadata({ orientation: 6 }).jpeg().toBuffer(), "image/jpeg");
    expect([rotated.width, rotated.height]).toEqual([128, 64]);
    for (const [width, height] of [[31, 64], [8193, 32], [4000, 4000]]) await expect(normalizeMediaImage(await raster(width, height).png().toBuffer(), "image/png")).rejects.toThrow();
  });
  it("rejects SVG, GIF, HTML, MIME spoofing, truncated, empty, and oversized input", async () => {
    for (const bytes of [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), Buffer.from("GIF89a"), Buffer.from("<script>alert(1)</script>"), Buffer.from([137,80,78,71,13,10,26,10])]) {
      await expect(normalizeMediaImage(bytes, "image/png")).rejects.toThrow();
    }
    const png = await raster().png().toBuffer();
    await expect(normalizeMediaImage(png, "image/jpeg")).rejects.toMatchObject({ status: 415 });
    await expect(normalizeMediaImage(png, "image/svg+xml")).rejects.toThrow();
    await expect(normalizeMediaImage(Buffer.alloc(0), "image/png")).rejects.toMatchObject({ status: 413 });
    await expect(normalizeMediaImage(Buffer.alloc(mediaLimits.inputBytes + 1), "image/png")).rejects.toMatchObject({ status: 413 });
    await expect(normalizeMediaImage(png.subarray(0, png.length / 2), "image/png")).rejects.toThrow();
  });
  it("rejects animation control chunks even if a decoder would expose only one frame", async () => {
    const png = await raster().png().toBuffer();
    const chunk = Buffer.alloc(20); chunk.writeUInt32BE(8); chunk.write("acTL", 4);
    await expect(normalizeMediaImage(Buffer.concat([png.subarray(0,33), chunk, png.subarray(33)]), "image/png")).rejects.toThrow("Animated");
    const webp = Buffer.alloc(22); webp.write("RIFF"); webp.write("WEBP", 8); webp.write("ANIM",12); webp.writeUInt32LE(2,16);
    await expect(normalizeMediaImage(webp, "image/webp")).rejects.toThrow("Animated");
  });
});
describe("bounded upload stream", () => {
  it("bounds actual bytes with missing or dishonest Content-Length", async () => {
    expect(await readBoundedBody(new Request("https://app.example", { method:"POST", body:"abc" }), 3)).toEqual(Buffer.from("abc"));
    for (const headers of [{}, {"content-length":"1"}, {"content-length":"100"}]) await expect(readBoundedBody(new Request("https://app.example", { method:"POST", body:"abcd", headers: headers as Record<string,string> }), 3)).rejects.toMatchObject({ status:413 });
  });
  it("cancels stalled streams and rejects missing bodies", async () => {
    let cancelled = false;
    const stream = new ReadableStream({ cancel() { cancelled = true; } });
    const request = new Request("https://app.example", { method:"POST", body:stream, duplex:"half" } as RequestInit);
    await expect(readBoundedBody(request, 100, 5)).rejects.toMatchObject({ status:408 });
    expect(cancelled).toBe(true);
    await expect(readBoundedBody(new Request("https://app.example"), 100)).rejects.toMatchObject({ status:400 });
  });
});
