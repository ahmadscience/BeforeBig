import { MediaError } from "@/lib/media";

/** Bound the body while reading; Content-Length is only an early rejection, never proof of size. */
export async function readBoundedBody(request: Request, maximum: number, timeoutMs = 10000) {
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > maximum)) throw new MediaError("The upload is too large.", 413);
  if (!request.body) throw new MediaError("Choose an image to upload.", 400);
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new MediaError("The upload timed out.", 408)), timeoutMs); });
  try {
    while (true) {
      const part = await Promise.race([reader.read(), deadline]);
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maximum) throw new MediaError("The upload is too large.", 413);
      chunks.push(part.value);
    }
    return Buffer.concat(chunks, size);
  } finally {
    clearTimeout(timer); void reader.cancel().catch(() => {}); reader.releaseLock();
  }
}
