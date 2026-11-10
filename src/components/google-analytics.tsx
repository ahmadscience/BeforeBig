import { cookies, headers } from "next/headers";
import { analyticsAllowed, privacyCookie } from "@/lib/privacy";
import Script from "next/script";

export async function GoogleAnalytics() {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!measurementId || !/^G-[A-Z0-9]+$/i.test(measurementId)) return null;
  if (!analyticsAllowed((await cookies()).get(privacyCookie)?.value, (await headers()).get("sec-gpc"))) return null;
  const safeMeasurementId = JSON.stringify(measurementId);

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />
      <Script id="google-analytics" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', ${safeMeasurementId}, { send_page_view: true });`}
      </Script>
    </>
  );
}
