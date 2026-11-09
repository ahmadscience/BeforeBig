import { NextResponse } from "next/server";
import { recordAnalyticsEvent } from "@/lib/analytics";
import { findProductBySlug } from "@/lib/products";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await findProductBySlug(slug);
  if (!product) return NextResponse.redirect(new URL("/today", request.url), 302);

  await recordAnalyticsEvent({ eventType: "product_outbound_click", entitySlug: slug, sessionId: undefined });
  return NextResponse.redirect(product.websiteUrl, 302);
}
