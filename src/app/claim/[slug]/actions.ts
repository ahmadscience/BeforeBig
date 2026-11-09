"use server";

import { randomUUID } from "node:crypto";
import { resolveTxt } from "node:dns/promises";
import { and, desc, eq, gt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { assertUser } from "@/lib/auth";
import { getDb } from "@/db/client";
import { productEvents, productFacts, productMemberships, products, verificationChallenges } from "@/db/schema";
import { findPersistedProductRowBySlug } from "@/db/products";
import { consumeRateLimit } from "@/lib/rate-limit";
import { verificationRecordName, verificationRecordValue } from "@/lib/verification";

export type VerificationState = {
  error?: string;
  message?: string;
  recordName?: string;
  recordValue?: string;
};

export async function createDomainChallenge(_previous: VerificationState, formData: FormData): Promise<VerificationState> {
  const slug = String(formData.get("slug") ?? "");
  const user = await assertUser();
  const product = await findPersistedProductRowBySlug(slug);
  if (!product) return { error: "Product not found." };

  const rateLimit = await consumeRateLimit({ action: "verification_create", actorKey: user.id, limit: 10, windowMs: 24 * 60 * 60_000 });
  if (!rateLimit.allowed) return { error: "Verification requests are temporarily limited." };

  const db = getDb();
  if (!db) return { error: "Storage is not configured." };
  const now = new Date();
  const [existing] = await db
    .select()
    .from(verificationChallenges)
    .where(and(
      eq(verificationChallenges.productId, product.id),
      eq(verificationChallenges.userId, user.id),
      eq(verificationChallenges.status, "pending"),
      gt(verificationChallenges.expiresAt, now),
    ))
    .orderBy(desc(verificationChallenges.createdAt))
    .limit(1);

  const challengeId = existing?.id ?? randomUUID();
  if (!existing) {
    await db.insert(verificationChallenges).values({
      id: challengeId,
      productId: product.id,
      userId: user.id,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60_000),
      createdAt: now,
    });
  }
  const recordValue = verificationRecordValue(challengeId, product.id, user.id);
  if (!recordValue) return { error: "Domain verification is not configured." };
  return {
    message: "Add this TXT record at your DNS provider, then check it below.",
    recordName: verificationRecordName(product.normalizedDomain),
    recordValue,
  };
}

export async function checkDomainChallenge(_previous: VerificationState, formData: FormData): Promise<VerificationState> {
  const slug = String(formData.get("slug") ?? "");
  const user = await assertUser();
  const product = await findPersistedProductRowBySlug(slug);
  if (!product) return { error: "Product not found." };
  const db = getDb();
  if (!db) return { error: "Storage is not configured." };

  const rateLimit = await consumeRateLimit({ action: "verification_check", actorKey: user.id, limit: 20, windowMs: 60 * 60_000 });
  if (!rateLimit.allowed) return { error: "Verification checks are temporarily limited." };

  const now = new Date();
  const [challenge] = await db
    .select()
    .from(verificationChallenges)
    .where(and(
      eq(verificationChallenges.productId, product.id),
      eq(verificationChallenges.userId, user.id),
      eq(verificationChallenges.status, "pending"),
      gt(verificationChallenges.expiresAt, now),
    ))
    .orderBy(desc(verificationChallenges.createdAt))
    .limit(1);
  if (!challenge) return { error: "Create a fresh verification record first." };

  const expectedValue = verificationRecordValue(challenge.id, product.id, user.id);
  if (!expectedValue) return { error: "Domain verification is not configured." };
  let records: string[];
  try {
    records = (await resolveTxt(verificationRecordName(product.normalizedDomain))).map((parts) => parts.join(""));
  } catch {
    return { error: "The TXT record is not visible yet. DNS changes can take time." };
  }
  if (!records.includes(expectedValue)) return { error: "The TXT record was found, but its value does not match." };

  await db.update(verificationChallenges).set({ status: "verified", verifiedAt: now }).where(eq(verificationChallenges.id, challenge.id));
  await db.insert(productMemberships).values({
    id: randomUUID(),
    productId: product.id,
    userId: user.id,
    role: "owner",
    createdAt: now,
  }).onConflictDoUpdate({
    target: [productMemberships.productId, productMemberships.userId],
    set: { role: "owner" },
  });
  await db.update(products).set({
    verificationStatus: "domain_verified",
    status: product.status === "draft" ? "public" : product.status,
    updatedAt: now,
  }).where(eq(products.id, product.id));
  await db.insert(productFacts).values({
    id: randomUUID(),
    productId: product.id,
    claimType: "domain_ownership",
    value: product.normalizedDomain,
    claimState: "ownership_verified",
    lastVerifiedAt: now,
    createdAt: now,
  });
  await db.insert(productEvents).values({
    id: randomUUID(),
    productId: product.id,
    actorUserId: user.id,
    eventType: "domain_verified",
    occurredAt: now,
  });

  revalidatePath(`/${product.slug}`);
  revalidatePath(`/claim/${product.slug}`);
  revalidatePath("/dashboard");
  return { message: "Domain ownership verified. The public record is now ready for moderation." };
}
