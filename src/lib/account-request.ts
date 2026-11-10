import { getAccountStore } from "@/db/account";
import { accountSessionHash } from "@/lib/account-http";
import { AccountError } from "@/lib/account";
import { consumeRateLimit } from "@/lib/rate-limit";
export async function accountRequest(action:string,limit:number) {
  const hash=await accountSessionHash();const store=getAccountStore();if(!store)throw new AccountError("Account storage is unavailable.",503);
  const {user}=await store.identity(hash,undefined,true);
  const rate=await consumeRateLimit({action:"account_"+action,actorKey:user.id,limit,windowMs:60*60_000});
  if(!rate.allowed)throw new AccountError("Account requests are temporarily limited. Try again later.",429);
  return {hash,store};
}
