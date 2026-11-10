import { accountOrigin,accountErrorResponse,privateHeaders } from "@/lib/account-http";
import { accountRequest } from "@/lib/account-request";
export const runtime="nodejs";
export async function POST(request:Request) {
  try{accountOrigin(request);const {hash,store}=await accountRequest("export",5);const json=await store.exportData(hash);return new Response(json,{headers:{...privateHeaders,"Content-Type":"application/json; charset=utf-8","Content-Disposition":'attachment; filename="beforebig-account.json"'}});}catch(error){return accountErrorResponse(error);}
}
