import { and, eq, gt, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as s from "@/db/schema";
import { accountLimits, AccountError, deletionSchema } from "@/lib/account";
import { keyedHash } from "@/lib/security";

type Database = NonNullable<ReturnType<typeof getDb>>;
type Connection = Pick<Database, "select">;
export function getAccountStore() { const db = getDb(); return db ? createAccountStore(db) : null; }

export function createAccountStore(db: Database) {
  async function identity(tokenHash: string, connection: Connection = db, fresh = false) {
    const [row] = await connection.select({ user: s.users, session: s.authSessions }).from(s.authSessions).innerJoin(s.users, eq(s.users.id, s.authSessions.userId))
      .where(and(eq(s.authSessions.tokenHash, tokenHash), gt(s.authSessions.expiresAt, new Date()))).limit(1);
    if (!row) throw new AccountError("Sign in to manage account data.", 401);
    if (fresh && (Date.now() - row.session.createdAt.getTime() > accountLimits.freshMs || row.session.createdAt.getTime() > Date.now())) throw new AccountError("Sign in again to confirm access. Use a link issued within the last 15 minutes.", 403);
    return row;
  }
  async function memberships(userId: string, connection: Connection = db) {
    return connection.select({ product: s.products, role: s.productMemberships.role,
      members: sql<number>`(select count(*) from product_memberships m where m.product_id = ${s.products.id})` }).from(s.productMemberships)
      .innerJoin(s.products, eq(s.products.id, s.productMemberships.productId)).where(eq(s.productMemberships.userId, userId)).limit(accountLimits.rows+1);
  }
  async function summary(tokenHash: string) {
    const { user, session } = await identity(tokenHash);
    const records = await memberships(user.id);
    if(records.length>accountLimits.rows)throw new AccountError("Ask your instance operator to manage this large account.",413);
    const sessions = await db.select({ createdAt: s.authSessions.createdAt, expiresAt: s.authSessions.expiresAt }).from(s.authSessions).where(and(eq(s.authSessions.userId, user.id), gt(s.authSessions.expiresAt, new Date())));
    return { email: user.email, fresh: Date.now() - session.createdAt.getTime() <= accountLimits.freshMs, sessions: sessions.length,
      products: records.map(({ product, role, members }) => ({ id: product.id, name: product.name, slug: product.slug, status: product.status, role, shared: members > 1 })) };
  }
  return {
    identity, summary,
    async exportData(tokenHash: string) {
      // One snapshot; explicit selections avoid exporting tokens, hashes, provider keys, or other users' text.
      return db.transaction(async tx => {
        const { user } = await identity(tokenHash, tx, true);
        const bound = <T>(rows: T[]) => { if (rows.length > accountLimits.rows) throw new AccountError("This account exceeds the self-service export size. Ask your instance operator for a complete export.", 413); return rows; };
        const limit = accountLimits.rows + 1;
        const records = bound(await memberships(user.id, tx));
        const facts=bound(await tx.select({productId:s.productFacts.productId,claimType:s.productFacts.claimType,value:s.productFacts.value,sourceUrl:s.productFacts.sourceUrl,claimState:s.productFacts.claimState,lastVerifiedAt:s.productFacts.lastVerifiedAt,createdAt:s.productFacts.createdAt}).from(s.productFacts).innerJoin(s.productMemberships,eq(s.productMemberships.productId,s.productFacts.productId)).where(eq(s.productMemberships.userId,user.id)).limit(limit));
        const collections = bound(await tx.select({ id:s.collections.id,title:s.collections.title,description:s.collections.description,visibility:s.collections.visibility,deletedAt:s.collections.deletedAt,createdAt:s.collections.createdAt,updatedAt:s.collections.updatedAt }).from(s.collections).where(eq(s.collections.ownerUserId,user.id)).limit(limit));
        const collectionItems = bound(await tx.select({ collectionId:s.collectionItems.collectionId,productId:s.collectionItems.productId,createdAt:s.collectionItems.createdAt }).from(s.collectionItems).innerJoin(s.collections,eq(s.collections.id,s.collectionItems.collectionId)).where(eq(s.collections.ownerUserId,user.id)).limit(limit));
        const reviews = bound(await tx.select({ productId:s.reviews.productId,rating:s.reviews.rating,body:s.reviews.body,status:s.reviews.status,createdAt:s.reviews.createdAt }).from(s.reviews).where(eq(s.reviews.authorUserId,user.id)).limit(limit));
        const recommendations = bound(await tx.select({ id:s.alternativeRecommendations.id,sourceProductId:s.alternativeRecommendations.sourceProductId,targetProductId:s.alternativeRecommendations.targetProductId,reason:s.alternativeRecommendations.reason,status:s.alternativeRecommendations.status,createdAt:s.alternativeRecommendations.createdAt,updatedAt:s.alternativeRecommendations.updatedAt }).from(s.alternativeRecommendations).where(eq(s.alternativeRecommendations.authorUserId,user.id)).limit(limit));
        const supports = bound(await tx.select({ recommendationId:s.alternativeSupports.recommendationId,createdAt:s.alternativeSupports.createdAt }).from(s.alternativeSupports).where(eq(s.alternativeSupports.userId,user.id)).limit(limit));
        const votes = bound(await tx.select({ productId:s.productVotes.productId,createdAt:s.productVotes.createdAt }).from(s.productVotes).where(eq(s.productVotes.userId,user.id)).limit(limit));
        const downvotes = bound(await tx.select({ productId:s.productDownvotes.productId,reason:s.productDownvotes.reason,status:s.productDownvotes.status,createdAt:s.productDownvotes.createdAt }).from(s.productDownvotes).where(eq(s.productDownvotes.userId,user.id)).limit(limit));
        const updates = bound(await tx.select({ productId:s.productUpdates.productId,title:s.productUpdates.title,body:s.productUpdates.body,status:s.productUpdates.status,createdAt:s.productUpdates.createdAt }).from(s.productUpdates).where(eq(s.productUpdates.authorUserId,user.id)).limit(limit));
        const media = bound(await tx.select({ id:s.productMedia.id,productId:s.productMedia.productId,altText:s.productMedia.altText,caption:s.productMedia.caption,kind:s.productMedia.kind,width:s.productMedia.width,height:s.productMedia.height,status:s.productMedia.status,createdAt:s.productMedia.createdAt }).from(s.productMedia).where(and(eq(s.productMedia.uploaderUserId,user.id),isNull(s.productMedia.deletedAt))).limit(limit));
        const events = bound(await tx.select({ productId:s.productEvents.productId,type:s.productEvents.eventType,occurredAt:s.productEvents.occurredAt }).from(s.productEvents).where(eq(s.productEvents.actorUserId,user.id)).limit(limit));
        const verification = bound(await tx.select({ productId:s.verificationChallenges.productId,method:s.verificationChallenges.method,status:s.verificationChallenges.status,createdAt:s.verificationChallenges.createdAt,expiresAt:s.verificationChallenges.expiresAt }).from(s.verificationChallenges).where(eq(s.verificationChallenges.userId,user.id)).limit(limit));
        const sessions = bound(await tx.select({ createdAt:s.authSessions.createdAt,expiresAt:s.authSessions.expiresAt,lastSeenAt:s.authSessions.lastSeenAt }).from(s.authSessions).where(eq(s.authSessions.userId,user.id)).limit(limit));
        const moderation = bound(await tx.select({ productId:s.moderationEvents.productId,action:s.moderationEvents.action,createdAt:s.moderationEvents.createdAt }).from(s.moderationEvents).where(eq(s.moderationEvents.actorUserId,user.id)).limit(limit));
        const result = { format:"beforebig-account", version:1, exportedAt:new Date().toISOString(), account:user, memberships:records.map(({product,role})=>({role,product})), facts,collections,collectionItems,reviews,recommendations,supports,votes,downvotes,updates,events,verification,sessions,moderation,
          media:media.map(item=>({...item,downloadPath:["pending","approved","rejected"].includes(item.status)?`/api/account/media/${item.id}`:null})),
          notes:["Images are separate authenticated downloads. Save them before deleting your account.","Authentication secrets, internal moderation notes, other users' data, and unlinked anonymous/network analytics are excluded."] };
        const json = JSON.stringify(result, null, 2);
        if (Buffer.byteLength(json)>accountLimits.exportBytes) throw new AccountError("This account exceeds the self-service export size. Ask your instance operator for a complete export.",413);
        return json;
      });
    },
    async mediaDownload(tokenHash: string, id: string) {
      const { user } = await identity(tokenHash, db, true);
      const [row] = await db.select().from(s.productMedia).where(and(eq(s.productMedia.id,id),eq(s.productMedia.uploaderUserId,user.id),isNull(s.productMedia.deletedAt),inArray(s.productMedia.status,["pending","approved","rejected"]))).limit(1);
      if (!row) throw new AccountError("Image not found.",404); return row;
    },
    async revokeOthers(tokenHash: string) {
      return db.transaction(async tx => { const { user,session }=await identity(tokenHash,tx,true); await tx.delete(s.authSessions).where(and(eq(s.authSessions.userId,user.id),ne(s.authSessions.id,session.id))); });
    },
    async deleteAccount(tokenHash: string, input: unknown) {
      const choice = deletionSchema.parse(input);
      return db.transaction(async tx => {
        const { user }=await identity(tokenHash,tx,true);
        const records=await memberships(user.id,tx);
        if(records.length>accountLimits.rows)throw new AccountError("Ask your instance operator for complete account deletion.",413);
        const unshared=records.filter(row=>row.role==="owner"&&row.members===1);
        // Private unshared drafts are never published or orphaned by account removal.
        const remove=unshared.filter(({product})=>choice.products==="remove"||!["public","approved"].includes(product.status)).map(row=>row.product.id);
        const now=new Date();
        const mediaWhere=remove.length?or(eq(s.productMedia.uploaderUserId,user.id),inArray(s.productMedia.productId,remove)):eq(s.productMedia.uploaderUserId,user.id);
        const cleanup=await tx.select({id:s.productMedia.id,storageKey:s.productMedia.storageKey}).from(s.productMedia).where(and(mediaWhere,isNull(s.productMedia.storageDeletedAt))).limit(accountLimits.rows+1);
        if(cleanup.length>accountLimits.rows)throw new AccountError("Ask your instance operator for complete account deletion.",413);
        await tx.update(s.productMedia).set({status:"deleted",deletedAt:now,updatedAt:now,altText:"Deleted image",caption:"",moderationNote:null,uploaderUserId:null,moderatedByUserId:null,sha256:"0".repeat(64)}).where(mediaWhere);
        await tx.delete(s.productUpdates).where(eq(s.productUpdates.authorUserId,user.id));
        // Retained audit entries have no account identity or free-form payload left behind.
        await tx.update(s.productEvents).set({actorUserId:null,metadataJson:null}).where(eq(s.productEvents.actorUserId,user.id));
        await tx.update(s.moderationEvents).set({actorUserId:null,note:null}).where(eq(s.moderationEvents.actorUserId,user.id));
        await tx.update(s.productDownvotes).set({moderatedByUserId:null}).where(eq(s.productDownvotes.moderatedByUserId,user.id));
        await tx.update(s.productMedia).set({moderatedByUserId:null,moderationNote:null}).where(eq(s.productMedia.moderatedByUserId,user.id));
        const lostOwner=records.filter(row=>row.role==="owner"&&!remove.includes(row.product.id));
        for(const {product} of lostOwner){
          const [another]=await tx.select({id:s.productMemberships.id}).from(s.productMemberships).where(and(eq(s.productMemberships.productId,product.id),ne(s.productMemberships.userId,user.id),eq(s.productMemberships.role,"owner"))).limit(1);
          if(!another) await tx.update(s.products).set({verificationStatus:"unverified",status:product.status==="approved"?"public":product.status,updatedAt:now}).where(eq(s.products.id,product.id));
        }
        if(remove.length) await tx.delete(s.products).where(inArray(s.products.id,remove));
        await tx.delete(s.authMagicLinks).where(eq(s.authMagicLinks.email,user.email));
        const salt=process.env.RATE_LIMIT_HASH_SALT??process.env.ANALYTICS_HASH_SALT;
        if(salt) await tx.delete(s.rateLimitEvents).where(inArray(s.rateLimitEvents.actorKeyHash,[keyedHash(user.id,salt),keyedHash(user.email,salt)]));
        // Foreign keys cascade sessions, memberships, collections, reviews, reactions and proposals.
        await tx.delete(s.users).where(eq(s.users.id,user.id));
        return { cleanup, removedProducts:remove.length, retainedProducts:records.length-remove.length, message:"Account deleted. Sessions and personal contributions were removed. Private image cleanup may still be pending." };
      });
    },
  };
}
