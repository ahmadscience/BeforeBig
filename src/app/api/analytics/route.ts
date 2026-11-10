import { cookies } from "next/headers";
import { analyticsAllowed, privacyCookie } from "@/lib/privacy";
import { NextResponse } from "next/server";
import { analyticsEventSchema } from "@/lib/analytics-types";
import { recordAnalyticsEvent } from "@/lib/analytics";
import { findProductBySlug } from "@/lib/products";

export async function POST(request: Request) {
  if (!analyticsAllowed((await cookies()).get(privacyCookie)?.value, request.headers.get("sec-gpc"))) return new NextResponse(null, {status:204});
  let input;
  try {
    input = analyticsEventSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid analytics event" }, { status: 400 });
  }

  if (input.entitySlug && !(await findProductBySlug(input.entitySlug))) {
    return NextResponse.json({ error: "Unknown analytics entity" }, { status: 400 });
  }

  try {
    await recordAnalyticsEvent(input);
    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
