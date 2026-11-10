import { getMediaStore } from "@/db/media";
import { getMediaStorage } from "@/lib/media-storage";
import { privacyCookie } from "@/lib/privacy";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { clearSessionCookie } from "@/lib/auth";
import { accountOrigin,accountErrorResponse,privateHeaders } from "@/lib/account-http";
import { accountRequest } from "@/lib/account-request";
import { readBoundedBody } from "@/lib/request-body";
import { AccountError } from "@/lib/account";
export const runtime="nodejs";
export const maxDuration=60;
export async function POST(request:Request) {
  try{
    accountOrigin(request);const {hash,store}=await accountRequest("delete",5);
    let input:unknown;try{input=JSON.parse((await readBoundedBody(request,2048)).toString("utf8"));}catch{throw new AccountError("Provide valid deletion confirmation.",400);}
    const result=await store.deleteAccount(hash,input);
    await clearSessionCookie();const cookieStore=await cookies();cookieStore.set(privacyCookie,"deny",{path:"/",maxAge:365*24*60*60,sameSite:"lax",secure:process.env.NODE_ENV==="production"});revalidatePath("/","layout");
    // Revoke access transactionally first. Attempt a bounded batch; tombstones survive failures.
    const {cleanup,...publicResult}=result;let cleaned=0;
    try{const storage=getMediaStorage();const media=getMediaStore();if(storage&&media){for(let index=0;index<Math.min(cleanup.length,4);index+=2){await Promise.all(cleanup.slice(index,index+2).map(async item=>{try{if(await media.claimCleanup(item.id,new Date(Date.now()-60*60_000))){await storage.remove(item.storageKey);await media.markStorageDeleted(item.id);cleaned++;}}catch{/* Operator retries retain the key. */}}));}}}catch{/* Account deletion is already committed. */}
    return Response.json({...publicResult,imagesPendingCleanup:cleanup.length-cleaned},{headers:privateHeaders});
  }catch(error){return accountErrorResponse(error);}
}
