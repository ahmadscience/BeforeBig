import { cookies } from "next/headers";
import { z } from "zod";
import { privacyCookie } from "@/lib/privacy";
import { accountOrigin,accountErrorResponse,privateHeaders } from "@/lib/account-http";
import { readBoundedBody } from "@/lib/request-body";
import { AccountError } from "@/lib/account";
export async function POST(request:Request) {
  try{
    accountOrigin(request);
    let input:unknown;try{input=JSON.parse((await readBoundedBody(request,256)).toString("utf8"));}catch{throw new AccountError("Choose an analytics preference.",400);}
    const {choice}=z.object({choice:z.enum(["allow","deny"])}).parse(input);
    (await cookies()).set(privacyCookie,choice,{path:"/",maxAge:365*24*60*60,sameSite:"lax",secure:process.env.NODE_ENV==="production"});
    return Response.json({message:"Browser preference saved."},{headers:privateHeaders});
  }catch(error){return accountErrorResponse(error);}
}
