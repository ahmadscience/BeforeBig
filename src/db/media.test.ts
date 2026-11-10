import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import * as schema from "@/db/schema";
import { createMediaStore, type MediaActor } from "@/db/media";
import { cleanupMedia, readMedia, removeMedia, uploadMedia } from "@/lib/media-service";
import type { MediaStorage } from "@/lib/media-storage";

let directory: string; let client: ReturnType<typeof createClient>; let db: ReturnType<typeof drizzle<typeof schema>>; let store: ReturnType<typeof createMediaStore>;
const owner: MediaActor = {id:"owner",role:"founder"}; const other: MediaActor = {id:"other",role:"founder"}; const moderator: MediaActor = {id:"mod",role:"moderator"};
const metadata = {altText:"Project board with tasks",caption:"Main workflow",kind:"screenshot",rightsConfirmed:true};
const bytes = Buffer.from("test canonical bytes"); const details = {width:64,height:64,byteSize:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")};
let objects: Map<string,Buffer>; let storage: MediaStorage;
async function pending() { const row = await store.reserve(owner,"test-product",metadata,details); await storage.put(row.storageKey,bytes); await store.complete(owner,row.id); return row; }
beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(),"beforebig-media-db-")); client = createClient({url:"file:"+join(directory,"test.db")}); db = drizzle(client,{schema});
  for (const migration of readdirSync("drizzle").filter(name => name.endsWith(".sql")).sort()) await client.executeMultiple(readFileSync("drizzle/"+migration,"utf8"));
  await client.execute("PRAGMA foreign_keys=ON");
  await db.insert(schema.users).values([owner,other,moderator].map(actor => ({id:actor.id,email:actor.id+"@example.test",role:actor.role as "founder" | "moderator",createdAt:new Date()})));
  await db.insert(schema.products).values({id:"product",slug:"test-product",name:"Test",websiteUrl:"https://test.example",normalizedDomain:"test.example",tagline:"A test product",description:"Test description",category:"Development",status:"public",createdAt:new Date(),updatedAt:new Date()});
  await db.insert(schema.productMemberships).values({id:"membership",productId:"product",userId:owner.id,role:"owner",createdAt:new Date()});
  store = createMediaStore(db); objects = new Map();
  storage = {put:vi.fn(async(key,data) => {objects.set(key,data);}),get:vi.fn(async(key) => {const data=objects.get(key); if (!data) throw Error("Missing"); return data;}),remove:vi.fn(async(key) => {objects.delete(key);})};
});
afterEach(() => {client.close();rmSync(directory,{recursive:true,force:true});});
describe("media authorization and lifecycle", () => {
  it("keeps pending images private, publishes only approved visible records, and returns minimal DTOs", async () => {
    const row = await pending();
    expect(await store.readable(row.id)).toBeNull(); expect(await store.readable(row.id,other)).toBeNull();
    expect(await store.readable(row.id,owner)).toBeTruthy(); expect(await store.readable(row.id,moderator)).toBeTruthy();
    await expect(readMedia(store,storage,row.id,other)).rejects.toMatchObject({status:404}); expect(storage.get).not.toHaveBeenCalled();
    expect(await store.publicMedia("product")).toEqual([]);
    await store.moderate(moderator,row.id,"approved","");
    expect(await readMedia(store,storage,row.id)).toEqual(bytes);
    const [item] = await store.publicMedia("product"); expect(item.src).toBe("/media/"+row.id); expect(item).not.toHaveProperty("storageKey"); expect(item).not.toHaveProperty("sha256"); expect(item).not.toHaveProperty("uploaderUserId");
    for (const status of ["draft","suspended","discontinued"] as const) {
      await db.update(schema.products).set({status}).where(eq(schema.products.id,"product"));
      expect(await store.readable(row.id)).toBeNull(); expect(await store.publicMedia("product")).toEqual([]);
    }
  });
  it("rejects nonmembers, self-approval, and member moderators; permits separate moderator removal", async () => {
    await expect(store.reserve(other,"test-product",metadata,details)).rejects.toMatchObject({status:404});
    const row = await pending();
    await expect(store.edit(other,row.id,metadata)).rejects.toMatchObject({status:404});
    await expect(store.cover(other,row.id)).rejects.toMatchObject({status:404});
    await expect(store.remove(other,row.id)).rejects.toMatchObject({status:404});
    await expect(store.moderate(owner,row.id,"approved","")).rejects.toMatchObject({status:403});
    await expect(store.moderate({...owner,role:"admin"},row.id,"approved","")).rejects.toThrow("Another moderator");
    await db.insert(schema.productMemberships).values({id:"mod-member",productId:"product",userId:moderator.id,role:"editor",createdAt:new Date()});
    await expect(store.moderate(moderator,row.id,"approved","")).rejects.toThrow("Another moderator");
    await store.moderate(moderator,row.id,"rejected","Contains private data");
    await removeMedia(store,storage,moderator,row.id); expect(await store.readable(row.id,owner)).toBeNull(); expect(objects.size).toBe(0);
  });
  it("preserves approval for no-op edits, requeues changed details, and allows approved cover selection", async () => {
    const a = await pending(); const b = await pending();
    await expect(store.cover(owner,a.id)).rejects.toMatchObject({status:409});
    await store.moderate(moderator,a.id,"approved",""); await store.moderate(moderator,b.id,"approved","");
    await store.cover(owner,b.id); expect((await store.publicMedia("product")).map(item => item.id)).toEqual([b.id,a.id]);
    await store.edit(owner,b.id,metadata); expect((await store.publicMedia("product"))[0].id).toBe(b.id);
    await store.edit(owner,b.id,{...metadata,caption:"Changed content"}); expect((await store.publicMedia("product")).map(item => item.id)).toEqual([a.id]);
    expect((await store.ownedMedia(owner,"test-product"))[0].status).toBe("pending");
  });
  it("requires rights, validates stored details, and caps active reservations at six", async () => {
    await expect(store.reserve(owner,"test-product",{...metadata,rightsConfirmed:false},details)).rejects.toThrow();
    await expect(store.reserve(owner,"test-product",metadata,{...details,width:9999})).rejects.toThrow();
    const rows=[]; for(let index=0;index<6;index++) rows.push(await pending());
    await expect(store.reserve(owner,"test-product",metadata,details)).rejects.toMatchObject({status:409});
    await removeMedia(store,storage,owner,rows[0].id); await pending(); expect((await store.ownedMedia(owner,"test-product"))).toHaveLength(6);
  });
  it("rechecks membership and product state before completing an upload", async () => {
    const reservation = await store.reserve(owner,"test-product",metadata,details);
    await expect(store.remove(owner,reservation.id)).rejects.toMatchObject({status:409});
    await db.update(schema.products).set({status:"suspended"}).where(eq(schema.products.id,"product"));
    await expect(store.complete(owner,reservation.id)).rejects.toMatchObject({status:409});
    await expect(store.reserve(owner,"test-product",metadata,details)).rejects.toMatchObject({status:409});
    await db.update(schema.products).set({status:"public"}).where(eq(schema.products.id,"product"));
    await db.delete(schema.productMemberships).where(eq(schema.productMemberships.id,"membership"));
    await expect(store.complete(owner,reservation.id)).rejects.toMatchObject({status:404});
  });
  it("revokes reads before failed physical deletion and retries tombstones without exposing keys", async () => {
    const row=await pending(); await store.moderate(moderator,row.id,"approved","");
    vi.mocked(storage.remove).mockRejectedValueOnce(Error("private provider error"));
    expect(await removeMedia(store,storage,owner,row.id)).toEqual({cleanupPending:true});
    expect(await store.readable(row.id,owner)).toBeNull(); expect(objects.size).toBe(1);
    expect(await cleanupMedia(store,storage)).toEqual({candidates:1,deleted:0,failed:0}); expect(objects.size).toBe(1);
    expect(await cleanupMedia(store,storage,true)).toEqual({candidates:1,deleted:1,failed:0}); expect(objects.size).toBe(0);
    expect((await cleanupMedia(store,storage,true)).candidates).toBe(0);
  });
  it("collects only stale unfinished uploads and preserves tombstones across hard product deletion", async () => {
    const old=await store.reserve(owner,"test-product",metadata,details); const fresh=await store.reserve(owner,"test-product",metadata,details); const complete=await pending();
    await db.update(schema.productMedia).set({createdAt:new Date(Date.now()-2*60*60_000)}).where(eq(schema.productMedia.id,old.id));
    expect((await cleanupMedia(store,storage)).candidates).toBe(1);
    expect(await store.claimCleanup(fresh.id,new Date(Date.now()-60*60_000))).toBe(false);
    expect(await store.claimCleanup(complete.id,new Date(Date.now()+60*60_000))).toBe(false);
    await cleanupMedia(store,storage,true);
    await db.delete(schema.products).where(eq(schema.products.id,"product"));
    const rows=await db.select().from(schema.productMedia); expect(rows.every(row=>row.productId===null && row.deletedAt!==null)).toBe(true);
    expect(await store.readable(complete.id,owner)).toBeNull(); expect((await cleanupMedia(store,storage,true)).deleted).toBe(2); expect(objects.size).toBe(0);
  });
  it("verifies object integrity on reads and hides already approved images on rejection", async () => {
    const row=await pending(); await store.moderate(moderator,row.id,"approved","");
    objects.set(row.storageKey,Buffer.alloc(bytes.length,1)); await expect(readMedia(store,storage,row.id)).rejects.toMatchObject({status:503});
    await db.update(schema.products).set({status:"suspended"}).where(eq(schema.products.id,"product"));
    await store.moderate(moderator,row.id,"rejected","Rights concern"); expect(await store.readable(row.id)).toBeNull();
  });
  it("uploads real decoded bytes, never originals, and cleans uncertain storage failures", async () => {
    const png=await sharp({create:{width:64,height:64,channels:3,background:"red"}}).png().toBuffer();
    const request=()=>new Request("https://app.example",{method:"POST",headers:{"content-type":"image/png","x-media-metadata":encodeURIComponent(JSON.stringify(metadata))},body:new Uint8Array(png)});
    const result=await uploadMedia(store,storage,owner,"test-product",request()); expect(result.status).toBe("pending");
    expect(await store.readable(result.id)).toBeNull(); expect((await sharp([...objects.values()][0]).metadata()).format).toBe("webp");
    vi.mocked(storage.put).mockImplementationOnce(async(key,data)=>{objects.set(key,data);throw Error("Bucket secret details");});
    vi.mocked(storage.remove).mockRejectedValueOnce(Error("Temporary cleanup failure"));
    await expect(uploadMedia(store,storage,owner,"test-product",request())).rejects.toMatchObject({status:503,message:"The image could not be stored. Please try again later."});
    expect((await store.ownedMedia(owner,"test-product"))).toHaveLength(1);
    expect((await cleanupMedia(store,storage,true)).deleted).toBe(1); expect(objects.size).toBe(1);
  });
});
