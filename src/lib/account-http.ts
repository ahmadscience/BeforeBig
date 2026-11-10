import { cookies } from "next/headers";
import { z } from "zod";
import { hashOpaqueToken } from "@/lib/security";
import { sessionCookieName } from "@/lib/auth";
import { AccountError } from "@/lib/account";
export const privateHeaders={"Cache-Control":"private, no-store, max-age=0","Vary":"Cookie","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","X-Robots-Tag":"noindex, nofollow"};
export async function accountSessionHash() { const token=(await cookies()).get(sessionCookieName())?.value; if(!token) throw new AccountError("Sign in to manage account data.",401);return hashOpaqueToken(token); }
export function accountOrigin(request:Request) { let origin:string; try{origin=new URL(process.env.NEXT_PUBLIC_APP_URL??"http://127.0.0.1:3247").origin;}catch{throw new AccountError("Application origin is not configured.",503);} if(request.headers.get("origin")!==origin)throw new AccountError("Use this application's own page.",403); }
export function accountErrorResponse(error:unknown) { return Response.json({error:error instanceof AccountError?error.message:error instanceof z.ZodError?error.issues[0]?.message:"Account changes are temporarily unavailable. Try again later."},{status:error instanceof AccountError?error.status:error instanceof z.ZodError?422:503,headers:privateHeaders}); }
