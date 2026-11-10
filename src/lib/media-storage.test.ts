import { mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { localMediaStorage, getMediaStorage, mediaUploadAvailability, s3MediaStorage } from "@/lib/media-storage";
import { mediaLimits, mediaObjectKey } from "@/lib/media";

describe("private storage", () => {
  it("uses exclusive private files, rejects traversal/symlinks, and deletes idempotently", async () => {
    const directory = await mkdtemp(join(tmpdir(), "beforebig-media-"));
    try {
      const storage = localMediaStorage(directory); const id = randomUUID(); const key = mediaObjectKey(id); const bytes = Buffer.from("canonical image");
      await storage.put(key, bytes); expect(await storage.get(key)).toEqual(bytes);
      expect((await stat(join(directory,id+".webp"))).mode & 0o777).toBe(0o600);
      await expect(storage.put(key, bytes)).rejects.toThrow();
      for (const bad of ["../secret", "beforebig/media/../../secret", "beforebig/media/not-an-id.webp"]) {
        await expect(storage.get(bad)).rejects.toThrow(); await expect(storage.put(bad, bytes)).rejects.toThrow(); await expect(storage.remove(bad)).rejects.toThrow();
      }
      const linkId = randomUUID(); await symlink(join(directory,id+".webp"), join(directory,linkId+".webp"));
      await expect(storage.get(mediaObjectKey(linkId))).rejects.toThrow();
      await expect(storage.put(mediaObjectKey(linkId), bytes)).rejects.toThrow();
      await storage.remove(mediaObjectKey(linkId)); expect(await readFile(join(directory,id+".webp"))).toEqual(bytes);
      await writeFile(join(directory,id+".webp"), Buffer.alloc(mediaLimits.outputBytes+1));
      await expect(storage.get(key)).rejects.toThrow();
      await storage.remove(key); await storage.remove(key);
      await symlink(directory, join(directory,"linked"));
      await expect(localMediaStorage(join(directory,"linked")).put(mediaObjectKey(randomUUID()), bytes)).rejects.toThrow("symbolic");
      expect(() => localMediaStorage("public/uploads")).toThrow();
    } finally { await rm(directory,{recursive:true,force:true}); }
  });
  it("fails closed without configured storage and disallows local production files", () => {
    expect(getMediaStorage({})).toBeNull(); expect(mediaUploadAvailability({}).enabled).toBe(false);
    expect(() => getMediaStorage({ MEDIA_STORAGE_DRIVER:"local", NODE_ENV:"production" })).toThrow();
    expect(() => getMediaStorage({ MEDIA_STORAGE_DRIVER:"s3" })).toThrow();
    const env = { MEDIA_STORAGE_DRIVER:"s3", MEDIA_S3_BUCKET:"private-test-bucket", MEDIA_S3_REGION:"auto", MEDIA_S3_ACCESS_KEY_ID:"test", MEDIA_S3_SECRET_ACCESS_KEY:"test" };
    for (const endpoint of ["http://localhost", "https://user:pass@example.com", "https://example.com/path", "https://example.com/?token=secret"]) expect(() => getMediaStorage({...env,MEDIA_S3_ENDPOINT:endpoint})).toThrow();
    expect(getMediaStorage({...env,MEDIA_S3_ENDPOINT:"https://storage.example"})).toBeTruthy();
  });
  it("writes only canonical keys to S3 without public ACLs and bounds returned streams", async () => {
    const send = vi.fn().mockResolvedValue({}); const storage = s3MediaStorage({send} as unknown as S3Client,"private-bucket");
    const key = mediaObjectKey(randomUUID()); const bytes = Buffer.from("image");
    await storage.put(key,bytes);
    expect(send.mock.calls[0][0]).toBeInstanceOf(PutObjectCommand);
    expect(send.mock.calls[0][0].input).toMatchObject({Key:key,ContentType:"image/webp",CacheControl:"private, no-store"});
    expect(send.mock.calls[0][0].input.ACL).toBeUndefined();
    send.mockResolvedValueOnce({ Body:Readable.from([bytes]) }); expect(await storage.get(key)).toEqual(bytes);
    expect(send.mock.calls[1][0]).toBeInstanceOf(GetObjectCommand);
    const oversize = Readable.from([Buffer.alloc(mediaLimits.outputBytes+1)]);
    send.mockResolvedValueOnce({ Body:oversize }); await expect(storage.get(key)).rejects.toThrow(); expect(oversize.destroyed).toBe(true);
    const advertised = Readable.from([bytes]); send.mockResolvedValueOnce({ Body:advertised,ContentLength:mediaLimits.outputBytes+1 });
    await expect(storage.get(key)).rejects.toThrow(); expect(advertised.destroyed).toBe(true);
    await storage.remove(key); expect(send.mock.lastCall?.[0]).toBeInstanceOf(DeleteObjectCommand);
  });
});
