import { randomUUID } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { authMagicLinks, authSessions, users } from "@/db/schema";
import { createOpaqueToken, hashOpaqueToken, safeReturnPath } from "@/lib/security";

const SESSION_DAYS = 7;
const MAGIC_LINK_MINUTES = 15;

export type AuthUser = Pick<typeof users.$inferSelect, "id" | "email" | "displayName" | "role">;

export class AuthenticationError extends Error {
  constructor(message = "Authentication required.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export function sessionCookieName() {
  return process.env.NODE_ENV === "production" ? "__Host-beforebig" : "beforebig_session";
}

export async function createMagicLink(email: string, returnTo: string) {
  const db = getDb();
  if (!db) return null;
  const token = createOpaqueToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + MAGIC_LINK_MINUTES * 60_000);
  await db.insert(authMagicLinks).values({
    id: randomUUID(),
    email,
    tokenHash: hashOpaqueToken(token),
    returnTo: safeReturnPath(returnTo),
    expiresAt,
    createdAt: now,
  });
  return { token, expiresAt };
}

export async function consumeMagicLink(token: string) {
  const db = getDb();
  if (!db) return null;
  // Link consumption and session creation serialize with account deletion; old links cannot recreate it.
  return db.transaction(async (tx) => {
    const now = new Date();
    const [link] = await tx
      .update(authMagicLinks)
      .set({ consumedAt: now })
      .where(and(eq(authMagicLinks.tokenHash, hashOpaqueToken(token)), isNull(authMagicLinks.consumedAt), gt(authMagicLinks.expiresAt, now)))
      .returning({ email: authMagicLinks.email, returnTo: authMagicLinks.returnTo });
    if (!link) return null;

    await tx
      .insert(users)
      .values({ id: randomUUID(), email: link.email, createdAt: now })
      .onConflictDoNothing({ target: users.email });
    let [user] = await tx.select().from(users).where(eq(users.email, link.email)).limit(1);
    if (!user) return null;
    const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
    if (adminEmails.includes(user.email) && user.role !== "admin") {
      [user] = await tx.update(users).set({ role: "admin" }).where(eq(users.id, user.id)).returning();
      if (!user) return null;
    }

    const sessionToken = createOpaqueToken();
    const expiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60_000);
    await tx.insert(authSessions).values({
      id: randomUUID(),
      userId: user.id,
      tokenHash: hashOpaqueToken(sessionToken),
      createdAt: now,
      lastSeenAt: now,
      expiresAt,
    });
    return { sessionToken, expiresAt, returnTo: safeReturnPath(link.returnTo) };
  });
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = (await cookies()).get(sessionCookieName())?.value;
  if (!token) return null;
  const db = getDb();
  if (!db) return null;
  const now = new Date();
  const [result] = await db
    .select({ id: users.id, email: users.email, displayName: users.displayName, role: users.role })
    .from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .where(and(eq(authSessions.tokenHash, hashOpaqueToken(token)), gt(authSessions.expiresAt, now)))
    .limit(1);
  return result ?? null;
}

export async function requireUser(returnTo = "/dashboard") {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?returnTo=${encodeURIComponent(safeReturnPath(returnTo))}`);
  return user;
}

export async function assertUser() {
  const user = await getCurrentUser();
  if (!user) throw new AuthenticationError();
  return user;
}

export async function assertModerator() {
  const user = await assertUser();
  if (user.role !== "moderator" && user.role !== "admin") throw new AuthenticationError("Moderator access required.");
  return user;
}

export async function requireModerator(returnTo = "/admin/moderation") {
  const user = await requireUser(returnTo);
  if (user.role !== "moderator" && user.role !== "admin") redirect("/dashboard");
  return user;
}

export async function revokeCurrentSession() {
  const db = getDb();
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName())?.value;
  if (db && token) await db.delete(authSessions).where(eq(authSessions.tokenHash, hashOpaqueToken(token)));
  await clearSessionCookie();
}

/** Match production __Host- cookie requirements even when expiring the cookie. */
export async function clearSessionCookie() {
  (await cookies()).set(sessionCookieName(), "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
}
