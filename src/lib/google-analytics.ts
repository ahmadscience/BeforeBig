import { createSign } from "node:crypto";

type GoogleAnalyticsReport = { rows?: Array<{ metricValues?: Array<{ value?: string }> }> };

function base64Url(value: string) {
  return Buffer.from(value).toString("base64url");
}

async function getAccessToken() {
  const clientEmail = process.env.GA_CLIENT_EMAIL;
  const privateKey = process.env.GA_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) return null;

  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(JSON.stringify({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: issuedAt,
    exp: issuedAt + 3600,
  }));
  const unsignedToken = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  const assertion = `${unsignedToken}.${signer.sign(privateKey, "base64url")}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { access_token?: string };
  return payload.access_token ?? null;
}

async function runReport(body: Record<string, unknown>) {
  const propertyId = process.env.GA_PROPERTY_ID;
  if (!propertyId) return null;
  const accessToken = await getAccessToken();
  if (!accessToken) return null;

  const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as GoogleAnalyticsReport;
}

function firstMetricValue(report: GoogleAnalyticsReport | null) {
  if (!report) return null;
  return Number(report.rows?.[0]?.metricValues?.[0]?.value ?? 0);
}

export async function getGoogleAnalyticsProductMetrics(slug: string) {
  if (!process.env.GA_PROPERTY_ID || !process.env.GA_CLIENT_EMAIL || !process.env.GA_PRIVATE_KEY) {
    return { googleAnalyticsVisitors: null, googleAnalyticsClicks: null };
  }

  const pagePath = `/${slug}`;
  const baseRequest = {
    dateRanges: [{ startDate: "2020-01-01", endDate: "today" }],
    dimensionFilter: { filter: { fieldName: "pagePath", stringFilter: { matchType: "EXACT", value: pagePath } } },
  };
  const [visitorReport, clickReport] = await Promise.all([
    runReport({ ...baseRequest, metrics: [{ name: "activeUsers" }] }),
    runReport({
      ...baseRequest,
      metrics: [{ name: "eventCount" }],
      dimensionFilter: {
        andGroup: {
          expressions: [
            baseRequest.dimensionFilter,
            { filter: { fieldName: "eventName", stringFilter: { matchType: "EXACT", value: "product_outbound_click" } } },
          ],
        },
      },
    }),
  ]);

  return {
    googleAnalyticsVisitors: firstMetricValue(visitorReport),
    googleAnalyticsClicks: firstMetricValue(clickReport),
  };
}
