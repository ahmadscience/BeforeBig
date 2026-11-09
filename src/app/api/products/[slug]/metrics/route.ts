import { NextResponse } from "next/server";
import { getInternalProductAnalytics } from "@/lib/analytics";
import { getGoogleAnalyticsProductMetrics } from "@/lib/google-analytics";
import { findProductBySlug } from "@/lib/products";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await findProductBySlug(slug);
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const internal = await getSafely(() => getInternalProductAnalytics(slug));
  const google = await getSafely(() => getGoogleAnalyticsProductMetrics(slug)) ?? { googleAnalyticsVisitors: null, googleAnalyticsClicks: null };
  const fallback = product.stats;
  const response = {
    beforeBigVisitors: internal?.beforeBigVisitors ?? fallback?.views ?? 0,
    beforeBigPageViews: internal?.beforeBigPageViews ?? fallback?.views ?? 0,
    outboundClicks: internal?.outboundClicks ?? fallback?.qualifiedVisits ?? 0,
    ...google,
  };
  return NextResponse.json(response, { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=300" } });
}

async function getSafely<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch {
    return null;
  }
}
