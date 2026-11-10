import type { Metadata } from "next";
import Link from "next/link";
import { cookies,headers } from "next/headers";
import { requireUser } from "@/lib/auth";
import { accountSessionHash } from "@/lib/account-http";
import { getAccountStore } from "@/db/account";
import { privacyCookie } from "@/lib/privacy";
import { AnalyticsPreference } from "@/components/analytics-preference";
import { AccountControls } from "@/components/account-controls";
export const metadata:Metadata={title:"Privacy & account data",robots:{index:false,follow:false}};
export default async function AccountPrivacyPage(){
  await requireUser("/settings/privacy");const data=await getAccountStore()?.summary(await accountSessionHash());
  if(!data)return <section className="shell page-section"><h1>Account storage is unavailable</h1><p>Try again later.</p></section>;
  return <section className="shell page-section privacy-page"><p className="eyebrow">Your account</p><h1>Privacy & account data</h1><p className="muted">Signed in as {data.email}. <Link href="/privacy">What this instance stores →</Link></p><section className="panel privacy-panel"><h2>Optional analytics</h2><AnalyticsPreference choice={(await cookies()).get(privacyCookie)?.value??"deny"} gpc={(await headers()).get("sec-gpc")==="1"} /></section><AccountControls {...data} /></section>;
}
