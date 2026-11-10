"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createMagicLink, getCurrentUser } from "@/lib/auth";
import { appConfig } from "@/lib/config";
import { sendMagicLinkEmail } from "@/lib/email";
import { consumeRateLimit } from "@/lib/rate-limit";
import { anonymousRecaptchaRequired, verifyRecaptchaToken } from "@/lib/recaptcha";
import { safeReturnPath } from "@/lib/security";

const requestSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  returnTo: z.string().optional(),
  captchaToken: z.string().max(4096).optional(),
});

export type MagicLinkState = {
  error?: string;
  message?: string;
  devMagicLink?: string;
};

export async function requestMagicLink(_previous: MagicLinkState, formData: FormData): Promise<MagicLinkState> {
  const parsed = requestSchema.safeParse({
    email: formData.get("email"),
    returnTo: formData.get("returnTo"),
    captchaToken: String(formData.get("g-recaptcha-response") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your email address." };

  const currentUser = await getCurrentUser();
  // Reauthentication stays bound to the authenticated account, never a browser-supplied identity.
  if (currentUser && currentUser.email !== parsed.data.email) return { error: "Use your current account email to confirm access. Sign out first to use another account." };

  const genericMessage = "If the address can receive mail, a sign-in link is on its way.";
  const requestHeaders = await headers();
  const networkKey = requestHeaders.get("x-vercel-forwarded-for") ?? requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const [emailLimit, networkLimit] = await Promise.all([
    consumeRateLimit({ action: "magic_link_email", actorKey: parsed.data.email, limit: 5, windowMs: 60 * 60_000 }),
    consumeRateLimit({ action: "magic_link_network", actorKey: networkKey, limit: 25, windowMs: 60 * 60_000 }),
  ]);
  if (!emailLimit.allowed || !networkLimit.allowed) {
    if (emailLimit.reason === "storage_unavailable" || networkLimit.reason === "storage_unavailable") {
      return { error: "Authentication storage is not configured yet." };
    }
    if (emailLimit.reason === "configuration_missing" || networkLimit.reason === "configuration_missing") {
      return { error: "Authentication security settings are incomplete." };
    }
    return { message: genericMessage };
  }

  if (!currentUser && anonymousRecaptchaRequired()) {
    const captcha = await verifyRecaptchaToken(parsed.data.captchaToken ?? "");
    if (!captcha.verified) return { error: "Complete the reCAPTCHA check and try again." };
  }

  const returnTo = safeReturnPath(parsed.data.returnTo);
  const magicLink = await createMagicLink(parsed.data.email, returnTo);
  if (!magicLink) return { error: "Authentication storage is not configured yet." };

  const url = new URL("/auth/verify", appConfig.appUrl);
  url.searchParams.set("token", magicLink.token);

  if (appConfig.emailFeatureEnabled) {
    try {
      await sendMagicLinkEmail({ to: parsed.data.email, link: url.toString() });
    } catch {
      return { error: "The sign-in email could not be sent. Try again shortly." };
    }
  } else if (!appConfig.authDevMagicLinkEnabled) {
    return { error: "Email delivery is disabled. Configure an email provider or enable the local development link." };
  }

  return {
    message: genericMessage,
    devMagicLink: appConfig.authDevMagicLinkEnabled ? url.toString() : undefined,
  };
}
