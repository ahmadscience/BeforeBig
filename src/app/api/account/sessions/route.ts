import { accountOrigin,accountErrorResponse,privateHeaders } from "@/lib/account-http";
import { accountRequest } from "@/lib/account-request";
export async function POST(request:Request) {try{accountOrigin(request);const {hash,store}=await accountRequest("sessions",10);await store.revokeOthers(hash);return Response.json({message:"Other sessions signed out. This session stays active."},{headers:privateHeaders});}catch(error){return accountErrorResponse(error);}}
