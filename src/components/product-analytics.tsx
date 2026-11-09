"use client";

import { useEffect, useState } from "react";
import type { ProductAnalytics } from "@/lib/analytics-types";

type ProductAnalyticsProps = {
  metrics: ProductAnalytics;
  live?: boolean;
};

function formatMetric(value: number | null) {
  return value === null ? "—" : value.toLocaleString("en-US");
}

export function ProductAnalytics({ metrics, live = true }: ProductAnalyticsProps) {
  const [currentMetrics, setCurrentMetrics] = useState(metrics);

  useEffect(() => {
    if (!live) return;
    const slug = window.location.pathname.split("/").filter(Boolean).pop();
    if (!slug) return;
    fetch(`/api/products/${slug}/metrics`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<ProductAnalytics> : null)
      .then((nextMetrics) => { if (nextMetrics) setCurrentMetrics(nextMetrics); })
      .catch(() => undefined);
  }, [live]);

  return (
    <section className="analytics-panel">
      <div className="analytics-heading">
        <div>
          <p className="eyebrow"><span className="live-dot" /> Public traffic</p>
          <h2>Lifetime audience signal</h2>
        </div>
        <span className="muted">{live ? "Aggregated · updated automatically" : "Sample analytics · demo only"}</span>
      </div>
      <div className="analytics-grid">
        <div className="analytics-stat"><strong>{formatMetric(currentMetrics.beforeBigVisitors)}</strong><span>BeforeBig visitors</span><small>Unique sessions on this record</small></div>
        <div className="analytics-stat"><strong>{formatMetric(currentMetrics.outboundClicks)}</strong><span>Product clicks</span><small>Clicks from BeforeBig to the product</small></div>
        <div className="analytics-stat"><strong>{formatMetric(currentMetrics.googleAnalyticsVisitors)}</strong><span>GA4 visitors</span><small>{currentMetrics.googleAnalyticsVisitors === null ? "Connect GA4 to show" : "Reported by Google Analytics"}</small></div>
        <div className="analytics-stat"><strong>{formatMetric(currentMetrics.googleAnalyticsClicks)}</strong><span>GA4 product clicks</span><small>{currentMetrics.googleAnalyticsClicks === null ? "Connect GA4 to show" : "Reported by Google Analytics"}</small></div>
      </div>
      <p className="analytics-note">Product clicks measure a visit from BeforeBig to the listed website. They do not prove that the destination finished loading or expose the destination&apos;s own visitors.</p>
    </section>
  );
}
