import { NextRequest, NextResponse } from "next/server";
import { consumeMagicLink, sessionCookieName } from "@/lib/auth";
import { appConfig } from "@/lib/config";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const result = token ? await consumeMagicLink(token) : null;
  const destination = result ? new URL(result.returnTo, appConfig.appUrl) : new URL("/sign-in?error=invalid", appConfig.appUrl);
  const response = NextResponse.redirect(destination);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  if (result) {
    response.cookies.set(sessionCookieName(), result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: result.expiresAt,
      priority: "high",
    });
  }
  return response;
}
