import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync,readFileSync,readdirSync,rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { beforeEach,afterEach,describe,expect,it,vi } from "vitest";
import * as s from "@/db/schema";
import { createAccountStore } from "@/db/account";
import { createMediaStore } from "@/db/media";
import { hashOpaqueToken,keyedHash } from "@/lib/security";
const dependencies=vi.hoisted(()=>({db:undefined as unknown}));
vi.mock("@/db/client",()=>({getDb:()=>dependencies.db}));
vi.mock("next/headers",()=>({cookies:vi.fn()}));
vi.mock("next/navigation",()=>({redirect:vi.fn()}));
import { consumeMagicLink } from "@/lib/auth";
let directory:string;let client:ReturnType<typeof createClient>;let db:ReturnType<typeof drizzle<typeof s>>;let store:ReturnType<typeof createAccountStore>;
const hash=hashOpaqueToken("session-owner");const otherHash=hashOpaqueToken("session-other");
const choice={confirmation:"DELETE",understood:true,products:"remove"};
const product=(id:string,status:"approved"|"draft"="approved")=>({id,slug:id,name:id,websiteUrl:"https://"+id+".example",normalizedDomain:id+".example",tagline:"Team tools",description:"Product-level description",category:"Development",status,verificationStatus:"domain_verified" as const,createdAt:new Date(),updatedAt:new Date()});
beforeEach(async()=>{
  directory=mkdtempSync(join(tmpdir(),"beforebig-account-"));client=createClient({url:"file:"+join(directory,"test.db")});db=drizzle(client,{schema:s});dependencies.db=db;
  for(const file of readdirSync("drizzle").filter(file=>file.endsWith(".sql")).sort())await client.executeMultiple(readFileSync("drizzle/"+file,"utf8"));await client.execute("PRAGMA foreign_keys=ON");
  await db.insert(s.users).values([{id:"owner",email:"owner@example.test",displayName:"Owner",createdAt:new Date()},{id:"other",email:"other@example.test",createdAt:new Date()}]);
  await db.insert(s.authSessions).values([{id:"current",userId:"owner",tokenHash:hash},{id:"other-session",userId:"owner",tokenHash:hashOpaqueToken("second")},{id:"stranger",userId:"other",tokenHash:otherHash}].map(row=>({...row,createdAt:new Date(),lastSeenAt:new Date(),expiresAt:new Date(Date.now()+86400000)})));
  await db.insert(s.products).values([product("sole"),product("draft","draft"),product("shared"),product("editor-only")]);
  await db.insert(s.productMemberships).values([{id:"sole",productId:"sole",userId:"owner",role:"owner" as const},{id:"draft",productId:"draft",userId:"owner",role:"owner" as const},{id:"shared-owner",productId:"shared",userId:"owner",role:"owner" as const},{id:"shared-editor",productId:"shared",userId:"other",role:"editor" as const},{id:"editor-owner",productId:"editor-only",userId:"other",role:"owner" as const},{id:"editor-only",productId:"editor-only",userId:"owner",role:"editor" as const}].map(row=>({...row,createdAt:new Date()})));
  store=createAccountStore(db);vi.stubEnv("RATE_LIMIT_HASH_SALT","test-dedicated-rate-salt");vi.stubEnv("ADMIN_EMAILS","");
});
afterEach(()=>{client.close();rmSync(directory,{recursive:true,force:true});vi.unstubAllEnvs();});
async function contributions(){
  const now=new Date();
  await db.insert(s.collections).values([{id:"private",ownerUserId:"owner",title:"Owner private collection",visibility:"private",createdAt:now,updatedAt:now},{id:"removed",ownerUserId:"owner",title:"Removed collection",deletedAt:now,createdAt:now,updatedAt:now},{id:"other-private",ownerUserId:"other",title:"Stranger private title",createdAt:now,updatedAt:now}]);
  await db.insert(s.collectionItems).values({id:"save",collectionId:"private",productId:"shared",createdAt:now});
  await db.insert(s.reviews).values([{id:"own-review",productId:"shared",authorUserId:"owner",rating:4,body:"My review",createdAt:now},{id:"other-review",productId:"shared",authorUserId:"other",rating:5,body:"Other private review",createdAt:now}]);
  await db.insert(s.productUpdates).values([{id:"own-update",productId:"shared",authorUserId:"owner",title:"My update",body:"Personal update",createdAt:now},{id:"other-update",productId:"shared",authorUserId:"other",title:"Team update",body:"Collaborator update",createdAt:now}]);
  await db.insert(s.alternativeRecommendations).values({id:"recommendation",sourceProductId:"shared",targetProductId:"editor-only",authorUserId:"owner",reason:"My written recommendation",createdAt:now,updatedAt:now});
  await db.insert(s.alternativeSupports).values({id:"support",recommendationId:"recommendation",userId:"other",createdAt:now});
  await db.insert(s.productVotes).values({id:"vote",productId:"shared",userId:"owner",createdAt:now});
  await db.insert(s.productDownvotes).values({id:"downvote",productId:"editor-only",userId:"owner",reason:"My private downvote reason",createdAt:now,updatedAt:now});
  await db.insert(s.productReactionLocks).values({id:"lock",productId:"shared",userId:"owner",networkKeyHash:"network-not-exported",reactionType:"upvote",createdAt:now,updatedAt:now});
  await db.insert(s.verificationChallenges).values({id:"proof",productId:"shared",userId:"owner",createdAt:now,expiresAt:new Date(Date.now()+1000)});
  await db.insert(s.productEvents).values({id:"event",productId:"shared",actorUserId:"owner",eventType:"edited",metadataJson:'{"private":"my personal payload"}',occurredAt:now});
  await db.insert(s.moderationEvents).values({id:"moderation",productId:"shared",actorUserId:"owner",action:"approve",note:"Internal note on another person",createdAt:now});
  await db.insert(s.authMagicLinks).values({id:"magic",email:"owner@example.test",tokenHash:hashOpaqueToken("old-link"),createdAt:now,expiresAt:new Date(Date.now()+60000)});
  await db.insert(s.rateLimitEvents).values({id:"rate",action:"account_export",actorKeyHash:keyedHash("owner","test-dedicated-rate-salt"),occurredAt:now});
  const media=createMediaStore(db);const uploaded=await media.reserve({id:"owner",role:"founder"},"shared",{altText:"Private screenshot",caption:"Private caption",kind:"screenshot",rightsConfirmed:true},{width:64,height:64,byteSize:10,sha256:"a".repeat(64)});await media.complete({id:"owner",role:"founder"},uploaded.id);return uploaded;
}
describe("account privacy data boundary",()=>{
  it("exports only the signed-in account's content with no authentication/storage secrets or private third-party text",async()=>{
    const image=await contributions();await db.insert(s.products).values(product("outsider","draft"));
    await db.insert(s.productFacts).values([{id:"own-fact",productId:"shared",claimType:"usage",value:"Member-visible fact",claimState:"founder_claimed",createdAt:new Date()},{id:"hidden-fact",productId:"outsider",claimType:"usage",value:"Other secret fact",claimState:"founder_claimed",createdAt:new Date()}]);
    const text=await store.exportData(hash);const data=JSON.parse(text);expect(data.facts).toHaveLength(1);expect(data.facts[0].value).toBe("Member-visible fact");expect(text).not.toContain("Other secret fact");
    expect(data.account.email).toBe("owner@example.test");expect(data.collections).toHaveLength(2);expect(data.reviews[0].body).toBe("My review");expect(data.downvotes[0].reason).toBe("My private downvote reason");expect(data.media[0].downloadPath).toBe("/api/account/media/"+image.id);
    for(const privateValue of ["other@example.test","Stranger private title","Other private review","Collaborator update","Internal note on another person","tokenHash","storageKey","sha256","networkKeyHash",hash,"my personal payload"])expect(text).not.toContain(privateValue);
    await expect(store.exportData("forged-session")).rejects.toMatchObject({status:401});
  });
  it("requires recent active sessions for export, deletion, image downloads and revocation",async()=>{
    await db.update(s.authSessions).set({createdAt:new Date(Date.now()-16*60000)}).where(eq(s.authSessions.id,"current"));
    for(const operation of [()=>store.exportData(hash),()=>store.deleteAccount(hash,choice),()=>store.mediaDownload(hash,randomUUID()),()=>store.revokeOthers(hash)])await expect(operation()).rejects.toMatchObject({status:403});
    expect((await db.select().from(s.users))).toHaveLength(2);
    await db.update(s.authSessions).set({expiresAt:new Date(0)}).where(eq(s.authSessions.id,"current"));await expect(store.identity(hash)).rejects.toMatchObject({status:401});
  });
  it("scopes image export to the uploader, including after membership removal",async()=>{
    const image=await contributions();await expect(store.mediaDownload(otherHash,image.id)).rejects.toMatchObject({status:404});
    await db.delete(s.productMemberships).where(eq(s.productMemberships.id,"shared-owner"));expect((await store.mediaDownload(hash,image.id)).id).toBe(image.id);
    await db.update(s.productMedia).set({deletedAt:new Date()}).where(eq(s.productMedia.id,image.id));await expect(store.mediaDownload(hash,image.id)).rejects.toMatchObject({status:404});
  });
  it("revokes other sessions without affecting this browser or other accounts",async()=>{
    await store.revokeOthers(hash);const sessions=await db.select().from(s.authSessions);expect(sessions.map(row=>row.id).sort()).toEqual(["current","stranger"]);
  });
  it("requires exact destructive confirmation and preserves all data on rejection",async()=>{
    for(const input of [{...choice,confirmation:"delete"},{...choice,understood:false},{...choice,products:"delete-shared"}])await expect(store.deleteAccount(hash,input)).rejects.toThrow();
    expect((await db.select().from(s.products))).toHaveLength(4);
  });
  it("deletes personal data atomically, preserves collaborators, revokes links, and leaves scrubbed cleanup tombstones",async()=>{
    const image=await contributions();const result=await store.deleteAccount(hash,choice);expect(result.removedProducts).toBe(2);expect(result.cleanup[0].id).toBe(image.id);
    expect((await db.select().from(s.users)).map(row=>row.id)).toEqual(["other"]);expect((await db.select().from(s.products)).map(row=>row.id).sort()).toEqual(["editor-only","shared"]);
    expect((await db.select().from(s.reviews)).map(row=>row.id)).toEqual(["other-review"]);expect((await db.select().from(s.productUpdates)).map(row=>row.id)).toEqual(["other-update"]);
    for(const table of [s.authMagicLinks,s.productVotes,s.productDownvotes,s.productReactionLocks,s.verificationChallenges,s.alternativeRecommendations,s.alternativeSupports,s.rateLimitEvents])expect(await db.select().from(table)).toHaveLength(0);
    expect((await db.select().from(s.collections)).map(row=>row.id)).toEqual(["other-private"]);
    const [event]=await db.select().from(s.productEvents);expect(event.actorUserId).toBeNull();expect(event.metadataJson).toBeNull();const [moderation]=await db.select().from(s.moderationEvents);expect(moderation.note).toBeNull();expect(moderation.actorUserId).toBeNull();
    const [media]=await db.select().from(s.productMedia);expect(media.status).toBe("deleted");expect(media.uploaderUserId).toBeNull();expect(media.caption).toBe("");expect(media.altText).toBe("Deleted image");
    const [shared]=await db.select().from(s.products).where(eq(s.products.id,"shared"));expect(shared.verificationStatus).toBe("unverified");expect(shared.status).toBe("public");
    expect(await consumeMagicLink("old-link")).toBeNull();await expect(store.exportData(hash)).rejects.toMatchObject({status:401});
  });
  it("keeps selected public unshared records unclaimed while deleting private drafts and own contributions",async()=>{
    await contributions();await store.deleteAccount(hash,{...choice,products:"keep"});
    expect((await db.select().from(s.products)).map(row=>row.id).sort()).toEqual(["editor-only","shared","sole"]);
    const [sole]=await db.select().from(s.products).where(eq(s.products.id,"sole"));expect(sole.status).toBe("public");expect(sole.verificationStatus).toBe("unverified");
    expect((await db.select().from(s.productMemberships)).some(row=>row.productId==="sole")).toBe(false);
  });
  it("does not clear another owner's verification or let an editor remove their product",async()=>{
    await db.update(s.productMemberships).set({role:"owner"}).where(eq(s.productMemberships.id,"shared-editor"));await store.deleteAccount(hash,choice);
    const [shared]=await db.select().from(s.products).where(eq(s.products.id,"shared"));expect(shared.verificationStatus).toBe("domain_verified");expect(shared.status).toBe("approved");
    expect((await db.select().from(s.products).where(eq(s.products.id,"editor-only")))).toHaveLength(1);
  });
  it("rolls back every change when deletion cannot complete",async()=>{
    await contributions();await client.executeMultiple("CREATE TRIGGER fail_deletion BEFORE DELETE ON users BEGIN SELECT RAISE(ABORT,'forced failure'); END;");
    await expect(store.deleteAccount(hash,choice)).rejects.toThrow();expect((await db.select().from(s.users))).toHaveLength(2);expect((await db.select().from(s.authMagicLinks))).toHaveLength(1);expect((await db.select().from(s.productMedia))[0].status).toBe("pending");expect((await db.select().from(s.products))).toHaveLength(4);
  });
  it("fails large exports explicitly instead of returning a truncated success",async()=>{
    await contributions();await db.update(s.collections).set({description:"x".repeat(2*1024*1024)}).where(eq(s.collections.id,"private"));await expect(store.exportData(hash)).rejects.toMatchObject({status:413});
    await db.update(s.collections).set({description:"small"}).where(eq(s.collections.id,"private"));
    await client.execute("WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<5001) INSERT INTO product_events(id,product_id,actor_user_id,event_type,occurred_at) SELECT 'bulk-'||x,'shared','owner','edit',1 FROM n");
    await expect(store.exportData(hash)).rejects.toMatchObject({status:413});
  });
  it("revokes an in-flight upload immediately but defers physical cleanup until its write grace expires",async()=>{
    const media=createMediaStore(db);const row=await media.reserve({id:"owner",role:"founder"},"shared",{altText:"Inflight image",rightsConfirmed:true},{width:64,height:64,byteSize:10,sha256:"a".repeat(64)});
    await store.deleteAccount(hash,choice);expect(await media.readable(row.id)).toBeNull();
    expect(await media.claimCleanup(row.id,new Date(Date.now()-60*60_000))).toBe(false);
    expect(await media.claimCleanup(row.id,new Date(Date.now()+60*60_000))).toBe(true);
  });
  it("consumes a fresh link once and creates its account/session in the same transaction",async()=>{
    const now=new Date();await db.insert(s.authMagicLinks).values({id:"new-link",email:"new@example.test",tokenHash:hashOpaqueToken("new-link-token"),createdAt:now,expiresAt:new Date(Date.now()+60000)});
    const result=await consumeMagicLink("new-link-token");expect(result?.sessionToken).toBeTruthy();expect(await consumeMagicLink("new-link-token")).toBeNull();
    const [created]=await db.select().from(s.users).where(eq(s.users.email,"new@example.test"));expect(created).toBeTruthy();
    const [session]=await db.select().from(s.authSessions).where(eq(s.authSessions.userId,created.id));expect(session.tokenHash).toBe(hashOpaqueToken(result!.sessionToken));
  });
});
