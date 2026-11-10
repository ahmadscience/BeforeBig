"use client";

import { browserAnalyticsAllowed } from "@/lib/privacy";
import { useEffect } from "react";

type AnalyticsBeaconProps = {
  eventType: "page_view" | "product_page_view";
  entitySlug?: string;
  surfaceType?: string;
};

function getSessionId() {
  try {
  const key = "beforebig.analytics.session";
  const current = window.sessionStorage.getItem(key);
  if (current) return current;
  const next = `${crypto.randomUUID()}-${Date.now()}`;
  window.sessionStorage.setItem(key, next);
  return next;
  } catch { return undefined; } // Restricted browser storage must not break the page.
}

export function AnalyticsBeacon({ eventType, entitySlug, surfaceType }: AnalyticsBeaconProps) {
  useEffect(() => {
    if (!browserAnalyticsAllowed()) return;
    const payload = JSON.stringify({ eventType, entitySlug, surfaceType, sessionId: getSessionId() });
    const sent = navigator.sendBeacon?.("/api/analytics", new Blob([payload], { type: "application/json" }));
    if (sent) return;
    fetch("/api/analytics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => undefined);
  }, [entitySlug, eventType, surfaceType]);

  return null;
}
