import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createCommunityStore } from "@/db/community";
import * as schema from "@/db/schema";

let databaseDirectory: string;
let client: ReturnType<typeof createClient>;
let db: ReturnType<typeof drizzle<typeof schema>>;
let store: ReturnType<typeof createCommunityStore>;
const alice = { id: "alice", role: "scout" };
const bob = { id: "bob", role: "scout" };
const moderator = { id: "moderator", role: "moderator" };
const input = { sourceSlug: "source", targetSlug: "target", reason: "Both tools help small teams plan releases, but this alternative emphasizes a simple checklist." };

beforeEach(async () => {
  databaseDirectory = mkdtempSync(join(tmpdir(), "beforebig-community-"));
  client = createClient({ url: "file:" + join(databaseDirectory, "test.db") });
  // Run checked migrations, not schema push: tests also cover fresh-checkout SQL compatibility.
  for (const name of readdirSync("drizzle").filter((name) => name.endsWith(".sql")).sort()) await client.executeMultiple(readFileSync("drizzle/" + name, "utf8"));
  await client.execute("PRAGMA foreign_keys = ON");
  db = drizzle(client, { schema });
  store = createCommunityStore(db);
  for (const actor of [alice, bob, moderator]) await db.insert(schema.users).values({ ...actor, email: actor.id + "@example.test", role: actor.role as "scout" | "moderator", createdAt: new Date() });
  for (const slug of ["source", "target", "draft"]) await db.insert(schema.products).values({ id: slug, slug, name: slug, websiteUrl: "https://" + slug + ".example", normalizedDomain: slug + ".example", tagline: "A useful product", description: "A useful product for tests with fictional data only.", category: "Testing", status: slug === "draft" ? "draft" : "approved", createdAt: new Date(), updatedAt: new Date() });
});
afterEach(() => { client.close(); rmSync(databaseDirectory, { recursive: true, force: true }); });

describe("community alternatives", () => {
  it("keeps pending reasons private and forbids self, draft, and duplicate recommendations", async () => {
    await expect(store.propose(alice, { ...input, targetSlug: "source" })).rejects.toThrow();
    await expect(store.propose(alice, { ...input, targetSlug: "draft" })).rejects.toThrow("approved product");
    await store.propose(alice, input);
    expect(await store.listAlternatives("source")).toEqual([]);
    await expect(store.propose(bob, input)).rejects.toThrow("already been proposed");
    expect((await store.ownRecommendations("source", alice.id))[0].status).toBe("pending");
  });
  it("requires separate moderator approval and enforces support uniqueness and withdrawal", async () => {
    const id = await store.propose(alice, input);
    await expect(store.queue(bob)).rejects.toThrow("Moderator access");
    expect(await store.queue(moderator)).toHaveLength(1);
    await expect(store.moderate(bob, id, "approved")).rejects.toThrow("Moderator access");
    await expect(store.moderate({ ...alice, role: "admin" }, id, "approved")).rejects.toThrow("Another moderator");
    await expect(store.toggleSupport(bob, id)).rejects.toThrow("not available");
    await store.moderate(moderator, id, "approved");
    await expect(store.toggleSupport(alice, id)).rejects.toThrow("Authors");
    expect(await store.toggleSupport(bob, id)).toBe(true);
    const [publicRow] = await store.listAlternatives("source", bob.id);
    expect(publicRow).toMatchObject({ supportCount: 1, viewerSupported: true, reason: input.reason });
    expect(publicRow).not.toHaveProperty("authorId");
    expect(await store.toggleSupport(bob, id)).toBe(false);
    await store.toggleSupport(bob, id);
    await expect(store.withdraw(bob, id)).rejects.toThrow("not found");
    await store.withdraw(alice, id);
    expect(await store.listAlternatives("source")).toEqual([]);
    expect(await db.select().from(schema.alternativeSupports)).toHaveLength(0);
    await store.propose(alice, { ...input, reason: input.reason + " Updated after withdrawal." });
    expect((await store.ownRecommendations("source", alice.id))[0].status).toBe("pending");
  });
  it("hides recommendations when either product loses approval and blocks conflicting owners", async () => {
    await db.insert(schema.productMemberships).values({ id: randomUUID(), productId: "target", userId: bob.id, createdAt: new Date() });
    await expect(store.propose(bob, input)).rejects.toThrow("Owners");
    const id = await store.propose(alice, input);
    await store.moderate(moderator, id, "approved");
    await expect(store.toggleSupport(bob, id)).rejects.toThrow("owners");
    await db.update(schema.products).set({ status: "suspended" }).where(eq(schema.products.id, "target"));
    expect(await store.listAlternatives("source")).toEqual([]);
    await expect(store.toggleSupport(moderator, id)).rejects.toThrow("not available");
  });
});

describe("saved collections", () => {
  it("defaults to private and enforces visibility and owner-only writes at the data boundary", async () => {
    const id = await store.createCollection(alice, { title: "Private shortlist" });
    await store.saveProduct(alice, id, "source");
    expect(await store.readCollection(id)).toBeNull();
    expect(await store.readCollection(id, bob.id)).toBeNull();
    expect(await store.publicCollections()).toEqual([]);
    await expect(store.saveProduct(bob, id, "target")).rejects.toThrow("unavailable");
    await expect(store.editCollection(bob, id, { title: "Stolen", visibility: "public" })).rejects.toThrow("unavailable");
    await expect(store.archiveCollection(bob, id)).rejects.toThrow("not found");
    expect(await store.readCollection(id, alice.id)).toMatchObject({ title: "Private shortlist", own: true, items: [{ slug: "source" }] });
  });
  it("shares deliberately, deduplicates saves, removes items, and hides suspended records", async () => {
    const id = await store.createCollection(alice, { title: "Release tools", visibility: "public" });
    await store.saveProduct(alice, id, "source"); await store.saveProduct(alice, id, "source");
    expect((await store.readCollection(id))?.items).toHaveLength(1);
    expect(await store.readCollection(id)).not.toHaveProperty("ownerUserId");
    await expect(store.saveProduct(alice, id, "draft")).rejects.toThrow("approved product");
    await db.update(schema.products).set({ status: "suspended" }).where(eq(schema.products.id, "source"));
    expect((await store.readCollection(id))?.items).toEqual([]);
    await store.saveProduct(alice, id, "source", true);
    expect(await db.select().from(schema.collectionItems)).toHaveLength(0);
    await store.editCollection(alice, id, { title: "Now private", visibility: "private" });
    expect(await store.readCollection(id, bob.id)).toBeNull();
  });
  it("archives public collections immediately, restores them, and keeps access checks", async () => {
    const id = await store.createCollection(alice, { title: "Team collection", visibility: "public" });
    await store.saveProduct(alice, id, "source"); await store.archiveCollection(alice, id);
    expect(await store.readCollection(id, alice.id)).toBeNull();
    expect(await store.publicCollections()).toEqual([]);
    await expect(store.archiveCollection(bob, id, true)).rejects.toThrow("not found");
    await expect(store.saveProduct(alice, id, "target")).rejects.toThrow("unavailable");
    await store.archiveCollection(alice, id, true);
    expect((await store.readCollection(id))?.items).toHaveLength(1);
    expect(await store.publicCollections()).toHaveLength(1);
  });
});


describe("collection capacity", () => {
  it("limits active collections and restoration without counting removed lists", async () => {
    const ids = Array.from({ length: 50 }, () => randomUUID());
    await db.insert(schema.collections).values(ids.map((id) => ({ id, ownerUserId: alice.id, title: "Saved tools", createdAt: new Date(), updatedAt: new Date() })));
    await expect(store.createCollection(alice, { title: "One too many" })).rejects.toThrow("50 active");
    await store.archiveCollection(alice, ids[0]);
    await store.createCollection(alice, { title: "Replacement" });
    await expect(store.archiveCollection(alice, ids[0], true)).rejects.toThrow("before restoring");
  });
  it("allows duplicate saves at capacity but rejects a new item", async () => {
    const id = await store.createCollection(alice, { title: "Full collection" });
    const productIds = Array.from({ length: 100 }, (_, index) => "item" + index);
    await db.insert(schema.products).values(productIds.map((productId) => ({ id: productId, slug: productId, name: "Fixture", websiteUrl: "https://" + productId + ".example", normalizedDomain: productId + ".example", tagline: "Test fixture", description: "Test fixture", category: "Test", status: "approved" as const, createdAt: new Date(), updatedAt: new Date() })));
    await db.insert(schema.collectionItems).values(productIds.map((productId) => ({ id: randomUUID(), collectionId: id, productId, createdAt: new Date() })));
    await store.saveProduct(alice, id, "item0");
    await expect(store.saveProduct(alice, id, "source")).rejects.toThrow("100 products");
    await store.saveProduct(alice, id, "item0", true);
    await store.saveProduct(alice, id, "source");
    expect((await store.readCollection(id, alice.id))?.items).toHaveLength(100);
  });
});
