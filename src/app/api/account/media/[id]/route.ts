import { createHash } from "node:crypto";
import { z } from "zod";
import { accountSessionHash,accountErrorResponse,privateHeaders } from "@/lib/account-http";
import { getAccountStore } from "@/db/account";
import { getMediaStorage } from "@/lib/media-storage";
import { AccountError } from "@/lib/account";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
  try{
    const hash=await accountSessionHash();const id=z.string().uuid().parse((await params).id);const store=getAccountStore();if(!store)throw new AccountError("Account storage is unavailable.",503);
    const item=await store.mediaDownload(hash,id);const storage=getMediaStorage();if(!storage)throw new AccountError("Image storage is unavailable. Download images before deleting the account.",503);
    const bytes=await storage.get(item.storageKey);if(bytes.length!==item.byteSize||createHash("sha256").update(bytes).digest("hex")!==item.sha256)throw new AccountError("Image is temporarily unavailable.",503);
    return new Response(new Uint8Array(bytes),{headers:{...privateHeaders,"Content-Type":"image/webp","Content-Disposition":'attachment; filename="'+id+'.webp"',"Cross-Origin-Resource-Policy":"same-origin"}});
  }catch(error){return accountErrorResponse(error);}
}
