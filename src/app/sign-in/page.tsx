import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";
import { MagicLinkForm } from "@/components/magic-link-form";
import { getCurrentUser } from "@/lib/auth";
import { safeReturnPath } from "@/lib/security";
import { anonymousRecaptchaRequired } from "@/lib/recaptcha";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

type SignInProps = { searchParams: Promise<{ returnTo?: string; error?: string; reauthenticate?: string }> };

export default async function SignInPage({ searchParams }: SignInProps) {
  const params = await searchParams;
  const returnTo = safeReturnPath(params.returnTo);
  const user = await getCurrentUser();
  if (user && params.reauthenticate !== "1") redirect(returnTo as Route);
  const confirming = Boolean(user && params.reauthenticate === "1");
  return (
    <section className="shell auth-section">
      <div className="auth-card">
        <p className="eyebrow">Founder access</p>
        <h1>{params.reauthenticate === "1" ? "Confirm account access." : "Sign in without a password."}</h1>
        <p>We’ll email a secure, single-use link so you can manage product records and reviews.</p>
        {params.error === "invalid" ? <p className="form-error" role="alert">That sign-in link is invalid, expired, or already used.</p> : null}
        <MagicLinkForm returnTo={returnTo} email={confirming ? user?.email : undefined} captchaRequired={!confirming && anonymousRecaptchaRequired()} siteKey={confirming ? undefined : process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY} />
      </div>
    </section>
  );
}
