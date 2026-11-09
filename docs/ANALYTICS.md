# Analytics

## What BeforeBig can truthfully show

Each public product record shows four separate lifetime signals:

- `BeforeBig visitors` — distinct anonymous browser sessions that viewed the product record, based on internal `product_page_view` events.
- `Product clicks` — requests sent through `/go/[slug]` from BeforeBig to the listed product website.
- `GA4 visitors` — GA4 `activeUsers` for the product path, when the optional Data API connection is configured.
- `GA4 product clicks` — GA4 `eventCount` for `product_outbound_click` on the product path.

An outbound click is not a guaranteed destination landing. BeforeBig cannot know whether a third-party site finished loading or how many visitors that site received unless the site owner shares or installs compatible analytics.

## Internal counter path

1. Product pages send a `product_page_view` event to `/api/analytics` after hydration.
2. Product links fire the GA4 event and point to `/go/[slug]`.
3. The redirect route validates the known product, appends `product_outbound_click`, and redirects to the product URL.
4. Metrics are derived from `analytics_events`; no browser-provided counter is trusted.

The internal unique visitor count requires `ANALYTICS_HASH_SALT`. Without it, page-view totals still work but unique visitor counts are intentionally unavailable rather than storing raw identifiers.

## Optional GA4 setup

Set these optional environment variables on your instance:

- `NEXT_PUBLIC_GA_MEASUREMENT_ID` — the GA4 web stream measurement ID.
- `GA_PROPERTY_ID` — the numeric GA4 property ID.
- `GA_CLIENT_EMAIL` and `GA_PRIVATE_KEY` — a Google service account with read-only access to the property.

The service-account key is server-only. The public measurement ID is safe to expose in the browser. The Data API report is cached at the edge for one minute and is displayed separately from internal counters because Google Analytics processing can lag.

## Hosting considerations

- Use a GA4 property and service account dedicated to your instance.
- Decide the consent experience for regions where analytics consent is required.
- Keep detailed founder analytics behind authenticated membership checks when the dashboard expands beyond public aggregates.
- Keep destination-owner analytics private unless a founder explicitly shares it.
