"use client";

import { useActionState } from "react";
import { requestMagicLink, type MagicLinkState } from "@/app/sign-in/actions";
import { RecaptchaChallenge } from "@/components/recaptcha-challenge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: MagicLinkState = {};

export function MagicLinkForm({ returnTo, captchaRequired, siteKey }: { returnTo: string; captchaRequired: boolean; siteKey?: string }) {
  const [state, action, pending] = useActionState(requestMagicLink, initialState);
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="returnTo" value={returnTo} />
      <label htmlFor="email">Email address</label>
      <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" required maxLength={254} />
      {siteKey ? <RecaptchaChallenge siteKey={siteKey} /> : null}
      {captchaRequired && !siteKey ? <p className="form-error" role="alert">Sign-in is unavailable until the public reCAPTCHA key is configured.</p> : null}
      <Button className="w-full" type="submit" disabled={pending || (captchaRequired && !siteKey)}>{pending ? "Sending…" : "Email me a sign-in link"}</Button>
      <p className="form-note">No password. The link expires after 15 minutes and works once.</p>
      {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
      {state.message ? <p className="form-success" role="status">{state.message}</p> : null}
      {state.devMagicLink ? <a className="dev-auth-link" href={state.devMagicLink}>Open local development sign-in link →</a> : null}
    </form>
  );
}
